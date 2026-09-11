/**
 * REAL MARKETS SIMULATOR
 *
 * Fetches ACTUAL live markets from all 7 prediction market platforms
 * with EXACT betting mechanics for simulation
 *
 * Platforms:
 * 1. DreamDEX Event Contracts (Somnia) - Binary STT price
 * 2. Polymarket (Polygon) - Event predictions
 * 3. Overtime Markets (Optimism) - Sports betting
 * 4. Azuro Protocol (Multi-chain) - Sports betting
 * 5. Limitless Exchange (Base) - Price predictions
 * 6. Thales Speed Markets (Optimism) - Binary crypto options
 * 7. SX Bet (SX Network) - P2P sports exchange
 */

import { createClient } from '@supabase/supabase-js';

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  // Somnia RPC for DreamDEX
  Somnia_RPC: [
    'https://somnia-dataseed.somnia.org/',
    'https://somnia-dataseed1.somnia.org/',
    'https://somnia-dataseed2.somnia.org/',
  ],

  // Contract Addresses
  DREAMDEXSWAP_PREDICTION: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',

  // API Endpoints
  POLYMARKET_GAMMA: 'https://gamma-api.polymarket.com',
  POLYMARKET_CLOB: 'https://clob.polymarket.com',
  OVERTIME_API: 'https://api.overtime.io',
  AZURO_SUBGRAPH: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  LIMITLESS_API: 'https://api.limitless.exchange',
  THALES_API: 'https://overtimemarketsv2.xyz',
  SXBET_API: 'https://api.sx.bet',

  // Polling intervals (ms)
  POLL_INTERVAL: {
    DREAMDEXSWAP: 15000,  // 15 seconds (5-min rounds)
    POLYMARKET: 60000,   // 1 minute
    OVERTIME: 300000,    // 5 minutes
    AZURO: 300000,       // 5 minutes
    LIMITLESS: 60000,    // 1 minute
    THALES: 30000,       // 30 seconds
    SXBET: 300000,       // 5 minutes
  }
};

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export type Platform =
  | 'dreamdex'
  | 'polymarket'
  | 'overtime'
  | 'azuro'
  | 'limitless'
  | 'thales'
  | 'sxbet';

export interface RealMarket {
  platform: Platform;
  id: string;
  title: string;
  description?: string;
  outcomes: Outcome[];
  volume: number;
  liquidity: number;
  expiresAt: Date;
  status: 'open' | 'locked' | 'resolved';
  metadata: Record<string, unknown>;
}

export interface Outcome {
  id: string;
  name: string;
  odds: number;           // Decimal odds (1.5 = +50%)
  impliedProb: number;    // 0-1 probability
  price?: number;         // For CLOB markets (0-1)
}

export interface SimulatedBet {
  id: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeName: string;
  amount: number;         // In platform currency
  odds: number;           // Odds at time of bet
  potentialPayout: number;
  placedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  resolvedAt?: Date;
  payout?: number;
}

export interface PortfolioState {
  totalValue: number;
  availableBalance: number;
  activeBets: SimulatedBet[];
  closedBets: SimulatedBet[];
  pnl: {
    realized: number;
    unrealized: number;
    total: number;
  };
  stats: {
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    avgOdds: number;
    roi: number;
  };
}

// ===========================================
// PLATFORM FETCHERS
// ===========================================

/**
 * 1. DREAMDEXSWAP PREDICTION
 * Fetches current and recent rounds from Somnia
 */
