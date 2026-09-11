/**
 * RUN FULL SIMULATION
 *
 * Complete betting simulation across all 7 prediction market platforms
 * with real market data, exact bet mechanics, and portfolio tracking
 *
 * Run with: npx tsx run-simulation.ts
 */

import { RealMarketsSimulator, RealMarket, Platform } from './index';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m',
  bgYellow: '\x1b[43m',
};

// Betting strategy configuration per platform
interface BettingStrategy {
  platform: Platform;
  enabled: boolean;
  maxBetsPerPlatform: number;
  betSizeRange: [number, number];
  preferHigherOdds: boolean;
  maxOdds: number;
  minImpliedProb: number;
}

const STRATEGIES: BettingStrategy[] = [
  {
    platform: 'dreamdex',
    enabled: true,
    maxBetsPerPlatform: 2,
    betSizeRange: [25, 75],
    preferHigherOdds: false,  // Bet on higher probability side
    maxOdds: 3.0,
    minImpliedProb: 0.35,
  },
  {
    platform: 'polymarket',
    enabled: true,
    maxBetsPerPlatform: 3,
    betSizeRange: [50, 150],
    preferHigherOdds: true,  // Look for value
    maxOdds: 5.0,
    minImpliedProb: 0.25,
  },
  {
    platform: 'overtime',
    enabled: true,
    maxBetsPerPlatform: 2,
    betSizeRange: [30, 100],
    preferHigherOdds: false,
    maxOdds: 2.5,
    minImpliedProb: 0.40,
  },
  {
    platform: 'azuro',
    enabled: true,
    maxBetsPerPlatform: 2,
    betSizeRange: [40, 120],
    preferHigherOdds: false,
    maxOdds: 2.5,
    minImpliedProb: 0.40,
  },
  {
    platform: 'limitless',
    enabled: true,
    maxBetsPerPlatform: 2,
    betSizeRange: [25, 75],
    preferHigherOdds: true,
    maxOdds: 4.0,
    minImpliedProb: 0.30,
  },
  {
    platform: 'thales',
    enabled: true,
    maxBetsPerPlatform: 3,
    betSizeRange: [20, 60],
    preferHigherOdds: false,  // 50/50 markets, random choice
    maxOdds: 2.0,
    minImpliedProb: 0.45,
  },
  {
    platform: 'sxbet',
    enabled: true,
    maxBetsPerPlatform: 2,
    betSizeRange: [30, 90],
    preferHigherOdds: false,
    maxOdds: 2.5,
    minImpliedProb: 0.40,
  },
];

function printBanner() {
  console.clear();
  console.log(`
${COLORS.magenta}${COLORS.bold}
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██████╗ ███████╗ █████╗ ██╗         ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗   ║
║   ██╔══██╗██╔════╝██╔══██╗██║         ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝   ║
║   ██████╔╝█████╗  ███████║██║         ██╔████╔██║███████║██████╔╝█████╔╝    ║
║   ██╔══██╗██╔══╝  ██╔══██║██║         ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗    ║
║   ██║  ██║███████╗██║  ██║███████╗    ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗   ║
║   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ║
║                                                                              ║
║       🎯 FULL SIMULATION - 7 PLATFORMS - REAL ODDS - EXACT BETS 🎯          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
${COLORS.reset}`);
}

