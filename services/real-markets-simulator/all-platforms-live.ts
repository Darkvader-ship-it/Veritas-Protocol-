/**
 * ALL 7 PLATFORMS - LIVE BETTING SYSTEM
 *
 * Complete implementation for ALL prediction market platforms:
 * 1. DreamDEX (Somnia) - Binary STT price prediction
 * 2. Polymarket (Polygon) - Event prediction markets
 * 3. Overtime Markets (Optimism) - Sports betting
 * 4. Azuro Protocol (Multi-chain) - Decentralized sports
 * 5. Limitless Exchange (Base) - Price predictions
 * 6. Thales Speed Markets (Optimism) - Binary crypto options
 * 7. SX Bet (SX Network) - P2P sports exchange
 *
 * All bets resolve based on ACTUAL real market outcomes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  // Blockchain RPCs
  Somnia_RPC: 'https://somnia-dataseed.somnia.org/',
  OPTIMISM_RPC: 'https://mainnet.optimism.io',
  POLYGON_RPC: 'https://polygon-rpc.com',
  BASE_RPC: 'https://mainnet.base.org',

  // Contract Addresses
  DREAMDEXSWAP_PREDICTION: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
  THALES_SPEED_AMM: '0xE16B8a01490835EC1e76bAbbB3Cadd8921b32001',

  // API Endpoints
  POLYMARKET_GAMMA: 'https://gamma-api.polymarket.com',
  POLYMARKET_CLOB: 'https://clob.polymarket.com',
  OVERTIME_API: 'https://api.overtime.io',
  AZURO_SUBGRAPH_POLYGON: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  AZURO_SUBGRAPH_GNOSIS: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
  LIMITLESS_API: 'https://api.limitless.exchange',
  SXBET_API: 'https://api.sx.bet',
  PYTH_API: 'https://hermes.pyth.network',

  // Price feed IDs (Pyth)
  PYTH_BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  PYTH_ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',

  // Resolution check interval
  RESOLUTION_CHECK_INTERVAL: 15000,
};

// ===========================================
// TYPES
// ===========================================

export type Platform = 'dreamdex' | 'polymarket' | 'overtime' | 'azuro' | 'limitless' | 'thales' | 'sxbet';

export interface LiveMarket {
  platform: Platform;
  marketId: string;
  title: string;
  description?: string;
  category?: string;
  outcomes: MarketOutcome[];
  status: 'open' | 'locked' | 'resolved' | 'cancelled';
  opensAt?: Date;
  locksAt?: Date;
  resolvesAt?: Date;
  volume?: number;
  liquidity?: number;
  resolvedOutcome?: string;
  metadata: Record<string, unknown>;
}

export interface MarketOutcome {
  id: string;
  name: string;
  odds: number;
  impliedProb: number;
}

export interface SimulatedBet {
  id: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeName: string;
  amount: number;
  odds: number;
  potentialPayout: number;
  placedAt: Date;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'refunded';
  resolvedAt?: Date;
  payout?: number;
  realOutcome?: string;
}

export interface UserPortfolio {
  address: string;
  balance: number;
  totalDeposited: number;
  activeBets: SimulatedBet[];
  history: SimulatedBet[];
  stats: {
    totalBets: number;
    wins: number;
    losses: number;
    totalWagered: number;
    totalWon: number;
    pnl: number;
    roi: number;
    winRate: number;
  };
}

// ===========================================
// 1. DREAMDEXSWAP PREDICTION (Somnia)
// ===========================================

async function fetchDreamDEXRound(epoch: number): Promise<{
  epoch: number;
  lockTimestamp: number;
  closeTimestamp: number;
  lockPrice: bigint;
  closePrice: bigint;
  bullAmount: bigint;
  bearAmount: bigint;
  oracleCalled: boolean;
  status: 'open' | 'locked' | 'resolved';
  winner?: 'bull' | 'bear' | 'draw';
} | null> {
  try {
    const epochHex = epoch.toString(16).padStart(64, '0');
    const response = await fetch(CONFIG.Somnia_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: CONFIG.DREAMDEXSWAP_PREDICTION, data: '0x8c65c81f' + epochHex }, 'latest']
      })
    });

    const { result } = await response.json();
    if (!result || result === '0x') return null;

    const values = result.slice(2).match(/.{64}/g) || [];
    const lockTimestamp = Number(BigInt('0x' + values[2]));
    const closeTimestamp = Number(BigInt('0x' + values[3]));
    const lockPrice = BigInt('0x' + values[4]);
    const closePrice = BigInt('0x' + values[5]);
    const oracleCalled = values[13] !== '0'.repeat(64);

    const now = Date.now() / 1000;
    let status: 'open' | 'locked' | 'resolved' = 'open';
    if (oracleCalled) status = 'resolved';
    else if (now > closeTimestamp) status = 'resolved';
    else if (now > lockTimestamp) status = 'locked';

    let winner: 'bull' | 'bear' | 'draw' | undefined;
    if (oracleCalled && closePrice > 0n && lockPrice > 0n) {
      if (closePrice > lockPrice) winner = 'bull';
      else if (closePrice < lockPrice) winner = 'bear';
      else winner = 'draw';
    }

    return {
      epoch,
      lockTimestamp,
      closeTimestamp,
      lockPrice,
      closePrice,
      bullAmount: BigInt('0x' + values[9]),
      bearAmount: BigInt('0x' + values[10]),
      oracleCalled,
      status,
      winner,
    };
  } catch (error) {
    console.error(`[DreamDEX] Error fetching round ${epoch}:`, error);
    return null;
  }
}

async function fetchDreamDEXMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  try {
    // Get current epoch
    const epochRes = await fetch(CONFIG.Somnia_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: CONFIG.DREAMDEXSWAP_PREDICTION, data: '0x76671808' }, 'latest']
      })
    });
    const { result } = await epochRes.json();
    const currentEpoch = Number(BigInt(result));

    for (let i = -1; i <= 2; i++) {
      const epoch = currentEpoch + i;
      const round = await fetchDreamDEXRound(epoch);
      if (!round) continue;

      const bullAmt = Number(round.bullAmount) / 1e18;
      const bearAmt = Number(round.bearAmount) / 1e18;
      const total = bullAmt + bearAmt;

      const bullOdds = total > 0 ? Math.min((total * 0.97) / (bullAmt || 0.001), 15) : 1.97;
      const bearOdds = total > 0 ? Math.min((total * 0.97) / (bearAmt || 0.001), 15) : 1.97;

      markets.push({
        platform: 'dreamdex',
        marketId: `ps-${epoch}`,
        title: `STT/USD Round ${epoch}`,
        description: 'Will STT price go UP or DOWN in 5 minutes?',
        category: 'Crypto',
        outcomes: [
          { id: 'bull', name: 'BULL (UP)', odds: bullOdds, impliedProb: bullAmt / (total || 1) },
          { id: 'bear', name: 'BEAR (DOWN)', odds: bearOdds, impliedProb: bearAmt / (total || 1) },
        ],
        status: round.status,
        locksAt: new Date(round.lockTimestamp * 1000),
        resolvesAt: new Date(round.closeTimestamp * 1000),
        volume: total,
        resolvedOutcome: round.winner,
        metadata: { epoch, lockPrice: round.lockPrice.toString(), closePrice: round.closePrice.toString() }
      });
    }
  } catch (error) {
    console.error('[DreamDEX] Error:', error);
  }

  return markets;
}

// ===========================================
// 2. POLYMARKET (Polygon)
// ===========================================

async function fetchPolymarketMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  try {
    const response = await fetch(
      `${CONFIG.POLYMARKET_GAMMA}/events?active=true&closed=false&limit=100&order=volume&ascending=false`
    );
    const events = await response.json();

    for (const event of events) {
      for (const market of event.markets || []) {
        let prices: number[] = [0.5, 0.5];
        if (typeof market.outcomePrices === 'string') {
          prices = market.outcomePrices.split(',').map(Number);
        } else if (Array.isArray(market.outcomePrices)) {
          prices = market.outcomePrices.map(Number);
        }

        let outcomeNames: string[] = ['Yes', 'No'];
        if (typeof market.outcomes === 'string') {
          outcomeNames = market.outcomes.split(',').map((s: string) => s.trim());
        } else if (Array.isArray(market.outcomes)) {
          outcomeNames = market.outcomes;
        }

        markets.push({
          platform: 'polymarket',
          marketId: `pm-${market.conditionId}`,
          title: market.question || event.title,
          description: market.description?.slice(0, 300),
          category: event.category,
          outcomes: outcomeNames.map((name, i) => ({
            id: `${i}`,
            name,
            odds: prices[i] > 0 && prices[i] < 1 ? 1 / prices[i] : 2,
            impliedProb: prices[i] || 0.5,
          })),
          status: market.closed ? 'resolved' : 'open',
          resolvesAt: new Date(market.endDate || event.endDate),
          volume: Number(market.volume) || 0,
          liquidity: Number(market.liquidity) || 0,
          resolvedOutcome: market.winningOutcome,
          metadata: { conditionId: market.conditionId, slug: event.slug, category: event.category }
        });
      }
    }
  } catch (error) {
    console.error('[Polymarket] Error:', error);
  }

  return markets;
}

async function checkPolymarketResolution(conditionId: string): Promise<{ resolved: boolean; winner?: string }> {
  try {
    const response = await fetch(`${CONFIG.POLYMARKET_GAMMA}/markets/${conditionId}`);
    const market = await response.json();
    if (market.closed && market.winningOutcome !== undefined) {
      return { resolved: true, winner: String(market.winningOutcome) };
    }
  } catch {}
  return { resolved: false };
}

// ===========================================
// 3. OVERTIME MARKETS (Optimism) - Sports
// ===========================================

async function fetchOvertimeMarkets(apiKey?: string): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    // Fetch from multiple networks
    for (const networkId of [10, 42161, 8453]) { // Optimism, Arbitrum, Base
      try {
        const response = await fetch(
          `${CONFIG.OVERTIME_API}/overtime-v2/networks/${networkId}/markets`,
          { headers }
        );

        if (!response.ok) continue;
        const data = await response.json();

        for (const game of data.markets || data || []) {
          if (!game.homeTeam || !game.awayTeam) continue;

          const odds = game.odds || [];
          const homeOdds = odds[0]?.decimal || 2;
          const awayOdds = odds[1]?.decimal || 2;
          const drawOdds = odds[2]?.decimal;

          const outcomes: MarketOutcome[] = [
            { id: 'home', name: game.homeTeam, odds: homeOdds, impliedProb: 1 / homeOdds },
            { id: 'away', name: game.awayTeam, odds: awayOdds, impliedProb: 1 / awayOdds },
          ];

          if (drawOdds) {
            outcomes.push({ id: 'draw', name: 'Draw', odds: drawOdds, impliedProb: 1 / drawOdds });
          }

          let status: 'open' | 'locked' | 'resolved' = 'open';
          if (game.isResolved) status = 'resolved';
          else if (!game.isOpen) status = 'locked';

          markets.push({
            platform: 'overtime',
            marketId: `ot-${game.gameId}`,
            title: `${game.homeTeam} vs ${game.awayTeam}`,
            description: `${game.leagueName} - ${game.sport}`,
            category: game.sport,
            outcomes,
            status,
            resolvesAt: new Date(game.maturity * 1000),
            resolvedOutcome: game.isResolved ? game.winningPosition?.toString() : undefined,
            metadata: {
              gameId: game.gameId,
              sport: game.sport,
              league: game.leagueName,
              networkId,
              homeScore: game.homeScore,
              awayScore: game.awayScore,
            }
          });
        }
      } catch {}
    }
  } catch (error) {
    console.error('[Overtime] Error:', error);
  }

  return markets;
}

async function checkOvertimeResolution(gameId: string, networkId = 10): Promise<{ resolved: boolean; winner?: string }> {
  try {
    const response = await fetch(`${CONFIG.OVERTIME_API}/overtime-v2/networks/${networkId}/markets/${gameId}`);
    const game = await response.json();

    if (game.isResolved) {
      // Position 0 = home, 1 = away, 2 = draw
      const winners = ['home', 'away', 'draw'];
      return { resolved: true, winner: winners[game.winningPosition] || 'home' };
    }
  } catch {}
  return { resolved: false };
}

// ===========================================
// 4. AZURO PROTOCOL (Multi-chain) - Sports
// ===========================================

async function fetchAzuroMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  const query = `
    query GetGames {
      games(
        first: 100
        orderBy: startsAt
        orderDirection: asc
        where: {
          status_in: [Created, Paused],
          startsAt_gt: "${Math.floor(Date.now() / 1000)}"
        }
      ) {
        id
        gameId
        title
        startsAt
        status
        sport { name slug }
        league { name country { name } }
        participants { name image }
        conditions(first: 5, where: { status: Created }) {
          id
          conditionId
          status
          outcomes {
            id
            outcomeId
            odds
          }
        }
      }
    }
  `;

  const subgraphs = [
    { url: CONFIG.AZURO_SUBGRAPH_POLYGON, chain: 'polygon' },
    { url: CONFIG.AZURO_SUBGRAPH_GNOSIS, chain: 'gnosis' },
  ];

  for (const { url, chain } of subgraphs) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const { data } = await response.json();

      for (const game of data?.games || []) {
        const condition = game.conditions?.[0];
        if (!condition?.outcomes?.length) continue;

        const participants = game.participants || [];

        markets.push({
          platform: 'azuro',
          marketId: `az-${chain}-${game.gameId}`,
          title: game.title || `${participants[0]?.name || 'Home'} vs ${participants[1]?.name || 'Away'}`,
          description: `${game.sport?.name} - ${game.league?.name}`,
          category: game.sport?.name,
          outcomes: condition.outcomes.map((o: { outcomeId: string; odds: string }, i: number) => {
            const odds = Number(o.odds) / 1e12;
            return {
              id: o.outcomeId,
              name: participants[i]?.name || `Outcome ${i + 1}`,
              odds: odds > 0 ? odds : 2,
              impliedProb: odds > 0 ? 1 / odds : 0.5,
            };
          }),
          status: game.status === 'Created' ? 'open' : 'locked',
          resolvesAt: new Date(Number(game.startsAt) * 1000),
          metadata: {
            gameId: game.gameId,
            conditionId: condition.conditionId,
            sport: game.sport?.slug,
            league: game.league?.name,
            chain,
          }
        });
      }
    } catch (error) {
      console.error(`[Azuro ${chain}] Error:`, error);
    }
  }

  return markets;
}

async function checkAzuroResolution(gameId: string, chain: string): Promise<{ resolved: boolean; winner?: string }> {
  const query = `
    query GetGame($gameId: String!) {
      game(id: $gameId) {
        status
        conditions {
          status
          wonOutcome { outcomeId }
        }
      }
    }
  `;

  const url = chain === 'gnosis' ? CONFIG.AZURO_SUBGRAPH_GNOSIS : CONFIG.AZURO_SUBGRAPH_POLYGON;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { gameId } })
    });

    const { data } = await response.json();
    const condition = data?.game?.conditions?.[0];

    if (condition?.status === 'Resolved' && condition.wonOutcome) {
      return { resolved: true, winner: condition.wonOutcome.outcomeId };
    }
  } catch {}

  return { resolved: false };
}

// ===========================================
// 5. LIMITLESS EXCHANGE (Base)
// ===========================================

async function fetchLimitlessMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  try {
    const response = await fetch(`${CONFIG.LIMITLESS_API}/markets?status=active&limit=100`);
    const data = await response.json();

    const marketList = Array.isArray(data) ? data : data?.markets || data?.data || [];

    for (const market of marketList) {
      if (!market || typeof market !== 'object') continue;

      const outcomes: MarketOutcome[] = [];

      if (Array.isArray(market.outcomes)) {
        for (let i = 0; i < market.outcomes.length; i++) {
          const o = market.outcomes[i];
          const price = o?.price || o?.probability || 0.5;
          outcomes.push({
            id: o?.id || `${i}`,
            name: o?.name || o?.title || `Outcome ${i + 1}`,
            odds: price > 0 && price < 1 ? 1 / price : 2,
            impliedProb: price,
          });
        }
      } else {
        // Binary market
        const yesPrice = market.yesPrice || market.price || 0.5;
        outcomes.push(
          { id: 'yes', name: 'Yes', odds: 1 / yesPrice, impliedProb: yesPrice },
          { id: 'no', name: 'No', odds: 1 / (1 - yesPrice), impliedProb: 1 - yesPrice }
        );
      }

      markets.push({
        platform: 'limitless',
        marketId: `lm-${market.slug || market.address || market.id}`,
        title: market.title || market.question || 'Unknown Market',
        description: market.description?.slice(0, 300),
        category: market.category,
        outcomes,
        status: market.resolved || market.isResolved ? 'resolved' : 'open',
        resolvesAt: new Date(market.expirationDate || market.endDate || market.resolutionDate || Date.now() + 86400000),
        volume: Number(market.volume) || 0,
        liquidity: Number(market.liquidity) || 0,
        resolvedOutcome: market.winningOutcome || market.result,
        metadata: { address: market.address, slug: market.slug, creator: market.creator }
      });
    }
  } catch (error) {
    console.error('[Limitless] Error:', error);
  }

  return markets;
}

async function checkLimitlessResolution(slug: string): Promise<{ resolved: boolean; winner?: string }> {
  try {
    const response = await fetch(`${CONFIG.LIMITLESS_API}/markets/${slug}`);
    const market = await response.json();

    if (market.resolved || market.isResolved) {
      return { resolved: true, winner: market.winningOutcome || market.result };
    }
  } catch {}
  return { resolved: false };
}

// ===========================================
// 6. THALES SPEED MARKETS (Optimism)
// ===========================================

async function getPythPrice(priceId: string): Promise<number | null> {
  try {
    const response = await fetch(`${CONFIG.PYTH_API}/api/latest_price_feeds?ids[]=${priceId}`);
    const data = await response.json();
    if (data?.[0]?.price?.price) {
      const price = Number(data[0].price.price);
      const expo = Number(data[0].price.expo);
      return price * Math.pow(10, expo);
    }
  } catch {}
  return null;
}

async function fetchThalesMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  const assets = [
    { symbol: 'BTC', pythId: CONFIG.PYTH_BTC_USD },
    { symbol: 'ETH', pythId: CONFIG.PYTH_ETH_USD },
  ];

  const timeframes = [
    { seconds: 900, label: '15 min' },
    { seconds: 1800, label: '30 min' },
    { seconds: 3600, label: '1 hour' },
    { seconds: 14400, label: '4 hours' },
    { seconds: 86400, label: '24 hours' },
  ];

  // Get current prices
  const prices: Record<string, number> = {};
  for (const asset of assets) {
    const price = await getPythPrice(asset.pythId);
    if (price) prices[asset.symbol] = price;
  }

  const now = Date.now();

  for (const asset of assets) {
    const currentPrice = prices[asset.symbol];

    for (const tf of timeframes) {
      const strikeTime = now + tf.seconds * 1000;
      const marketId = `th-${asset.symbol}-${tf.seconds}-${Math.floor(now / 60000)}`;

      markets.push({
        platform: 'thales',
        marketId,
        title: `${asset.symbol} Speed Market - ${tf.label}`,
        description: `Will ${asset.symbol} price be UP or DOWN in ${tf.label}?${currentPrice ? ` Current: $${currentPrice.toLocaleString()}` : ''}`,
        category: 'Crypto',
        outcomes: [
          { id: 'up', name: `${asset.symbol} UP`, odds: 1.95, impliedProb: 0.5 },
          { id: 'down', name: `${asset.symbol} DOWN`, odds: 1.95, impliedProb: 0.5 },
        ],
        status: 'open',
        resolvesAt: new Date(strikeTime),
        liquidity: 50000,
        metadata: {
          asset: asset.symbol,
          pythId: asset.pythId,
          strikePrice: currentPrice,
          strikeTime,
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

async function checkThalesResolution(marketId: string, metadata: Record<string, unknown>): Promise<{ resolved: boolean; winner?: string }> {
  const strikeTime = metadata.strikeTime as number;
  const strikePrice = metadata.strikePrice as number;
  const pythId = metadata.pythId as string;

  if (!strikeTime || Date.now() < strikeTime) {
    return { resolved: false };
  }

  // Get current price after expiry
  const currentPrice = await getPythPrice(pythId);
  if (!currentPrice || !strikePrice) {
    return { resolved: false };
  }

  const winner = currentPrice > strikePrice ? 'up' : 'down';
  return { resolved: true, winner };
}

// ===========================================
// 7. SX BET (SX Network) - P2P Sports Exchange
// ===========================================

function americanToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

async function fetchSXBetMarkets(): Promise<LiveMarket[]> {
  const markets: LiveMarket[] = [];

  const sportNames: Record<number, string> = {
    1: 'Soccer', 2: 'Basketball', 3: 'Baseball',
    4: 'Hockey', 5: 'MMA', 6: 'Football', 7: 'Tennis',
    8: 'Esports', 9: 'Cricket', 10: 'Rugby',
  };

  try {
    // Try different endpoints
    const endpoints = [
      `${CONFIG.SXBET_API}/markets/active?pageSize=100`,
      `${CONFIG.SXBET_API}/markets/popular?pageSize=50`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) continue;

        const json = await response.json();
        const data = json?.data || json?.markets || (Array.isArray(json) ? json : []);

        if (!Array.isArray(data)) continue;

        for (const market of data) {
          if (!market || !market.outcomeOneName) continue;

          const homeOdds = americanToDecimal(market.outcomeOneLine || -110);
          const awayOdds = americanToDecimal(market.outcomeTwoLine || -110);

          const marketType = market.type === 1 ? 'Moneyline' :
                           market.type === 2 ? 'Spread' :
                           market.type === 3 ? 'Total' : 'Props';

          markets.push({
            platform: 'sxbet',
            marketId: `sx-${market.marketHash || market.id}`,
            title: `${market.outcomeOneName} vs ${market.outcomeTwoName}`,
            description: `${sportNames[market.sportId] || 'Sports'} - ${marketType}`,
            category: sportNames[market.sportId] || 'Sports',
            outcomes: [
              { id: 'one', name: market.outcomeOneName, odds: homeOdds, impliedProb: 1 / homeOdds },
              { id: 'two', name: market.outcomeTwoName, odds: awayOdds, impliedProb: 1 / awayOdds },
            ],
            status: market.status === 'ACTIVE' ? 'open' : market.status === 'SETTLED' ? 'resolved' : 'locked',
            resolvesAt: new Date((market.gameTime || Date.now() / 1000 + 86400) * 1000),
            resolvedOutcome: market.outcome === 1 ? 'one' : market.outcome === 2 ? 'two' : undefined,
            metadata: {
              marketHash: market.marketHash,
              sportId: market.sportId,
              leagueId: market.leagueId,
              type: market.type,
              line: market.line,
            }
          });
        }

        if (markets.length > 0) break;
      } catch {}
    }
  } catch (error) {
    console.error('[SX Bet] Error:', error);
  }

  return markets;
}

async function checkSXBetResolution(marketHash: string): Promise<{ resolved: boolean; winner?: string }> {
  try {
    const response = await fetch(`${CONFIG.SXBET_API}/markets/find?marketHashes=${marketHash}`);
    const { data } = await response.json();

    if (data?.[0]?.status === 'SETTLED') {
      const winner = data[0].outcome === 1 ? 'one' : 'two';
      return { resolved: true, winner };
    }
  } catch {}
  return { resolved: false };
}

// ===========================================
// MAIN SYSTEM CLASS
// ===========================================

export class AllPlatformsLiveBetting {
  private supabase?: SupabaseClient;
  private markets: Map<string, LiveMarket> = new Map();
  private portfolios: Map<string, UserPortfolio> = new Map();
  private resolutionInterval?: NodeJS.Timeout;
  private overtimeApiKey?: string;

  constructor(config?: {
    supabaseUrl?: string;
    supabaseKey?: string;
    overtimeApiKey?: string;
  }) {
    if (config?.supabaseUrl && config?.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
    this.overtimeApiKey = config?.overtimeApiKey;
  }

  /**
   * Fetch ALL live markets from ALL 7 platforms
   */
  async fetchAllMarkets(): Promise<{
    total: number;
    byPlatform: Record<Platform, LiveMarket[]>;
  }> {
    console.log('\n🔄 Fetching LIVE markets from ALL 7 platforms...\n');

    const [dreamdex, polymarket, overtime, azuro, limitless, thales, sxbet] = await Promise.all([
      fetchDreamDEXMarkets(),
      fetchPolymarketMarkets(),
      fetchOvertimeMarkets(this.overtimeApiKey),
      fetchAzuroMarkets(),
      fetchLimitlessMarkets(),
      fetchThalesMarkets(),
      fetchSXBetMarkets(),
    ]);

    const byPlatform = { dreamdex, polymarket, overtime, azuro, limitless, thales, sxbet };

    // Update cache
    this.markets.clear();
    for (const markets of Object.values(byPlatform)) {
      for (const m of markets) {
        this.markets.set(m.marketId, m);
      }
    }

    const total = Object.values(byPlatform).flat().length;

    console.log('📊 LIVE MARKETS FROM ALL 7 PLATFORMS:');
    console.log('─'.repeat(50));
    console.log(`   🥞 DreamDEX:  ${dreamdex.length.toString().padStart(4)} rounds`);
    console.log(`   🔮 Polymarket:   ${polymarket.length.toString().padStart(4)} events`);
    console.log(`   ⚽ Overtime:     ${overtime.length.toString().padStart(4)} games`);
    console.log(`   🎰 Azuro:        ${azuro.length.toString().padStart(4)} games`);
    console.log(`   ∞  Limitless:    ${limitless.length.toString().padStart(4)} markets`);
    console.log(`   ⚡ Thales:       ${thales.length.toString().padStart(4)} speed markets`);
    console.log(`   🎲 SX Bet:       ${sxbet.length.toString().padStart(4)} markets`);
    console.log('─'.repeat(50));
    console.log(`   📊 TOTAL:        ${total.toString().padStart(4)} live markets\n`);

    return { total, byPlatform };
  }

  /**
   * Get or create user portfolio
   */
  getPortfolio(address: string, initialBalance = 1000): UserPortfolio {
    if (!this.portfolios.has(address)) {
      this.portfolios.set(address, {
        address,
        balance: initialBalance,
        totalDeposited: initialBalance,
        activeBets: [],
        history: [],
        stats: { totalBets: 0, wins: 0, losses: 0, totalWagered: 0, totalWon: 0, pnl: 0, roi: 0, winRate: 0 }
      });
    }
    return this.portfolios.get(address)!;
  }

  /**
   * Place a simulated bet on a real market
   */
  async placeBet(
    userAddress: string,
    marketId: string,
    outcomeId: string,
    amount: number
  ): Promise<{ success: boolean; bet?: SimulatedBet; error?: string }> {
    const portfolio = this.getPortfolio(userAddress);
    const market = this.markets.get(marketId);

    if (!market) return { success: false, error: `Market ${marketId} not found` };
    if (market.status !== 'open') return { success: false, error: `Market is ${market.status}` };
    if (amount > portfolio.balance) return { success: false, error: `Insufficient balance: $${portfolio.balance.toFixed(2)}` };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    const outcome = market.outcomes.find(o => o.id === outcomeId);
    if (!outcome) return { success: false, error: `Outcome ${outcomeId} not found` };

    const bet: SimulatedBet = {
      id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: market.platform,
      marketId,
      marketTitle: market.title,
      outcomeId,
      outcomeName: outcome.name,
      amount,
      odds: outcome.odds,
      potentialPayout: amount * outcome.odds,
      placedAt: new Date(),
      status: 'pending',
    };

    portfolio.balance -= amount;
    portfolio.activeBets.push(bet);
    portfolio.stats.totalBets++;
    portfolio.stats.totalWagered += amount;

    console.log(`\n✅ BET PLACED on REAL ${market.platform.toUpperCase()} market:`);
    console.log(`   Market:    ${market.title}`);
    console.log(`   Outcome:   ${outcome.name}`);
    console.log(`   Amount:    $${amount.toFixed(2)} @ ${outcome.odds.toFixed(2)}x`);
    console.log(`   Potential: $${bet.potentialPayout.toFixed(2)}`);
    console.log(`   Resolves:  ${market.resolvesAt?.toLocaleString() || 'When event ends'}`);

    return { success: true, bet };
  }

  /**
   * Start auto-resolution monitor
   */
  startResolutionMonitor(): void {
    if (this.resolutionInterval) return;

    console.log('\n🔍 Starting resolution monitor for ALL platforms...');

    this.resolutionInterval = setInterval(async () => {
      await this.checkAllResolutions();
    }, CONFIG.RESOLUTION_CHECK_INTERVAL);
  }

  stopResolutionMonitor(): void {
    if (this.resolutionInterval) {
      clearInterval(this.resolutionInterval);
      this.resolutionInterval = undefined;
    }
  }

  /**
   * Check all pending bets for resolution
   */
  private async checkAllResolutions(): Promise<void> {
    for (const [address, portfolio] of this.portfolios) {
      for (const bet of [...portfolio.activeBets]) {
        const resolution = await this.checkBetResolution(bet);
        if (resolution.resolved) {
          this.resolveBet(address, bet.id, resolution.won!, resolution.realOutcome!);
        }
      }
    }
  }

  /**
   * Check if a specific bet's market has resolved
   */
  private async checkBetResolution(bet: SimulatedBet): Promise<{ resolved: boolean; won?: boolean; realOutcome?: string }> {
    const market = this.markets.get(bet.marketId);
    if (!market) return { resolved: false };

    let result: { resolved: boolean; winner?: string } = { resolved: false };

    switch (bet.platform) {
      case 'dreamdex': {
        const epoch = parseInt(bet.marketId.replace('ps-', ''));
        const round = await fetchDreamDEXRound(epoch);
        if (round?.oracleCalled && round.winner) {
          result = { resolved: true, winner: round.winner };
        }
        break;
      }

      case 'polymarket': {
        const conditionId = bet.marketId.replace('pm-', '');
        result = await checkPolymarketResolution(conditionId);
        break;
      }

      case 'overtime': {
        const gameId = bet.marketId.replace('ot-', '');
        const networkId = (market.metadata.networkId as number) || 10;
        result = await checkOvertimeResolution(gameId, networkId);
        break;
      }

      case 'azuro': {
        const parts = bet.marketId.replace('az-', '').split('-');
        const chain = parts[0];
        const gameId = parts.slice(1).join('-');
        result = await checkAzuroResolution(gameId, chain);
        break;
      }

      case 'limitless': {
        const slug = bet.marketId.replace('lm-', '');
        result = await checkLimitlessResolution(slug);
        break;
      }

      case 'thales': {
        result = await checkThalesResolution(bet.marketId, market.metadata);
        break;
      }

      case 'sxbet': {
        const marketHash = (market.metadata.marketHash as string) || '';
        result = await checkSXBetResolution(marketHash);
        break;
      }
    }

    if (result.resolved && result.winner) {
      return { resolved: true, won: bet.outcomeId === result.winner, realOutcome: result.winner };
    }

    return { resolved: false };
  }

  /**
   * Resolve a bet with real outcome
   */
  private resolveBet(address: string, betId: string, won: boolean, realOutcome: string): void {
    const portfolio = this.portfolios.get(address);
    if (!portfolio) return;

    const idx = portfolio.activeBets.findIndex(b => b.id === betId);
    if (idx === -1) return;

    const bet = portfolio.activeBets[idx];
    bet.status = won ? 'won' : 'lost';
    bet.resolvedAt = new Date();
    bet.realOutcome = realOutcome;
    bet.payout = won ? bet.potentialPayout : 0;

    if (won) {
      portfolio.balance += bet.payout;
      portfolio.stats.wins++;
      portfolio.stats.totalWon += bet.payout;
    } else {
      portfolio.stats.losses++;
    }

    portfolio.stats.pnl = portfolio.stats.totalWon - portfolio.stats.totalWagered;
    portfolio.stats.roi = portfolio.stats.totalWagered > 0 ? (portfolio.stats.pnl / portfolio.stats.totalWagered) * 100 : 0;
    portfolio.stats.winRate = portfolio.stats.totalBets > 0 ? (portfolio.stats.wins / portfolio.stats.totalBets) * 100 : 0;

    portfolio.activeBets.splice(idx, 1);
    portfolio.history.push(bet);

    const emoji = won ? '🎉' : '😢';
    console.log(`\n${emoji} BET RESOLVED with REAL ${bet.platform.toUpperCase()} outcome:`);
    console.log(`   Market:      ${bet.marketTitle}`);
    console.log(`   Your Bet:    ${bet.outcomeName}`);
    console.log(`   Real Result: ${realOutcome.toUpperCase()}`);
    console.log(`   Status:      ${won ? 'WON' : 'LOST'}`);
    console.log(`   Payout:      $${(bet.payout || 0).toFixed(2)}`);
  }

  /**
   * Display all open markets
   */
  displayMarkets(platform?: Platform, limit = 10): void {
    const markets = Array.from(this.markets.values())
      .filter(m => m.status === 'open' && (!platform || m.platform === platform))
      .slice(0, limit);

    const title = platform ? platform.toUpperCase() : 'ALL PLATFORMS';
    console.log('\n' + '═'.repeat(80));
    console.log(`  📊 LIVE MARKETS - ${title}`);
    console.log('═'.repeat(80));

    for (const m of markets) {
      console.log(`\n  [${m.platform.toUpperCase()}] ${m.title}`);
      console.log(`  ID: ${m.marketId}`);
      console.log(`  Resolves: ${m.resolvesAt?.toLocaleString() || 'TBD'}`);
      console.log('  OUTCOMES:');
      for (const o of m.outcomes) {
        console.log(`    • ${o.id.padEnd(8)} ${o.name.padEnd(30)} @ ${o.odds.toFixed(2)}x (${(o.impliedProb * 100).toFixed(1)}%)`);
      }
    }

    console.log('\n' + '═'.repeat(80));
  }

  /**
   * Display user portfolio
   */
  displayPortfolio(address: string): void {
    const p = this.getPortfolio(address);

    console.log('\n' + '═'.repeat(60));
    console.log(`  👤 PORTFOLIO: ${address.slice(0, 12)}...`);
    console.log('═'.repeat(60));
    console.log(`  Balance:       $${p.balance.toFixed(2)}`);
    console.log(`  Active Bets:   ${p.activeBets.length}`);
    console.log(`  Total Wagered: $${p.stats.totalWagered.toFixed(2)}`);
    console.log(`  Total Won:     $${p.stats.totalWon.toFixed(2)}`);
    console.log(`  P&L:           ${p.stats.pnl >= 0 ? '+' : ''}$${p.stats.pnl.toFixed(2)}`);
    console.log(`  Win Rate:      ${p.stats.winRate.toFixed(1)}%`);
    console.log(`  ROI:           ${p.stats.roi.toFixed(2)}%`);

    if (p.activeBets.length > 0) {
      console.log('\n  ACTIVE BETS:');
      for (const b of p.activeBets) {
        console.log(`    • [${b.platform}] ${b.outcomeName} @ ${b.odds.toFixed(2)}x`);
        console.log(`      Stake: $${b.amount} → Potential: $${b.potentialPayout.toFixed(2)}`);
      }
    }

    console.log('═'.repeat(60) + '\n');
  }

  /**
   * Get all open markets for a platform
   */
  getOpenMarkets(platform?: Platform): LiveMarket[] {
    return Array.from(this.markets.values())
      .filter(m => m.status === 'open' && (!platform || m.platform === platform));
  }
}

