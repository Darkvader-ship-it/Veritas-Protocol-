/**
 * Anti-Gaming Detector Bot
 *
 * Detects manipulation attempts to protect VeritasScore integrity.
 * Monitors for wash trading, Sybil attacks, and statistical anomalies.
 */

import { config } from '../core/config.js';
import { db } from '../core/database.js';
import { events } from '../core/event-stream.js';
import { antiGamingLogger as logger } from '../core/logger.js';
import * as ss from 'simple-statistics';
import type {
  GamingAlert,
  WalletAnalysis,
  Bet,
  AlertType,
  AlertSeverity,
  RecommendedAction,
  GamingEvidence,
} from '../types/index.js';

// ===========================================
// Anti-Gaming Detector Class
// ===========================================

export class AntiGamingDetector {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private analyzedWallets: Map<string, WalletAnalysis> = new Map();

  constructor() {
    logger.info('Anti-Gaming Detector initialized');
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async start(): Promise<void> {
    logger.info('Starting Anti-Gaming Detector...');

    this.isRunning = true;

    // Susomniaribe to bet events
    events.onBetDetected(async (event) => {
      await this.analyzeBet(event.payload);
    });

    // Periodic full scan
    this.checkInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.runPeriodicScan();
    }, config.features.gamingCheckIntervalMs);