async function fetchDreamDEXMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  try {
    // Get current epoch
    const epochResponse = await fetch(CONFIG.Somnia_RPC[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
          to: CONFIG.DREAMDEXSWAP_PREDICTION,
          data: '0x76671808' // currentEpoch()
        }, 'latest']
      })
    });

    const epochData = await epochResponse.json();
    const currentEpoch = Number(BigInt(epochData.result));

    // Fetch current and next 2 rounds
    for (let i = 0; i < 3; i++) {
      const epoch = currentEpoch + i;
      const roundData = await fetchDreamDEXRound(epoch);

      if (roundData) {
        const now = Date.now() / 1000;
        const lockTime = Number(roundData.lockTimestamp);
        const closeTime = Number(roundData.closeTimestamp);

        let status: 'open' | 'locked' | 'resolved' = 'open';
        if (now > closeTime) status = 'resolved';
        else if (now > lockTime) status = 'locked';

        const bullAmount = Number(roundData.bullAmount) / 1e18;
        const bearAmount = Number(roundData.bearAmount) / 1e18;
        const totalPool = bullAmount + bearAmount;

        // Calculate odds (with 3% house edge)
        const bullOdds = totalPool > 0 ? (totalPool * 0.97) / bullAmount : 2;
        const bearOdds = totalPool > 0 ? (totalPool * 0.97) / bearAmount : 2;

        markets.push({
          platform: 'dreamdex',
          id: `ps-${epoch}`,
          title: `STT Price - Round ${epoch}`,
          description: `Will STT price go UP or DOWN in 5 minutes?`,
          outcomes: [
            {
              id: 'bull',
              name: 'BULL (UP)',
              odds: bullOdds,
              impliedProb: bullAmount / totalPool || 0.5,
            },
            {
              id: 'bear',
              name: 'BEAR (DOWN)',
              odds: bearOdds,
              impliedProb: bearAmount / totalPool || 0.5,
            }
          ],
          volume: totalPool,
          liquidity: totalPool,
          expiresAt: new Date(closeTime * 1000),
          status,
          metadata: {
            epoch,
            lockPrice: roundData.lockPrice,
            closePrice: roundData.closePrice,
            bullAmount,
            bearAmount,
            oracleCalled: roundData.oracleCalled,
          }
        });
      }
    }
  } catch (error) {
    console.error('[DreamDEX] Error fetching markets:', error);
  }

  return markets;
}

async function fetchDreamDEXRound(epoch: number): Promise<Record<string, bigint> | null> {
  try {
    // Encode rounds(uint256) call
    const epochHex = epoch.toString(16).padStart(64, '0');
    const data = '0x8c65c81f' + epochHex;

    const response = await fetch(CONFIG.Somnia_RPC[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: CONFIG.DREAMDEXSWAP_PREDICTION, data }, 'latest']
      })
    });

    const { result } = await response.json();
    if (!result || result === '0x') return null;

    // Decode tuple: (epoch, startTimestamp, lockTimestamp, closeTimestamp, lockPrice, closePrice, lockOracleId, closeOracleId, totalAmount, bullAmount, bearAmount, rewardBaseCalAmount, rewardAmount, oracleCalled)
    const decoded = result.slice(2);
    const values = decoded.match(/.{64}/g) || [];

    return {
      epoch: BigInt('0x' + values[0]),
      startTimestamp: BigInt('0x' + values[1]),
      lockTimestamp: BigInt('0x' + values[2]),
      closeTimestamp: BigInt('0x' + values[3]),
      lockPrice: BigInt('0x' + values[4]),
      closePrice: BigInt('0x' + values[5]),
      totalAmount: BigInt('0x' + values[8]),
      bullAmount: BigInt('0x' + values[9]),
      bearAmount: BigInt('0x' + values[10]),
      oracleCalled: values[13] !== '0'.repeat(64),
    };
  } catch {
    return null;
  }
}

/**
 * 2. POLYMARKET
 * Fetches active event markets from Gamma API
 */
