/**
 * Cross-Platform Signals
 * Generates consensus signals when the same topic appears on multiple platforms
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import { events } from '../core/event-stream.js';
import type {
  Platform,
  CrossPlatformSignal,
  CrossConsensus,
  PlatformSignal,
  TrendingTopic,
} from '../types/index.js';

// Polling interval
const SIGNAL_POLL_INTERVAL = 30 * 1000; // 30 seconds

// Signal thresholds
const MIN_PLATFORMS_FOR_SIGNAL = 2;
const MIN_CONFIDENCE = 20;
const STRONG_THRESHOLD = 75;
const LEAN_THRESHOLD = 55;

export class CrossPlatformSignals {
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('Cross-Platform Signals initialized', { bot: 'cross-signals' });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Cross-Platform Signals already running', { bot: 'cross-signals' });
      return;
    }

    this.isRunning = true;
    logger.info('Starting Cross-Platform Signals...', { bot: 'cross-signals' });

    // Initial detection
    await this.detectSignals();

    // Set up recurring detection
    this.pollTimer = setInterval(() => {
      this.detectSignals();
    }, SIGNAL_POLL_INTERVAL);

    logger.info('Cross-Platform Signals running', { bot: 'cross-signals' });
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info('Cross-Platform Signals stopped', { bot: 'cross-signals' });
  }

  async detectSignals(): Promise<CrossPlatformSignal[]> {
    const startTime = Date.now();

    try {
      // Get trending topics that appear on multiple platforms
      const topics = await db.getTrendingTopics(100);

      const multiPlatformTopics = topics.filter(
        t => t.platforms && t.platforms.length >= MIN_PLATFORMS_FOR_SIGNAL
      );

      logger.info(`Found ${multiPlatformTopics.length} cross-platform topics`, {
        bot: 'cross-signals',
        total: topics.length,
        multiPlatform: multiPlatformTopics.length,
      });

      const signals: CrossPlatformSignal[] = [];

      for (const topic of multiPlatformTopics) {
        const signal = await this.generateSignalForTopic(topic);
        if (signal) {
          signals.push(signal);
        }
      }

      // Save and emit signals
      for (const signal of signals) {
        try {
          await db.saveCrossPlatformSignal(signal);
          events.emitCrossSignal(signal);
        } catch (error) {
          logger.error('Failed to save cross-platform signal', error as Error, {
            bot: 'cross-signals',
            topic: signal.topic,
          });
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info(`Generated ${signals.length} cross-platform signals in ${elapsed}ms`, {
        bot: 'cross-signals',
        signalCount: signals.length,
      });

      return signals;

    } catch (error) {
      logger.error('Failed to detect cross-platform signals', error as Error, {
        bot: 'cross-signals',
      });
      return [];
    }
  }

  private async generateSignalForTopic(topic: TrendingTopic): Promise<CrossPlatformSignal | null> {
    if (!topic.platforms || topic.platforms.length < MIN_PLATFORMS_FOR_SIGNAL) {
      return null;
    }

    // Aggregate probabilities and build platform signals
    const platformSignals: PlatformSignal[] = [];
    let totalWeightedProb = 0;
    let totalVolume = 0;

    for (const presence of topic.platforms) {
      if (!presence.topMarkets || presence.topMarkets.length === 0) continue;

      // Use the highest volume market for this topic on this platform
      const topMarket = presence.topMarkets[0];

      const platformSignal: PlatformSignal = {
        platform: presence.platform,
        marketId: topMarket.id,
        marketTitle: topMarket.title,
        probability: topMarket.probability || 0.5,
        volume: topMarket.volume || 0,
        topTradersBullish: 0, // Would need leaderboard data to calculate
        confidence: this.calculatePlatformConfidence(topMarket.volume, presence.marketCount),
      };

      platformSignals.push(platformSignal);

      // Weight probability by volume
      totalWeightedProb += platformSignal.probability * (topMarket.volume || 1);
      totalVolume += topMarket.volume || 1;
    }

    if (platformSignals.length < MIN_PLATFORMS_FOR_SIGNAL || totalVolume === 0) {
      return null;
    }

    // Calculate volume-weighted probability
    const volumeWeightedProbability = totalWeightedProb / totalVolume;

    // Calculate confidence based on volume and agreement
    const confidence = this.calculateConfidence(platformSignals, volumeWeightedProbability);

    if (confidence < MIN_CONFIDENCE) {
      return null;
    }

    // Determine consensus
    const consensus = this.determineConsensus(volumeWeightedProbability, confidence);

    const signal: CrossPlatformSignal = {
      topic: topic.topic,
      normalizedTopic: topic.normalizedTopic,
      consensus,
      confidence,
      volumeWeightedProbability,
      smartMoneyAgreement: 0, // Would need trader data to calculate
      platforms: platformSignals,
      totalVolume,
      marketCount: topic.totalMarkets,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
    };

    return signal;
  }

  private calculatePlatformConfidence(volume: number, marketCount: number): number {
    // Higher volume and more markets = higher confidence
    const volumeScore = Math.min(Math.log10(Math.max(volume, 1) + 1) * 20, 50);
    const marketScore = Math.min(marketCount * 10, 50);
    return Math.round(volumeScore + marketScore);
  }

  private calculateConfidence(
    platforms: PlatformSignal[],
    avgProbability: number
  ): number {
    // Base confidence from probability deviation from 50%
    const deviationFromUncertain = Math.abs(avgProbability - 0.5) * 2;
    const deviationScore = deviationFromUncertain * 40;

    // Agreement score - how similar are probabilities across platforms
    let totalDeviation = 0;
    for (const p of platforms) {
      totalDeviation += Math.abs(p.probability - avgProbability);
    }
    const avgDeviation = totalDeviation / platforms.length;
    const agreementScore = Math.max(0, 30 - avgDeviation * 60);

    // Platform count bonus
    const platformBonus = Math.min(platforms.length * 10, 30);

    return Math.round(deviationScore + agreementScore + platformBonus);
  }

  private determineConsensus(probability: number, confidence: number): CrossConsensus {
    const yesPercent = probability * 100;

    if (confidence >= 60) {
      if (yesPercent >= STRONG_THRESHOLD) return 'STRONG_YES';
      if (yesPercent <= (100 - STRONG_THRESHOLD)) return 'STRONG_NO';
    }

    if (yesPercent >= LEAN_THRESHOLD) return 'LEAN_YES';
    if (yesPercent <= (100 - LEAN_THRESHOLD)) return 'LEAN_NO';

    return 'MIXED';
  }

  // ===========================================
  // Public API
  // ===========================================

  getStats(): object {
    return {
      isRunning: this.isRunning,
    };
  }

  async getSignals(limit = 50): Promise<CrossPlatformSignal[]> {
    return db.getCrossPlatformSignals(limit);
  }

  async getSignalByTopic(topic: string): Promise<CrossPlatformSignal | null> {
    const normalized = topic.toLowerCase().trim();
    return db.getCrossPlatformSignalByTopic(normalized);
  }

  async getStrongestSignals(limit = 10): Promise<CrossPlatformSignal[]> {
    const signals = await db.getCrossPlatformSignals(100);

    // Filter for strong signals and sort by confidence
    return signals
      .filter(s => s.consensus === 'STRONG_YES' || s.consensus === 'STRONG_NO')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  // Force refresh
  async refresh(): Promise<CrossPlatformSignal[]> {
    return this.detectSignals();
  }
}

// Singleton export
export const crossPlatformSignals = new CrossPlatformSignals();
