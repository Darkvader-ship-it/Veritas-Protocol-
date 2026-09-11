/**
 * Backtesting Engine
 *
 * Simulates historical copy trading performance to answer:
 * "What if I had copied Trader X for the past N months?"
 */

import { config } from '../core/config.js';
import { db } from '../core/database.js';
import { blockchain } from '../core/blockchain.js';
import { backtestLogger as logger } from '../core/logger.js';
import * as ss from 'simple-statistics';
import type {
  BacktestSettings,
  BacktestResult,
  BacktestTrade,
  MonthlyReturn,
  Bet,
  RoundInfo,
} from '../types/index.js';

// ===========================================
// Backtesting Engine Class
// ===========================================

export class BacktestingEngine {
  private roundCache: Map<number, RoundInfo> = new Map();

  constructor() {
    logger.info('Backtesting Engine initialized');
  }

  // ===========================================
  // Main Backtest Function
  // ===========================================

  async runBacktest(settings: BacktestSettings): Promise<BacktestResult> {
    logger.info('Starting backtest', {
      leader: settings.leader.slice(0, 10),
      period: `${settings.startDate.toISOString().split('T')[0]} to ${settings.endDate.toISOString().split('T')[0]}`,
      allocation: `${(settings.allocationPercent * 100).toFixed(0)}%`,
    });

    // Check cache first
    const cached = await db.getCachedBacktest(
      settings.leader,
      settings.startDate,
      settings.endDate,
      settings
    );

    if (cached) {
      logger.info('Returning cached backtest result');
      return cached;
    }

    // Fetch historical bets
    const historicalBets = await this.fetchHistoricalBets(
      settings.leader,
      settings.startDate,
      settings.endDate
    );

    if (historicalBets.length === 0) {
      throw new Error('No historical bets found for this leader in the specified period');
    }

    logger.info(`Found ${historicalBets.length} historical bets`);

    // Simulate trades
    const trades = await this.simulateTrades(historicalBets, settings);

    // Calculate metrics
    const result = this.calculateMetrics(trades, settings);

    // Cache result
    await db.cacheBacktest(settings.leader, settings.startDate, settings.endDate, settings, result);

    logger.info('Backtest complete', {
      totalReturn: `${(result.totalReturn * 100).toFixed(2)}%`,
      winRate: `${(result.winRate * 100).toFixed(1)}%`,
      trades: result.totalTrades,
    });

    return result;
  }

  // ===========================================
  // Data Fetching
  // ===========================================

  private async fetchHistoricalBets(
    leader: string,
    startDate: Date,
    endDate: Date
  ): Promise<Bet[]> {
    // Fetch from database
    const allBets = await db.getTraderBets(leader, 'dreamdex', 10000);

    // Filter by date range
    return allBets.filter(
      (bet) => bet.timestamp >= startDate && bet.timestamp <= endDate
    );
  }