async function fetchPolymarketMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  try {
    const response = await fetch(
      `${CONFIG.POLYMARKET_GAMMA}/events?active=true&closed=false&limit=20&order=volume&ascending=false`
    );
    const events = await response.json();

    for (const event of events) {
      for (const market of event.markets || []) {
        // Handle different price formats
        let outcomePrices: number[] = [0.5, 0.5];
        if (typeof market.outcomePrices === 'string') {
          outcomePrices = market.outcomePrices.split(',').map(Number);
        } else if (Array.isArray(market.outcomePrices)) {
          outcomePrices = market.outcomePrices.map(Number);
        }

        // Handle different outcome formats
        let outcomeNames: string[] = ['Yes', 'No'];
        if (typeof market.outcomes === 'string') {
          outcomeNames = market.outcomes.split(',').map((s: string) => s.trim());
        } else if (Array.isArray(market.outcomes)) {
          outcomeNames = market.outcomes;
        }

        markets.push({
          platform: 'polymarket',
          id: `pm-${market.conditionId}`,
          title: market.question || event.title,
          description: market.description,
          outcomes: outcomeNames.map((name: string, i: number) => ({
            id: `${i}`,
            name: name,
            odds: outcomePrices[i] > 0 ? 1 / outcomePrices[i] : 2,
            impliedProb: outcomePrices[i] || 0.5,
            price: outcomePrices[i],
          })),
          volume: Number(market.volume) || 0,
          liquidity: Number(market.liquidity) || 0,
          expiresAt: new Date(market.endDate || event.endDate),
          status: 'open',
          metadata: {
            conditionId: market.conditionId,
            tokens: market.clobTokenIds?.split(','),
            category: event.category,
            slug: event.slug,
          }
        });
      }
    }
  } catch (error) {
    console.error('[Polymarket] Error fetching markets:', error);
  }

  return markets;
}

/**
 * 3. OVERTIME MARKETS
 * Sports betting markets (requires API key for full access)
 */
async function fetchOvertimeMarkets(apiKey?: string): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    // Fetch from Optimism (networkId: 10)
    const response = await fetch(
      `${CONFIG.OVERTIME_API}/overtime-v2/networks/10/markets`,
      { headers }
    );

    const data = await response.json();

    for (const game of data.markets || []) {
      const odds = game.odds || [];

      markets.push({
        platform: 'overtime',
        id: `ot-${game.gameId}`,
        title: `${game.homeTeam} vs ${game.awayTeam}`,
        description: `${game.leagueName} - ${game.type}`,
        outcomes: [
          {
            id: 'home',
            name: game.homeTeam,
            odds: odds[0]?.decimal || 2,
            impliedProb: odds[0]?.normalizedImplied || 0.5,
          },
          {
            id: 'away',
            name: game.awayTeam,
            odds: odds[1]?.decimal || 2,
            impliedProb: odds[1]?.normalizedImplied || 0.5,
          },
          ...(odds[2] ? [{
            id: 'draw',
            name: 'Draw',
            odds: odds[2]?.decimal || 3,
            impliedProb: odds[2]?.normalizedImplied || 0.33,
          }] : [])
        ],
        volume: 0,
        liquidity: 0,
        expiresAt: new Date(game.maturity * 1000),
        status: game.isOpen ? 'open' : game.isResolved ? 'resolved' : 'locked',
        metadata: {
          gameId: game.gameId,
          sport: game.sport,
          leagueId: game.leagueId,
          leagueName: game.leagueName,
          typeId: game.typeId,
        }
      });
    }
  } catch (error) {
    console.error('[Overtime] Error fetching markets:', error);
  }

  return markets;
}

/**
 * 4. AZURO PROTOCOL
 * Decentralized sports betting via GraphQL
 */