// ===========================================
// DEMO
// ===========================================

async function runFullDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    🎯 ALL 7 PLATFORMS - LIVE BETTING SYSTEM                                 ║
║                                                                              ║
║    Place SIMULATED bets on REAL markets from:                               ║
║    1. DreamDEX   - STT price prediction (5-min rounds)                   ║
║    2. Polymarket    - Politics, crypto, world events                        ║
║    3. Overtime      - NFL, NBA, Soccer, MMA                                 ║
║    4. Azuro         - Decentralized sports betting                          ║
║    5. Limitless     - Short-term predictions                                ║
║    6. Thales        - BTC/ETH speed markets (15min-24hr)                    ║
║    7. SX Bet        - P2P sports exchange                                   ║
║                                                                              ║
║    All bets resolve based on ACTUAL REAL market outcomes!                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const system = new AllPlatformsLiveBetting();

  // Fetch all markets
  const { byPlatform } = await system.fetchAllMarkets();

  // Show samples from each platform
  for (const [platform, markets] of Object.entries(byPlatform)) {
    if (markets.length > 0) {
      system.displayMarkets(platform as Platform, 3);
    }
  }

  // Demo user
  const user = '0xDemoUser';
  system.getPortfolio(user, 1000);

  console.log('\n💰 PLACING BETS ON ALL AVAILABLE PLATFORMS...\n');

  // Place bets on each platform that has markets
  for (const [platform, markets] of Object.entries(byPlatform)) {
    const openMarkets = markets.filter(m => m.status === 'open');
    if (openMarkets.length > 0) {
      const market = openMarkets[0];
      const outcome = market.outcomes[0];
      const amount = 25 + Math.floor(Math.random() * 50);

      await system.placeBet(user, market.marketId, outcome.id, amount);
    }
  }

  system.displayPortfolio(user);

  console.log('\n🔍 Resolution monitor ready. Run:');
  console.log('   system.startResolutionMonitor()');
  console.log('\nBets will auto-resolve when REAL markets close with REAL outcomes.\n');

  return system;
}

// Exports
export {
  fetchDreamDEXMarkets,
  fetchPolymarketMarkets,
  fetchOvertimeMarkets,
  fetchAzuroMarkets,
  fetchLimitlessMarkets,
  fetchThalesMarkets,
  fetchSXBetMarkets,
  runFullDemo,
};

if (require.main === module) {
  runFullDemo().catch(console.error);
}