  private async getRoundOutcome(epoch: number): Promise<RoundInfo | null> {
    // Check cache
    if (this.roundCache.has(epoch)) {
      return this.roundCache.get(epoch)!;
    }

    try {
      const round = await blockchain.getRoundInfo(epoch);

      if (round.oracleCalled) {
        this.roundCache.set(epoch, round);
        return round;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ===========================================
  // Trade Simulation
  // ===========================================

  private async simulateTrades(
    bets: Bet[],
    settings: BacktestSettings
  ): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];
    let portfolioValue = settings.initialCapital;
    let peakValue = settings.initialCapital;

    for (const bet of bets) {
      // Get round outcome
      const round = await this.getRoundOutcome(bet.epoch);

      if (!round || !round.oracleCalled) {
        continue; // Skip unresolved rounds
      }

      // Calculate copy amount
      let copyAmount: number;

      if (settings.compounding) {
        copyAmount = portfolioValue * settings.allocationPercent;
      } else {
        copyAmount = settings.initialCapital * settings.allocationPercent;
      }

      // Apply max bet limit
      copyAmount = Math.min(copyAmount, settings.maxBetSize);

      // Can't bet more than portfolio
      copyAmount = Math.min(copyAmount, portfolioValue);

      if (copyAmount <= 0) {
        continue;
      }

      // Determine outcome
      const bullWins = round.bullWins!;
      const won = (bet.isBull && bullWins) || (!bet.isBull && !bullWins);

      // Calculate PnL (assuming ~1.9x payout minus 3% fee)
      const pnl = won ? copyAmount * 0.9 : -copyAmount;

      // Update portfolio
      portfolioValue += pnl;

      // Update peak for drawdown tracking
      peakValue = Math.max(peakValue, portfolioValue);

      // Check stop loss
      if (settings.stopLossPercent) {
        const drawdown = (peakValue - portfolioValue) / peakValue;
        if (drawdown >= settings.stopLossPercent) {
          logger.info('Stop loss triggered', { drawdown: `${(drawdown * 100).toFixed(1)}%` });
          break;
        }
      }

      trades.push({
        epoch: bet.epoch,
        timestamp: bet.timestamp,
        leaderBet: {
          amount: bet.amount,
          isBull: bet.isBull,
        },
        copyAmount,
        won,
        pnl,
        portfolioValueAfter: portfolioValue,
      });
    }

    return trades;
  }

  // ===========================================
  // Metrics Calculation
  // ===========================================

  private calculateMetrics(trades: BacktestTrade[], settings: BacktestSettings): BacktestResult {
    if (trades.length === 0) {
      return this.emptyResult(settings);
    }

    // Basic stats
    const wins = trades.filter((t) => t.won);
    const losses = trades.filter((t) => !t.won);
    const winRate = wins.length / trades.length;

    // PnL calculations
    const pnls = trades.map((t) => t.pnl);
    const totalPnL = pnls.reduce((sum, pnl) => sum + pnl, 0);
    const finalValue = trades[trades.length - 1].portfolioValueAfter;
    const totalReturn = (finalValue - settings.initialCapital) / settings.initialCapital;

    // Average win/loss
    const avgWin = wins.length > 0 ? ss.mean(wins.map((t) => t.pnl)) : 0;
    const avgLoss = losses.length > 0 ? Math.abs(ss.mean(losses.map((t) => t.pnl))) : 0;

    // Profit factor
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Expectancy (expected value per trade)
    const expectancy = ss.mean(pnls);

    // Max Drawdown
    const { maxDrawdown, maxDrawdownDate } = this.calculateMaxDrawdown(trades);

    // Risk-adjusted returns
    const returns = this.calculateReturns(trades);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const sortinoRatio = this.calculateSortinoRatio(returns);
    const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

    // Time analysis
    const monthlyReturns = this.calculateMonthlyReturns(trades, settings.initialCapital);
    const profitableMonths = monthlyReturns.filter((m) => m.return > 0).length;

    // Annualized return
    const daysDiff = (settings.endDate.getTime() - settings.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysDiff) - 1;

    return {
      settings,
      trades,

      totalReturn,
      annualizedReturn,
      maxDrawdown,
      maxDrawdownDate,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,

      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,

      monthlyReturns,
      bestMonth: monthlyReturns.reduce((best, m) => (m.return > best.return ? m : best), monthlyReturns[0]),
      worstMonth: monthlyReturns.reduce((worst, m) => (m.return < worst.return ? m : worst), monthlyReturns[0]),
      profitableMonths,

      vsBuyAndHold: 0, // Would need price data
      vsMarketAverage: 0, // Would need benchmark

      finalPortfolioValue: finalValue,
      totalPnL,
    };
  }

  private calculateMaxDrawdown(trades: BacktestTrade[]): { maxDrawdown: number; maxDrawdownDate: Date } {
    let peak = trades[0]?.portfolioValueAfter || 0;
    let maxDrawdown = 0;
    let maxDrawdownDate = trades[0]?.timestamp || new Date();

    for (const trade of trades) {
      if (trade.portfolioValueAfter > peak) {
        peak = trade.portfolioValueAfter;
      }

      const drawdown = (peak - trade.portfolioValueAfter) / peak;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDate = trade.timestamp;
      }
    }

    return { maxDrawdown, maxDrawdownDate };
  }