async function fetchAzuroMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  const query = `
    query GetGames {
      games(
        first: 50
        orderBy: startsAt
        orderDirection: asc
        where: { status: Created }
      ) {
        id
        gameId
        title
        startsAt
        status
        sport { name }
        league { name }
        participants { name }
        conditions(first: 3, where: { status: Created }) {
          id
          conditionId
          outcomes {
            id
            outcomeId
            odds
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(CONFIG.AZURO_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const { data } = await response.json();

    for (const game of data?.games || []) {
      const condition = game.conditions?.[0];
      if (!condition) continue;

      markets.push({
        platform: 'azuro',
        id: `az-${game.gameId}`,
        title: game.title || `${game.participants?.[0]?.name} vs ${game.participants?.[1]?.name}`,
        description: `${game.sport?.name} - ${game.league?.name}`,
        outcomes: condition.outcomes?.map((o: { outcomeId: string; odds: string }, i: number) => ({
          id: o.outcomeId,
          name: game.participants?.[i]?.name || `Outcome ${i + 1}`,
          odds: Number(o.odds) / 1e12, // Azuro uses 12 decimals
          impliedProb: 1 / (Number(o.odds) / 1e12),
        })) || [],
        volume: 0,
        liquidity: 0,
        expiresAt: new Date(Number(game.startsAt) * 1000),
        status: 'open',
        metadata: {
          gameId: game.gameId,
          sport: game.sport?.name,
          league: game.league?.name,
          conditionId: condition.conditionId,
        }
      });
    }
  } catch (error) {
    console.error('[Azuro] Error fetching markets:', error);
  }

  return markets;
}

/**
 * 5. LIMITLESS EXCHANGE
 * Short-term price prediction markets on Base
 */
async function fetchLimitlessMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  try {
    const response = await fetch(`${CONFIG.LIMITLESS_API}/markets/active?limit=30`);
    const data = await response.json();

    // Handle different response structures
    const marketList = Array.isArray(data) ? data : data?.markets || data?.data || [];

    if (!Array.isArray(marketList)) {
      console.log('[Limitless] Unexpected response format');
      return markets;
    }

    for (const market of marketList) {
      if (!market || typeof market !== 'object') continue;

      markets.push({
        platform: 'limitless',
        id: `lm-${market.slug || market.address || market.id || Date.now()}`,
        title: market.title || market.question || 'Unknown Market',
        description: market.description || '',
        outcomes: Array.isArray(market.outcomes) ? market.outcomes.map((o: { id?: string; name?: string; price?: number }, i: number) => ({
          id: o?.id || `${i}`,
          name: o?.name || `Outcome ${i + 1}`,
          odds: o?.price && o.price > 0 ? 1 / o.price : 2,
          impliedProb: o?.price || 0.5,
          price: o?.price,
        })) : [
          { id: '0', name: 'Yes', odds: 2, impliedProb: 0.5 },
          { id: '1', name: 'No', odds: 2, impliedProb: 0.5 }
        ],
        volume: Number(market.volume) || 0,
        liquidity: Number(market.liquidity) || 0,
        expiresAt: new Date(market.expirationDate || market.endDate || Date.now() + 86400000),
        status: market.isResolved ? 'resolved' : 'open',
        metadata: {
          address: market.address,
          slug: market.slug,
          creator: market.creator,
        }
      });
    }
  } catch (error) {
    console.error('[Limitless] Error fetching markets:', error);
  }

  return markets;
}

/**
 * 6. THALES SPEED MARKETS
 * Binary options on crypto prices (15min - 24hr)
 */
async function fetchThalesMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  // Thales creates markets on-demand, so we simulate available options
  const assets = ['BTC', 'ETH'];
  const timeframes = [
    { seconds: 900, label: '15 minutes' },
    { seconds: 3600, label: '1 hour' },
    { seconds: 14400, label: '4 hours' },
    { seconds: 86400, label: '24 hours' },
  ];

  const now = Date.now();

  for (const asset of assets) {
    for (const tf of timeframes) {
      // Standard 50/50 odds with house edge
      const baseOdds = 1.95; // 2.0 with ~2.5% house edge

      markets.push({
        platform: 'thales',
        id: `th-${asset}-${tf.seconds}`,
        title: `${asset} Speed Market - ${tf.label}`,
        description: `Will ${asset} price go UP or DOWN in ${tf.label}?`,
        outcomes: [
          {
            id: 'up',
            name: `${asset} UP`,
            odds: baseOdds,
            impliedProb: 0.5,
          },
          {
            id: 'down',
            name: `${asset} DOWN`,
            odds: baseOdds,
            impliedProb: 0.5,
          }
        ],
        volume: 0,
        liquidity: 50000, // Estimated AMM liquidity
        expiresAt: new Date(now + tf.seconds * 1000),
        status: 'open',
        metadata: {
          asset,
          deltaTimeSec: tf.seconds,
          minBuyin: 5,
          maxBuyin: 200,
          collateral: 'sUSD',
        }
      });
    }
  }

  return markets;
}

/**
 * 7. SX BET
 * Peer-to-peer sports betting exchange
 */
async function fetchSXBetMarkets(): Promise<RealMarket[]> {
  const markets: RealMarket[] = [];

  try {
    const response = await fetch(`${CONFIG.SXBET_API}/markets/active?pageSize=30`);
    const { data } = await response.json();

    for (const market of data || []) {
      // SX uses American odds, convert to decimal
      const homeOdds = americanToDecimal(market.outcomeOneLine || -110);
      const awayOdds = americanToDecimal(market.outcomeTwoLine || -110);

      markets.push({
        platform: 'sxbet',
        id: `sx-${market.marketHash}`,
        title: `${market.outcomeOneName} vs ${market.outcomeTwoName}`,
        description: `${getSportName(market.sportId)} - ${market.type === 1 ? 'Moneyline' : market.type === 2 ? 'Spread' : 'Total'}`,
        outcomes: [
          {
            id: 'one',
            name: market.outcomeOneName,
            odds: homeOdds,
            impliedProb: 1 / homeOdds,
          },
          {
            id: 'two',
            name: market.outcomeTwoName,
            odds: awayOdds,
            impliedProb: 1 / awayOdds,
          }
        ],
        volume: 0,
        liquidity: 0,
        expiresAt: new Date(market.gameTime * 1000),
        status: market.status === 'ACTIVE' ? 'open' : 'locked',
        metadata: {
          marketHash: market.marketHash,
          sportId: market.sportId,
          leagueId: market.leagueId,
          type: market.type,
          line: market.line,
        }
      });
    }
  } catch (error) {
    console.error('[SX Bet] Error fetching markets:', error);
  }

  return markets;
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function americanToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

function getSportName(sportId: number): string {
  const sports: Record<number, string> = {
    1: 'Soccer', 2: 'Basketball', 3: 'Baseball',
    4: 'Hockey', 5: 'MMA', 6: 'Football', 7: 'Tennis'
  };
  return sports[sportId] || 'Sports';
}

// ===========================================
// MAIN SIMULATOR CLASS
// ===========================================

export class RealMarketsSimulator {
  private supabase;
  private portfolio: PortfolioState;
  private markets: Map<string, RealMarket> = new Map();
  private pollingIntervals: NodeJS.Timeout[] = [];

  constructor(supabaseUrl?: string, supabaseKey?: string, initialBalance = 1000) {
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.portfolio = {
      totalValue: initialBalance,
      availableBalance: initialBalance,
      activeBets: [],
      closedBets: [],
      pnl: { realized: 0, unrealized: 0, total: 0 },
      stats: {
        totalBets: 0, wins: 0, losses: 0,
        winRate: 0, avgOdds: 0, roi: 0
      }
    };
  }

  /**
   * Fetch all real markets from all 7 platforms
   */
  async fetchAllMarkets(): Promise<Record<Platform, RealMarket[]>> {
    console.log('\n🔄 Fetching REAL markets from all 7 platforms...\n');

    const [
      dreamdex,
      polymarket,
      overtime,
      azuro,
      limitless,
      thales,
      sxbet
    ] = await Promise.all([
      fetchDreamDEXMarkets(),
      fetchPolymarketMarkets(),
      fetchOvertimeMarkets(),
      fetchAzuroMarkets(),
      fetchLimitlessMarkets(),
      fetchThalesMarkets(),
      fetchSXBetMarkets()
    ]);

    // Update market cache
    [...dreamdex, ...polymarket, ...overtime, ...azuro, ...limitless, ...thales, ...sxbet]
      .forEach(m => this.markets.set(m.id, m));

    const result = { dreamdex, polymarket, overtime, azuro, limitless, thales, sxbet };

    // Log summary
    console.log('📊 REAL MARKETS FETCHED:');
    console.log(`   DreamDEX: ${dreamdex.length} rounds`);
    console.log(`   Polymarket:  ${polymarket.length} events`);
    console.log(`   Overtime:    ${overtime.length} games`);
    console.log(`   Azuro:       ${azuro.length} games`);
    console.log(`   Limitless:   ${limitless.length} markets`);
    console.log(`   Thales:      ${thales.length} options`);
    console.log(`   SX Bet:      ${sxbet.length} markets`);
    console.log(`   TOTAL:       ${Object.values(result).flat().length} markets\n`);

    return result;
  }

  /**
   * Get market by ID
   */
  getMarket(marketId: string): RealMarket | undefined {
    return this.markets.get(marketId);
  }

  /**
   * Place a simulated bet on a real market
   */
  async placeBet(
    marketId: string,
    outcomeId: string,
    amount: number
  ): Promise<SimulatedBet | null> {
    const market = this.markets.get(marketId);
    if (!market) {
      console.error(`❌ Market ${marketId} not found`);
      return null;
    }

    if (market.status !== 'open') {
      console.error(`❌ Market ${marketId} is ${market.status}`);
      return null;
    }

    if (amount > this.portfolio.availableBalance) {
      console.error(`❌ Insufficient balance: ${this.portfolio.availableBalance.toFixed(2)} < ${amount}`);
      return null;
    }

    const outcome = market.outcomes.find(o => o.id === outcomeId);
    if (!outcome) {
      console.error(`❌ Outcome ${outcomeId} not found in market`);
      return null;
    }

    const bet: SimulatedBet = {
      id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: market.platform,
      marketId: market.id,
      marketTitle: market.title,
      outcomeId: outcome.id,
      outcomeName: outcome.name,
      amount,
      odds: outcome.odds,
      potentialPayout: amount * outcome.odds,
      placedAt: new Date(),
      expiresAt: market.expiresAt,
      status: 'pending'
    };

    // Update portfolio
    this.portfolio.availableBalance -= amount;
    this.portfolio.activeBets.push(bet);
    this.portfolio.stats.totalBets++;

    // Recalculate avg odds
    const totalOdds = this.portfolio.activeBets.reduce((sum, b) => sum + b.odds, 0);
    this.portfolio.stats.avgOdds = totalOdds / this.portfolio.activeBets.length;

    // Save to database if available
    if (this.supabase) {
      await this.saveBetToDatabase(bet);
    }

    console.log(`\n✅ BET PLACED:`);
    console.log(`   Platform: ${market.platform.toUpperCase()}`);
    console.log(`   Market:   ${market.title}`);
    console.log(`   Outcome:  ${outcome.name}`);
    console.log(`   Amount:   $${amount.toFixed(2)}`);
    console.log(`   Odds:     ${outcome.odds.toFixed(2)}x`);
    console.log(`   Payout:   $${bet.potentialPayout.toFixed(2)} (if win)`);
    console.log(`   Expires:  ${market.expiresAt.toISOString()}`);

    return bet;
  }

  /**
   * Resolve a bet (won/lost)
   */
  resolveBet(betId: string, won: boolean): SimulatedBet | null {
    const betIndex = this.portfolio.activeBets.findIndex(b => b.id === betId);
    if (betIndex === -1) return null;

    const bet = this.portfolio.activeBets[betIndex];
    bet.status = won ? 'won' : 'lost';
    bet.resolvedAt = new Date();
    bet.payout = won ? bet.potentialPayout : 0;

    // Move to closed bets
    this.portfolio.activeBets.splice(betIndex, 1);
    this.portfolio.closedBets.push(bet);

    // Update portfolio
    if (won) {
      this.portfolio.availableBalance += bet.payout;
      this.portfolio.pnl.realized += bet.payout - bet.amount;
      this.portfolio.stats.wins++;
    } else {
      this.portfolio.pnl.realized -= bet.amount;
      this.portfolio.stats.losses++;
    }

    this.portfolio.pnl.total = this.portfolio.pnl.realized + this.portfolio.pnl.unrealized;
    this.portfolio.totalValue = this.portfolio.availableBalance +
      this.portfolio.activeBets.reduce((sum, b) => sum + b.amount, 0);

    const totalResolved = this.portfolio.stats.wins + this.portfolio.stats.losses;
    this.portfolio.stats.winRate = totalResolved > 0
      ? this.portfolio.stats.wins / totalResolved
      : 0;

    console.log(`\n${won ? '🎉' : '😢'} BET RESOLVED: ${won ? 'WON' : 'LOST'}`);
    console.log(`   Market:  ${bet.marketTitle}`);
    console.log(`   Outcome: ${bet.outcomeName}`);
    console.log(`   Stake:   $${bet.amount.toFixed(2)}`);
    console.log(`   Payout:  $${(bet.payout || 0).toFixed(2)}`);
    console.log(`   P&L:     ${won ? '+' : ''}$${(won ? bet.payout! - bet.amount : -bet.amount).toFixed(2)}`);

    return bet;
  }

  /**
   * Get current portfolio state
   */
  getPortfolio(): PortfolioState {
    // Calculate unrealized P&L
    this.portfolio.pnl.unrealized = 0; // Would need current prices
    this.portfolio.totalValue = this.portfolio.availableBalance +
      this.portfolio.activeBets.reduce((sum, b) => sum + b.amount, 0);

    const initial = 1000;
    this.portfolio.stats.roi = ((this.portfolio.totalValue - initial) / initial) * 100;

    return { ...this.portfolio };
  }

  /**
   * Display formatted market data
   */
  displayMarkets(markets: RealMarket[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('                        REAL PREDICTION MARKETS');
    console.log('='.repeat(80));

    for (const market of markets) {
      console.log(`\n[${market.platform.toUpperCase()}] ${market.title}`);
      console.log(`   Status: ${market.status} | Volume: $${market.volume.toLocaleString()}`);
      console.log(`   Expires: ${market.expiresAt.toLocaleString()}`);
      console.log('   Outcomes:');
      for (const outcome of market.outcomes) {
        const probPct = (outcome.impliedProb * 100).toFixed(1);
        console.log(`     • ${outcome.name}: ${outcome.odds.toFixed(2)}x (${probPct}%)`);
      }
    }
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Display portfolio summary
   */
  displayPortfolio(): void {
    const p = this.getPortfolio();

    console.log('\n' + '='.repeat(60));
    console.log('                  SIMULATED PORTFOLIO');
    console.log('='.repeat(60));
    console.log(`   Total Value:      $${p.totalValue.toFixed(2)}`);
    console.log(`   Available:        $${p.availableBalance.toFixed(2)}`);
    console.log(`   Active Bets:      ${p.activeBets.length}`);
    console.log('');
    console.log(`   Realized P&L:     ${p.pnl.realized >= 0 ? '+' : ''}$${p.pnl.realized.toFixed(2)}`);
    console.log(`   Win Rate:         ${(p.stats.winRate * 100).toFixed(1)}%`);
    console.log(`   Total Bets:       ${p.stats.totalBets}`);
    console.log(`   Wins/Losses:      ${p.stats.wins}/${p.stats.losses}`);
    console.log(`   Avg Odds:         ${p.stats.avgOdds.toFixed(2)}x`);
    console.log(`   ROI:              ${p.stats.roi >= 0 ? '+' : ''}${p.stats.roi.toFixed(2)}%`);

    if (p.activeBets.length > 0) {
      console.log('\n   ACTIVE BETS:');
      for (const bet of p.activeBets) {
        console.log(`     • [${bet.platform}] ${bet.outcomeName} @ ${bet.odds.toFixed(2)}x`);
        console.log(`       Stake: $${bet.amount} | Potential: $${bet.potentialPayout.toFixed(2)}`);
      }
    }
    console.log('='.repeat(60) + '\n');
  }

  private async saveBetToDatabase(bet: SimulatedBet): Promise<void> {
    if (!this.supabase) return;

    const tableName = `${bet.platform}_simulated_trades`;

    await this.supabase.from(tableName).insert({
      bet_id: bet.id,
      market_id: bet.marketId,
      market_title: bet.marketTitle,
      outcome_id: bet.outcomeId,
      outcome_name: bet.outcomeName,
      amount: bet.amount,
      odds: bet.odds,
      potential_payout: bet.potentialPayout,
      placed_at: bet.placedAt.toISOString(),
      expires_at: bet.expiresAt.toISOString(),
      status: bet.status,
    });
  }
}

// ===========================================
// DEMO / CLI EXECUTION
// ===========================================

async function runDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║              🎯 REAL MARKETS SIMULATOR - 7 PLATFORMS                         ║
║                                                                              ║
║   Platforms:                                                                 ║
║   1. DreamDEX (Somnia)     - Binary STT price prediction                    ║
║   2. Polymarket (Polygon)  - Event prediction markets                       ║
║   3. Overtime (Optimism)   - Sports betting                                 ║
║   4. Azuro (Multi-chain)   - Decentralized sports                           ║
║   5. Limitless (Base)      - Price predictions                              ║
║   6. Thales (Optimism)     - Binary crypto options                          ║
║   7. SX Bet (SX Network)   - P2P sports exchange                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const simulator = new RealMarketsSimulator(undefined, undefined, 1000);

  // Fetch all real markets
  const allMarkets = await simulator.fetchAllMarkets();

  // Display sample markets from each platform
  for (const [platform, markets] of Object.entries(allMarkets)) {
    if (markets.length > 0) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📊 ${platform.toUpperCase()} MARKETS (${markets.length} available)`);
      console.log('─'.repeat(70));

      // Show first 3 markets from each platform
      for (const market of markets.slice(0, 3)) {
        console.log(`\n  🎯 ${market.title}`);
        if (market.description) console.log(`     ${market.description}`);
        console.log(`     Status: ${market.status.toUpperCase()} | Expires: ${market.expiresAt.toLocaleString()}`);
        console.log(`     Volume: $${market.volume.toLocaleString()} | Liquidity: $${market.liquidity.toLocaleString()}`);
        console.log('     Outcomes:');
        for (const outcome of market.outcomes) {
          const pct = (outcome.impliedProb * 100).toFixed(1);
          const oddsStr = outcome.odds.toFixed(2);
          console.log(`       • ${outcome.name.padEnd(30)} ${oddsStr}x  (${pct}% implied)`);
        }
      }
    }
  }

  // Demo: Place some simulated bets
  console.log(`\n${'═'.repeat(70)}`);
  console.log('💰 SIMULATED BETTING DEMO');
  console.log('═'.repeat(70));

  // Get a sample market from each platform that has markets
  const sampleBets: { marketId: string; outcomeId: string; amount: number }[] = [];

  if (allMarkets.dreamdex.length > 0) {
    sampleBets.push({
      marketId: allMarkets.dreamdex[0].id,
      outcomeId: 'bull',
      amount: 50
    });
  }

  if (allMarkets.polymarket.length > 0) {
    sampleBets.push({
      marketId: allMarkets.polymarket[0].id,
      outcomeId: allMarkets.polymarket[0].outcomes[0]?.id || '0',
      amount: 100
    });
  }

  if (allMarkets.azuro.length > 0) {
    sampleBets.push({
      marketId: allMarkets.azuro[0].id,
      outcomeId: allMarkets.azuro[0].outcomes[0]?.id || 'home',
      amount: 75
    });
  }

  if (allMarkets.thales.length > 0) {
    sampleBets.push({
      marketId: allMarkets.thales[0].id,
      outcomeId: 'up',
      amount: 50
    });
  }

  // Place bets
  for (const bet of sampleBets) {
    await simulator.placeBet(bet.marketId, bet.outcomeId, bet.amount);
  }

  // Show portfolio
  simulator.displayPortfolio();

  // Simulate some resolutions
  console.log('\n🎲 SIMULATING RESOLUTIONS...\n');

  const portfolio = simulator.getPortfolio();
  for (const bet of portfolio.activeBets.slice(0, 2)) {
    const won = Math.random() > 0.5;
    simulator.resolveBet(bet.id, won);
  }

  // Final portfolio state
  console.log('\n📈 FINAL PORTFOLIO STATE:');
  simulator.displayPortfolio();

  return {
    markets: allMarkets,
    simulator,
  };
}

// Export for module usage
export {
  fetchDreamDEXMarkets,
  fetchPolymarketMarkets,
  fetchOvertimeMarkets,
  fetchAzuroMarkets,
  fetchLimitlessMarkets,
  fetchThalesMarkets,
  fetchSXBetMarkets,
  runDemo,
};

// Run if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