    logger.info('Anti-Gaming Detector running');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Anti-Gaming Detector...');

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('Anti-Gaming Detector stopped');
  }

  // ===========================================
  // Real-time Analysis
  // ===========================================

  private async analyzeBet(bet: Bet): Promise<void> {
    // Quick checks on individual bets
    const recentBets = await db.getTraderBets(bet.trader, bet.platform, 100);

    // Check for wash trading (betting both sides in same epoch)
    const washAlert = this.detectWashTrading(bet.trader, recentBets);
    if (washAlert) {
      await this.createAlert(washAlert);
    }
  }

  // ===========================================
  // Detection Algorithms
  // ===========================================

  /**
   * Detect wash trading: betting both sides in the same epoch
   */
  detectWashTrading(wallet: string, bets: Bet[]): GamingAlert | null {
    const epochBets = new Map<number, { bull: boolean; bear: boolean }>();

    for (const bet of bets) {
      const existing = epochBets.get(bet.epoch) || { bull: false, bear: false };
      if (bet.isBull) existing.bull = true;
      else existing.bear = true;
      epochBets.set(bet.epoch, existing);
    }

    const washEpochs = [...epochBets.entries()]
      .filter(([_, v]) => v.bull && v.bear)
      .map(([epoch, _]) => epoch);

    if (washEpochs.length >= config.features.washTradingThreshold) {
      return {
        type: 'WASH_TRADING',
        severity: 'CRITICAL',
        wallets: [wallet],
        evidence: {
          description: `Detected ${washEpochs.length} epochs with bets on both sides`,
          dataPoints: { washEpochCount: washEpochs.length },
          epochs: washEpochs.slice(0, 10),
        },
        recommendedAction: 'FLAG',
        status: 'pending',
        createdAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Detect Sybil clusters: coordinated betting from multiple wallets
   */
  async detectSybilCluster(recentBets: Bet[]): Promise<GamingAlert | null> {
    // Group bets by (epoch, isBull, ~amount, ~timestamp)
    const clusters: Map<string, Set<string>> = new Map();

    for (const bet of recentBets) {
      // Create cluster key: epoch + direction + rounded amount + rounded timestamp
      const amountBucket = Math.floor(Number(bet.amount) / 1e17); // 0.1 STT buckets
      const timeBucket = Math.floor(bet.timestamp.getTime() / 5000); // 5-second buckets
      const key = `${bet.epoch}-${bet.isBull}-${amountBucket}-${timeBucket}`;

      const cluster = clusters.get(key) || new Set();
      cluster.add(bet.trader);
      clusters.set(key, cluster);
    }

    // Find clusters with 3+ wallets
    for (const [key, wallets] of clusters) {
      if (wallets.size >= 3) {
        const [epoch, isBull] = key.split('-');

        return {
          type: 'SYBIL_CLUSTER',
          severity: 'WARNING',
          wallets: Array.from(wallets),
          evidence: {
            description: `${wallets.size} wallets placed similar bets within 5 seconds`,
            dataPoints: {
              clusterSize: wallets.size,
              epoch: parseInt(epoch),
              direction: isBull === 'true' ? 'BULL' : 'BEAR',
            },
            epochs: [parseInt(epoch)],
          },
          recommendedAction: 'INVESTIGATE',
          status: 'pending',
          createdAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect statistical anomalies: impossible win rates
   */
  detectStatisticalAnomaly(wallet: string, wins: number, total: number): GamingAlert | null {
    if (total < 50) return null; // Need enough samples

    const winRate = wins / total;
    const expectedRate = 0.5; // Random chance

    // Calculate z-score
    const stdDev = Math.sqrt((expectedRate * (1 - expectedRate)) / total);
    const zScore = (winRate - expectedRate) / stdDev;

    // z > 3.29 means < 0.1% chance of being random
    if (zScore > 3.29) {
      return {
        type: 'STATISTICAL_ANOMALY',
        severity: 'INFO',
        wallets: [wallet],
        evidence: {
          description: `Win rate of ${(winRate * 100).toFixed(1)}% is statistically improbable`,
          dataPoints: {
            winRate,
            totalBets: total,
            zScore,
            probabilityOfRandom: this.zScoreToProbability(zScore),
          },
        },
        recommendedAction: 'INVESTIGATE',
        status: 'pending',
        createdAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Detect collusion: wallets that always bet together
   */
  async detectCollusion(bets: Bet[]): Promise<GamingAlert | null> {
    // Build co-occurrence matrix
    const coOccurrence: Map<string, Map<string, number>> = new Map();

    // Group bets by epoch
    const betsByEpoch = new Map<number, Bet[]>();
    for (const bet of bets) {
      const epochBets = betsByEpoch.get(bet.epoch) || [];
      epochBets.push(bet);
      betsByEpoch.set(bet.epoch, epochBets);
    }

    // Count co-occurrences
    for (const [_, epochBets] of betsByEpoch) {
      const traders = epochBets.map((b) => b.trader);

      for (let i = 0; i < traders.length; i++) {
        for (let j = i + 1; j < traders.length; j++) {
          const key = [traders[i], traders[j]].sort().join('-');
          const pair = coOccurrence.get(traders[i]) || new Map();
          pair.set(traders[j], (pair.get(traders[j]) || 0) + 1);
          coOccurrence.set(traders[i], pair);
        }
      }
    }

    // Find highly correlated pairs (>80% co-occurrence)
    const totalEpochs = betsByEpoch.size;

    for (const [wallet1, pairs] of coOccurrence) {
      for (const [wallet2, count] of pairs) {
        const coOccurrenceRate = count / totalEpochs;

        if (coOccurrenceRate > 0.8 && count >= 20) {
          return {
            type: 'COLLUSION',
            severity: 'WARNING',
            wallets: [wallet1, wallet2],
            evidence: {
              description: `Wallets bet together in ${(coOccurrenceRate * 100).toFixed(0)}% of epochs`,
              dataPoints: {
                coOccurrenceRate,
                sharedEpochs: count,
                totalEpochs,
              },
            },
            recommendedAction: 'INVESTIGATE',
            status: 'pending',
            createdAt: new Date(),
          };
        }
      }
    }

    return null;
  }

  // ===========================================
  // Periodic Scanning
  // ===========================================

  private async runPeriodicScan(): Promise<void> {
    logger.debug('Running periodic anti-gaming scan...');

    try {
      // Get recent bets across all traders
      const recentBets = await db.getRecentBets('dreamdex', 60); // Last hour

      // Check for Sybil clusters
      const sybilAlert = await this.detectSybilCluster(recentBets);
      if (sybilAlert) {
        await this.createAlert(sybilAlert);
      }

      // Check for collusion
      const collusionAlert = await this.detectCollusion(recentBets);
      if (collusionAlert) {
        await this.createAlert(collusionAlert);
      }

      // Check top traders for anomalies
      const topTraders = await db.getTopTraders(50);

      for (const trader of topTraders) {
        const anomalyAlert = this.detectStatisticalAnomaly(
          trader.address,
          trader.wins,
          trader.totalBets
        );

        if (anomalyAlert) {
          await this.createAlert(anomalyAlert);
        }
      }
    } catch (error) {
      logger.error('Periodic scan failed', error as Error);
    }
  }

  // ===========================================
  // Alert Management
  // ===========================================

  private async createAlert(alert: GamingAlert): Promise<void> {
    // Check for duplicate recent alerts
    const pendingAlerts = await db.getPendingAlerts();
    const isDuplicate = pendingAlerts.some(
      (existing) =>
        existing.type === alert.type &&
        existing.wallets.some((w) => alert.wallets.includes(w)) &&
        Date.now() - existing.createdAt.getTime() < 24 * 60 * 60 * 1000 // Within 24 hours
    );

    if (isDuplicate) {
      logger.debug('Skipping duplicate alert', { type: alert.type });
      return;
    }

    // Save alert
    const alertId = await db.saveAlert(alert);
    alert.id = alertId;

    // Emit event
    events.emitAlertCreated(alert);

    logger.warn(`Gaming alert created`, {
      id: alertId,
      type: alert.type,
      severity: alert.severity,
      wallets: alert.wallets.length,
    });
  }

  // ===========================================
  // Full Wallet Analysis
  // ===========================================

  async analyzeWallet(address: string): Promise<WalletAnalysis> {
    logger.info(`Analyzing wallet: ${address.slice(0, 10)}...`);

    const bets = await db.getTraderBets(address, 'dreamdex', 1000);
    const alerts: GamingAlert[] = [];

    // Run all detection algorithms
    const washAlert = this.detectWashTrading(address, bets);
    if (washAlert) alerts.push(washAlert);

    const trader = await db.getTrader(address);
    if (trader) {
      const anomalyAlert = this.detectStatisticalAnomaly(
        address,
        trader.wins,
        trader.totalBets
      );
      if (anomalyAlert) alerts.push(anomalyAlert);
    }

    // Calculate risk scores
    const patterns = {
      washTradingScore: washAlert ? 100 : 0,
      sybilScore: 0, // Would need cross-wallet analysis
      anomalyScore: alerts.some((a) => a.type === 'STATISTICAL_ANOMALY') ? 50 : 0,
      collusionScore: 0, // Would need cross-wallet analysis
    };

    const riskScore = Math.min(
      100,
      patterns.washTradingScore * 0.4 +
        patterns.sybilScore * 0.3 +
        patterns.anomalyScore * 0.2 +
        patterns.collusionScore * 0.1
    );

    const analysis: WalletAnalysis = {
      address,
      riskScore,
      alerts,
      patterns,
      relatedWallets: [], // Would populate from collusion detection
      analysisTimestamp: new Date(),
    };

    this.analyzedWallets.set(address.toLowerCase(), analysis);

    return analysis;
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  private zScoreToProbability(z: number): number {
    // Approximate probability from z-score
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 1 - (0.5 * (1.0 + sign * y));
  }

  // ===========================================
  // Public API
  // ===========================================

  async getPendingAlerts(): Promise<GamingAlert[]> {
    return db.getPendingAlerts();
  }

  async dismissAlert(alertId: number, reviewedBy: string, notes?: string): Promise<void> {
    await db.updateAlertStatus(alertId, 'dismissed', reviewedBy, notes);
    logger.info(`Alert ${alertId} dismissed by ${reviewedBy}`);
  }

  async confirmAlert(alertId: number, reviewedBy: string, notes?: string): Promise<void> {
    await db.updateAlertStatus(alertId, 'confirmed', reviewedBy, notes);
    logger.info(`Alert ${alertId} confirmed by ${reviewedBy}`);
  }

  getStats(): object {
    return {
      isRunning: this.isRunning,
      analyzedWallets: this.analyzedWallets.size,
    };
  }
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const detector = new AntiGamingDetector();

  process.on('SIGINT', async () => {
    await detector.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await detector.stop();
    process.exit(0);
  });

  detector.start().catch((error) => {
    logger.error('Failed to start Anti-Gaming Detector', error);
    process.exit(1);
  });
}

export default AntiGamingDetector;