function getRandomBetSize(range: [number, number]): number {
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

function selectOutcome(market: RealMarket, strategy: BettingStrategy): { outcomeId: string; outcome: { id: string; name: string; odds: number; impliedProb: number } } | null {
  const validOutcomes = market.outcomes.filter(o =>
    o.odds <= strategy.maxOdds &&
    o.impliedProb >= strategy.minImpliedProb
  );

  if (validOutcomes.length === 0) return null;

  // Sort by odds (higher odds = more value but riskier)
  validOutcomes.sort((a, b) => strategy.preferHigherOdds
    ? b.odds - a.odds  // Prefer higher odds
    : a.odds - b.odds  // Prefer safer bets
  );

  const selected = validOutcomes[0];
  return { outcomeId: selected.id, outcome: selected };
}

async function runSimulation() {
  printBanner();

  console.log(`${COLORS.cyan}Initializing simulation with $1,000 starting balance...${COLORS.reset}\n`);

  const simulator = new RealMarketsSimulator(undefined, undefined, 1000);

  // Step 1: Fetch all real markets
  console.log(`${COLORS.bold}STEP 1: Fetching Real Markets${COLORS.reset}`);
  console.log(`${'─'.repeat(50)}\n`);

  const allMarkets = await simulator.fetchAllMarkets();

  // Step 2: Display market summary per platform
  console.log(`\n${COLORS.bold}STEP 2: Market Analysis${COLORS.reset}`);
  console.log(`${'─'.repeat(50)}\n`);

  const platformSummary: Record<Platform, { count: number; avgOdds: number; avgVolume: number }> = {} as any;

  for (const [platform, markets] of Object.entries(allMarkets) as [Platform, RealMarket[]][]) {
    if (markets.length === 0) continue;

    const avgOdds = markets.reduce((sum, m) =>
      sum + m.outcomes.reduce((s, o) => s + o.odds, 0) / m.outcomes.length, 0) / markets.length;
    const avgVolume = markets.reduce((sum, m) => sum + m.volume, 0) / markets.length;

    platformSummary[platform] = { count: markets.length, avgOdds, avgVolume };

    const emoji = {
      dreamdex: '🥞',
      polymarket: '🔮',
      overtime: '⚽',
      azuro: '🎰',
      limitless: '∞',
      thales: '⚡',
      sxbet: '🎲'
    }[platform];

    console.log(`${emoji} ${COLORS.bold}${platform.toUpperCase()}${COLORS.reset}`);
    console.log(`   Markets: ${markets.length} | Avg Odds: ${avgOdds.toFixed(2)}x | Avg Volume: $${avgVolume.toLocaleString()}`);

    // Show top 2 markets
    for (const market of markets.slice(0, 2)) {
      console.log(`   ${COLORS.dim}├─ ${market.title.slice(0, 50)}${market.title.length > 50 ? '...' : ''}${COLORS.reset}`);
      for (const o of market.outcomes.slice(0, 2)) {
        console.log(`   ${COLORS.dim}│  • ${o.name}: ${o.odds.toFixed(2)}x (${(o.impliedProb * 100).toFixed(0)}%)${COLORS.reset}`);
      }
    }
    console.log();
  }

  // Step 3: Place simulated bets according to strategies
  console.log(`\n${COLORS.bold}STEP 3: Placing Simulated Bets${COLORS.reset}`);
  console.log(`${'─'.repeat(50)}\n`);

  const betsPlaced: { platform: Platform; market: string; outcome: string; amount: number; odds: number }[] = [];

  for (const strategy of STRATEGIES) {
    if (!strategy.enabled) continue;

    const markets = allMarkets[strategy.platform];
    if (!markets || markets.length === 0) continue;

    console.log(`\n${COLORS.bgBlue}${COLORS.bold} ${strategy.platform.toUpperCase()} BETTING ${COLORS.reset}`);
    console.log(`Strategy: ${strategy.preferHigherOdds ? 'Value hunting' : 'Safe bets'} | Max odds: ${strategy.maxOdds}x\n`);

    let betsForPlatform = 0;

    for (const market of markets) {
      if (betsForPlatform >= strategy.maxBetsPerPlatform) break;
      if (market.status !== 'open') continue;

      const selection = selectOutcome(market, strategy);
      if (!selection) continue;

      const betSize = getRandomBetSize(strategy.betSizeRange);

      const bet = await simulator.placeBet(market.id, selection.outcomeId, betSize);

      if (bet) {
        betsPlaced.push({
          platform: strategy.platform,
          market: market.title,
          outcome: selection.outcome.name,
          amount: betSize,
          odds: selection.outcome.odds,
        });
        betsForPlatform++;
      }
    }

    if (betsForPlatform === 0) {
      console.log(`   ${COLORS.yellow}No suitable markets found for this strategy${COLORS.reset}`);
    }
  }

  // Step 4: Display all bets placed
  console.log(`\n\n${COLORS.bold}STEP 4: Bets Summary${COLORS.reset}`);
  console.log(`${'─'.repeat(70)}\n`);

  console.log(`${COLORS.bgGreen}${COLORS.bold} ${betsPlaced.length} BETS PLACED ACROSS ${Object.keys(platformSummary).length} PLATFORMS ${COLORS.reset}\n`);

  let totalStaked = 0;
  let totalPotentialPayout = 0;

  console.log(`${'─'.repeat(100)}`);
  console.log(`| ${'Platform'.padEnd(12)} | ${'Market'.padEnd(35)} | ${'Outcome'.padEnd(20)} | ${'Stake'.padStart(8)} | ${'Odds'.padStart(6)} | ${'Payout'.padStart(10)} |`);
  console.log(`${'─'.repeat(100)}`);

  for (const bet of betsPlaced) {
    const payout = bet.amount * bet.odds;
    totalStaked += bet.amount;
    totalPotentialPayout += payout;

    console.log(`| ${bet.platform.padEnd(12)} | ${bet.market.slice(0, 35).padEnd(35)} | ${bet.outcome.slice(0, 20).padEnd(20)} | $${bet.amount.toString().padStart(6)} | ${bet.odds.toFixed(2).padStart(5)}x | $${payout.toFixed(2).padStart(8)} |`);
  }

  console.log(`${'─'.repeat(100)}`);
  console.log(`| ${'TOTAL'.padEnd(12)} | ${''.padEnd(35)} | ${''.padEnd(20)} | $${totalStaked.toString().padStart(6)} |       | $${totalPotentialPayout.toFixed(2).padStart(8)} |`);
  console.log(`${'─'.repeat(100)}\n`);

  // Step 5: Simulate random resolutions
  console.log(`\n${COLORS.bold}STEP 5: Simulating Market Resolutions${COLORS.reset}`);
  console.log(`${'─'.repeat(50)}\n`);

  const portfolio = simulator.getPortfolio();
  const activeBets = [...portfolio.activeBets];

  // Simulate outcomes based on implied probability
  let wins = 0, losses = 0;
  let totalPayout = 0;

  console.log(`${COLORS.yellow}Simulating outcomes based on implied probabilities...${COLORS.reset}\n`);

  for (const bet of activeBets) {
    // Get the market to check implied probability
    const market = simulator.getMarket(bet.marketId);
    const outcome = market?.outcomes.find(o => o.id === bet.outcomeId);

    // Win probability is the implied probability (with some randomness)
    const winProb = outcome?.impliedProb || 0.5;
    const won = Math.random() < winProb;

    simulator.resolveBet(bet.id, won);

    if (won) {
      wins++;
      totalPayout += bet.potentialPayout;
      console.log(`${COLORS.green}✓ WON${COLORS.reset} [${bet.platform}] ${bet.outcomeName} @ ${bet.odds.toFixed(2)}x → +$${(bet.potentialPayout - bet.amount).toFixed(2)}`);
    } else {
      losses++;
      console.log(`${COLORS.red}✗ LOST${COLORS.reset} [${bet.platform}] ${bet.outcomeName} @ ${bet.odds.toFixed(2)}x → -$${bet.amount.toFixed(2)}`);
    }
  }

  // Step 6: Final Portfolio State
  console.log(`\n\n${COLORS.bold}STEP 6: Final Results${COLORS.reset}`);
  console.log(`${'═'.repeat(60)}\n`);

  const finalPortfolio = simulator.getPortfolio();

  const pnl = finalPortfolio.pnl.realized;
  const pnlColor = pnl >= 0 ? COLORS.green : COLORS.red;
  const pnlSign = pnl >= 0 ? '+' : '';

  console.log(`
${COLORS.bold}╔════════════════════════════════════════════════════════════╗${COLORS.reset}
${COLORS.bold}║                    SIMULATION RESULTS                       ║${COLORS.reset}
${COLORS.bold}╠════════════════════════════════════════════════════════════╣${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Starting Balance:     $1,000.00                          ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Final Balance:        ${COLORS.bold}$${finalPortfolio.totalValue.toFixed(2).padEnd(10)}${COLORS.reset}                      ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Total P&L:            ${pnlColor}${pnlSign}$${pnl.toFixed(2).padEnd(10)}${COLORS.reset}                      ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  ROI:                  ${pnlColor}${pnlSign}${finalPortfolio.stats.roi.toFixed(2)}%${COLORS.reset}                             ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}╠════════════════════════════════════════════════════════════╣${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Total Bets:           ${finalPortfolio.stats.totalBets}                                ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Wins:                 ${COLORS.green}${finalPortfolio.stats.wins}${COLORS.reset}                                ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Losses:               ${COLORS.red}${finalPortfolio.stats.losses}${COLORS.reset}                                ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Win Rate:             ${(finalPortfolio.stats.winRate * 100).toFixed(1)}%                             ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}║${COLORS.reset}  Avg Odds:             ${finalPortfolio.stats.avgOdds.toFixed(2)}x                              ${COLORS.bold}║${COLORS.reset}
${COLORS.bold}╚════════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  // Platform breakdown
  console.log(`${COLORS.bold}Platform Breakdown:${COLORS.reset}\n`);

  const platformStats: Record<Platform, { bets: number; wins: number; staked: number; pnl: number }> = {} as any;

  for (const bet of finalPortfolio.closedBets) {
    if (!platformStats[bet.platform]) {
      platformStats[bet.platform] = { bets: 0, wins: 0, staked: 0, pnl: 0 };
    }
    platformStats[bet.platform].bets++;
    platformStats[bet.platform].staked += bet.amount;
    if (bet.status === 'won') {
      platformStats[bet.platform].wins++;
      platformStats[bet.platform].pnl += (bet.payout || 0) - bet.amount;
    } else {
      platformStats[bet.platform].pnl -= bet.amount;
    }
  }

  for (const [platform, stats] of Object.entries(platformStats)) {
    const winRate = (stats.wins / stats.bets * 100).toFixed(0);
    const pnlStr = stats.pnl >= 0 ? `${COLORS.green}+$${stats.pnl.toFixed(2)}${COLORS.reset}` : `${COLORS.red}-$${Math.abs(stats.pnl).toFixed(2)}${COLORS.reset}`;

    console.log(`  ${platform.padEnd(12)} │ Bets: ${stats.bets} │ Win Rate: ${winRate}% │ P&L: ${pnlStr}`);
  }

  console.log(`\n${COLORS.dim}${'═'.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}Simulation complete! All bets were simulated using REAL market data.${COLORS.reset}`);
  console.log(`${COLORS.dim}${'═'.repeat(60)}${COLORS.reset}\n`);

  return { portfolio: finalPortfolio, betsPlaced, allMarkets };
}

// Run simulation
runSimulation().catch(console.error);