  private calculateReturns(trades: BacktestTrade[]): number[] {
    const returns: number[] = [];

    for (let i = 1; i < trades.length; i++) {
      const prevValue = trades[i - 1].portfolioValueAfter;
      const currValue = trades[i].portfolioValueAfter;
      returns.push((currValue - prevValue) / prevValue);
    }

    return returns;
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate = 0): number {
    if (returns.length < 2) return 0;

    const meanReturn = ss.mean(returns);
    const stdDev = ss.standardDeviation(returns);

    if (stdDev === 0) return 0;

    // Annualize (assuming ~2880 5-minute rounds per day, 365 days)
    const periodsPerYear = 2880 * 365;
    const annualizedMean = meanReturn * periodsPerYear;
    const annualizedStd = stdDev * Math.sqrt(periodsPerYear);

    return (annualizedMean - riskFreeRate) / annualizedStd;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate = 0): number {
    if (returns.length < 2) return 0;

    const meanReturn = ss.mean(returns);
    const negativeReturns = returns.filter((r) => r < 0);

    if (negativeReturns.length === 0) return meanReturn > 0 ? Infinity : 0;

    const downside = Math.sqrt(ss.mean(negativeReturns.map((r) => r * r)));

    if (downside === 0) return 0;

    return (meanReturn - riskFreeRate) / downside;
  }

  private calculateMonthlyReturns(trades: BacktestTrade[], initialCapital: number): MonthlyReturn[] {
    const monthlyData: Map<string, { startValue: number; endValue: number; trades: number; wins: number }> = new Map();

    let currentMonth = '';
    let monthStartValue = initialCapital;

    for (const trade of trades) {
      const month = trade.timestamp.toISOString().slice(0, 7); // YYYY-MM

      if (month !== currentMonth) {
        if (currentMonth && monthlyData.has(currentMonth)) {
          const data = monthlyData.get(currentMonth)!;
          data.endValue = trades.find(
            (t) => t.timestamp.toISOString().slice(0, 7) === currentMonth
          )?.portfolioValueAfter || monthStartValue;
        }

        currentMonth = month;
        monthStartValue = trade.portfolioValueAfter - trade.pnl;

        if (!monthlyData.has(month)) {
          monthlyData.set(month, {
            startValue: monthStartValue,
            endValue: trade.portfolioValueAfter,
            trades: 0,
            wins: 0,
          });
        }
      }

      const data = monthlyData.get(month)!;
      data.trades++;
      if (trade.won) data.wins++;
      data.endValue = trade.portfolioValueAfter;
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      return: (data.endValue - data.startValue) / data.startValue,
      trades: data.trades,
      winRate: data.trades > 0 ? data.wins / data.trades : 0,
    }));
  }

  private emptyResult(settings: BacktestSettings): BacktestResult {
    return {
      settings,
      trades: [],
      totalReturn: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      maxDrawdownDate: new Date(),
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      monthlyReturns: [],
      bestMonth: { month: '', return: 0, trades: 0, winRate: 0 },
      worstMonth: { month: '', return: 0, trades: 0, winRate: 0 },
      profitableMonths: 0,
      vsBuyAndHold: 0,
      vsMarketAverage: 0,
      finalPortfolioValue: settings.initialCapital,
      totalPnL: 0,
    };
  }

  // ===========================================
  // Public API
  // ===========================================

  async compareStrategies(strategies: BacktestSettings[]): Promise<BacktestResult[]> {
    return Promise.all(strategies.map((s) => this.runBacktest(s)));
  }

  clearCache(): void {
    this.roundCache.clear();
  }
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new BacktestingEngine();

  // Example backtest
  const settings: BacktestSettings = {
    leader: process.argv[2] || '0x0000000000000000000000000000000000000000',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
    initialCapital: 1, // 1 STT
    allocationPercent: 0.1, // 10% per trade
    maxBetSize: 0.1, // Max 0.1 STT
    compounding: true,
  };

  engine
    .runBacktest(settings)
    .then((result) => {
      console.log('\nBacktest Results:');
      console.log('================');
      console.log(`Total Return: ${(result.totalReturn * 100).toFixed(2)}%`);
      console.log(`Win Rate: ${(result.winRate * 100).toFixed(1)}%`);
      console.log(`Total Trades: ${result.totalTrades}`);
      console.log(`Max Drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
      console.log(`Final Portfolio: ${result.finalPortfolioValue.toFixed(4)} STT`);
    })
    .catch((error) => {
      logger.error('Backtest failed', error);
      process.exit(1);
    });
}

export default BacktestingEngine;
