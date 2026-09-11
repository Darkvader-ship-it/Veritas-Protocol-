/**
 * Trend Detector
 * Detects hot topics across all 12 platforms by analyzing market titles
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import { events } from '../core/event-stream.js';
import type {
  Platform,
  TrendingTopic,
  PlatformPresence,
  MarketSummary,
} from '../types/index.js';
import { ALL_PLATFORMS, PLATFORM_CATEGORIES } from '../types/index.js';

// Frontend API base URL
const FRONTEND_API_BASE = process.env.FRONTEND_API_URL || 'http://localhost:3000';

// Polling intervals
const TREND_POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

// Topic extraction settings
const MIN_TOPIC_LENGTH = 3;
const MIN_MARKETS_FOR_TREND = 2;
const MIN_VOLUME_FOR_TREND = 100;

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'before', 'end', 'win', 'yes', 'price', 'market', 'bet', 'odds', 'will',
  'happen', 'reach', 'above', 'below', 'between', 'more', 'less', 'over', 'under',
  'during', 'by', 'vs', 'versus',
]);

// Topic aliases for normalization
const TOPIC_ALIASES: Record<string, string[]> = {
  'trump': ['donald trump', 'trump 2024', 'president trump', 'djt'],
  'biden': ['joe biden', 'president biden'],
  'bitcoin': ['btc', 'bitcoin price'],
  'ethereum': ['eth', 'ether', 'ethereum price'],
  'election': ['presidential election', 'us election', '2024 election', '2025 election'],
  'fed': ['federal reserve', 'interest rate', 'rate cut', 'fomc'],
  'ai': ['artificial intelligence', 'openai', 'chatgpt', 'gpt'],
  'crypto': ['cryptocurrency', 'cryptocurrencies'],
};

interface Market {
  id: string;
  platform: Platform;
  title: string;
  question?: string;
  volume?: number;
  volume24h?: number;
  yesPrice?: number;
  probability?: number;
  status?: string;
  category?: string;
}

interface TopicData {
  topic: string;
  normalizedTopic: string;
  markets: Market[];
  totalVolume: number;
  platforms: Set<Platform>;
}

export class TrendDetector {
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private previousTopics: Map<string, TrendingTopic> = new Map();
  private topicCache: Map<string, TopicData> = new Map();

  constructor() {
    logger.info('Trend Detector initialized', { bot: 'trend-detector' });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trend Detector already running', { bot: 'trend-detector' });
      return;
    }

    this.isRunning = true;
    logger.info('Starting Trend Detector...', { bot: 'trend-detector' });

    // Initial poll
    await this.detectTrends();

    // Set up recurring poll
    this.pollTimer = setInterval(() => {
      this.detectTrends();
    }, TREND_POLL_INTERVAL);

    logger.info('Trend Detector running', { bot: 'trend-detector' });
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info('Trend Detector stopped', { bot: 'trend-detector' });
  }

  async detectTrends(): Promise<TrendingTopic[]> {
    const startTime = Date.now();

    try {
      logger.info('Detecting trends...', { bot: 'trend-detector' });

      // Fetch all markets
      const markets = await this.fetchAllMarkets();
      logger.info(`Fetched ${markets.length} markets`, { bot: 'trend-detector' });

      if (markets.length === 0) {
        return [];
      }

      // Extract and cluster topics
      this.topicCache.clear();
      for (const market of markets) {
        this.extractTopicsFromMarket(market);
      }

      // Calculate trend scores
      const topics = this.calculateTrendScores();

      // Save to database
      const saved = await this.saveTopics(topics);

      // Emit events for new/updated trends
      this.emitTrendEvents(topics);

      const elapsed = Date.now() - startTime;
      logger.info(`Detected ${topics.length} trends in ${elapsed}ms`, {
        bot: 'trend-detector',
        marketCount: markets.length,
        topicCount: topics.length,
        saved,
      });

      return topics;

    } catch (error) {
      logger.error('Failed to detect trends', error as Error, { bot: 'trend-detector' });
      return [];
    }
  }

  private async fetchAllMarkets(): Promise<Market[]> {
    const allMarkets: Market[] = [];

    // Try unified markets endpoint first
    try {
      const url = `${FRONTEND_API_BASE}/api/all-markets?status=open&limit=1000`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const markets = (data.data || data.markets || data || []) as any[];
        return markets.map((m: any) => ({
          id: m.id || m.externalId,
          platform: m.platform,
          title: m.title || m.question,
          volume: m.volume || 0,
          volume24h: m.volume24h || 0,
          yesPrice: m.yesPrice || m.probability,
          status: m.status,
          category: m.category,
        }));
      }
    } catch (error) {
      logger.warn('Failed to fetch unified markets, falling back to per-platform', {
        bot: 'trend-detector',
      });
    }

    // Fall back to per-platform fetching
    for (const platform of ALL_PLATFORMS) {
      try {
        const url = `${FRONTEND_API_BASE}/api/${platform}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json() as Record<string, unknown>;
          const markets = (data.data || data.markets || data || []) as any[];

          for (const m of markets) {
            allMarkets.push({
              id: m.id || m.externalId || m.conditionId,
              platform,
              title: m.title || m.question || m.name,
              volume: m.volume || m.totalVolume || 0,
              volume24h: m.volume24h || 0,
              yesPrice: m.yesPrice || m.probability,
              status: m.status,
              category: m.category || m.sport,
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch markets from ${platform}`, {
          bot: 'trend-detector',
          platform,
        });
      }
    }

    return allMarkets;
  }

  private extractTopicsFromMarket(market: Market): void {
    const title = market.title || '';
    if (!title || title.length < MIN_TOPIC_LENGTH) return;

    // Extract keywords from title
    const keywords = this.extractKeywords(title);

    for (const keyword of keywords) {
      const normalized = this.normalizeTopic(keyword);
      if (!normalized) continue;

      if (!this.topicCache.has(normalized)) {
        this.topicCache.set(normalized, {
          topic: keyword,
          normalizedTopic: normalized,
          markets: [],
          totalVolume: 0,
          platforms: new Set(),
        });
      }

      const data = this.topicCache.get(normalized)!;
      data.markets.push(market);
      data.totalVolume += market.volume || 0;
      data.platforms.add(market.platform);
    }
  }

  private extractKeywords(title: string): string[] {
    const keywords: string[] = [];

    // Clean and tokenize
    const cleaned = title
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract single words
    const words = cleaned.split(' ')
      .filter(w => w.length >= MIN_TOPIC_LENGTH)
      .filter(w => !STOP_WORDS.has(w))
      .filter(w => !/^\d+$/.test(w)); // Filter pure numbers

    keywords.push(...words);

    // Extract named entities (capitalized phrases in original)
    const entityRegex = /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g;
    const entities = title.match(entityRegex) || [];
    for (const entity of entities) {
      if (entity.length >= MIN_TOPIC_LENGTH) {
        keywords.push(entity.toLowerCase());
      }
    }

    // Extract quoted phrases
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(title)) !== null) {
      if (match[1].length >= MIN_TOPIC_LENGTH) {
        keywords.push(match[1].toLowerCase());
      }
    }

    return [...new Set(keywords)]; // Dedupe
  }

  private normalizeTopic(topic: string): string | null {
    let normalized = topic.toLowerCase().trim();

    // Skip if too short
    if (normalized.length < MIN_TOPIC_LENGTH) return null;

    // Skip if it's a stop word
    if (STOP_WORDS.has(normalized)) return null;

    // Check aliases
    for (const [canonical, aliases] of Object.entries(TOPIC_ALIASES)) {
      if (normalized === canonical || aliases.includes(normalized)) {
        return canonical;
      }
    }

    // Remove common suffixes
    normalized = normalized
      .replace(/['']s$/, '')  // Remove possessives
      .replace(/s$/, '');     // Simple depluralization

    return normalized.length >= MIN_TOPIC_LENGTH ? normalized : null;
  }

  private calculateTrendScores(): TrendingTopic[] {
    const topics: TrendingTopic[] = [];
    const now = new Date();

    for (const [normalized, data] of this.topicCache.entries()) {
      // Skip topics with too few markets
      if (data.markets.length < MIN_MARKETS_FOR_TREND) continue;

      // Skip topics with too little volume
      if (data.totalVolume < MIN_VOLUME_FOR_TREND) continue;

      // Calculate score
      const volumeScore = Math.min(data.totalVolume / 10000, 40); // Max 40 points
      const marketScore = Math.min(data.markets.length * 4, 20);  // Max 20 points
      const platformScore = Math.min(data.platforms.size * 5, 25); // Max 25 points (5 platforms)

      // Volume velocity (compare to previous)
      let velocity = 0;
      const previous = this.previousTopics.get(normalized);
      if (previous) {
        const volumeDiff = data.totalVolume - previous.totalVolume;
        const timeDiff = (now.getTime() - previous.lastUpdated.getTime()) / (1000 * 60); // minutes
        velocity = timeDiff > 0 ? volumeDiff / timeDiff : 0;
      }
      const velocityScore = Math.min(Math.max(velocity, 0) / 100, 15); // Max 15 points

      const totalScore = volumeScore + marketScore + platformScore + velocityScore;

      // Build platform presence
      const platformPresence: PlatformPresence[] = [];
      const platformMarkets = new Map<Platform, Market[]>();

      for (const market of data.markets) {
        if (!platformMarkets.has(market.platform)) {
          platformMarkets.set(market.platform, []);
        }
        platformMarkets.get(market.platform)!.push(market);
      }

      for (const [platform, markets] of platformMarkets.entries()) {
        const platformVolume = markets.reduce((sum, m) => sum + (m.volume || 0), 0);
        const topMarkets: MarketSummary[] = markets
          .sort((a, b) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 3)
          .map(m => ({
            id: m.id,
            title: m.title,
            probability: m.yesPrice || 0.5,
            volume: m.volume || 0,
          }));

        platformPresence.push({
          platform,
          marketCount: markets.length,
          volume: platformVolume,
          topMarkets,
        });
      }

      // Determine category
      const category = this.determineCategory(data.markets);

      const topic: TrendingTopic = {
        topic: data.topic,
        normalizedTopic: normalized,
        score: Math.round(totalScore * 100) / 100,
        velocity: Math.round(velocity * 100) / 100,
        totalVolume: data.totalVolume,
        totalMarkets: data.markets.length,
        category,
        platforms: platformPresence.sort((a, b) => b.volume - a.volume),
        firstSeen: previous?.firstSeen || now,
        lastUpdated: now,
      };

      topics.push(topic);
      this.previousTopics.set(normalized, topic);
    }

    // Sort by score
    topics.sort((a, b) => b.score - a.score);

    return topics.slice(0, 100); // Top 100 trends
  }

  private determineCategory(markets: Market[]): string {
    const categoryCounts = new Map<string, number>();

    for (const market of markets) {
      const category = market.category || PLATFORM_CATEGORIES[market.platform] || 'other';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }

    let maxCategory = 'other';
    let maxCount = 0;
    for (const [category, count] of categoryCounts.entries()) {
      if (count > maxCount) {
        maxCategory = category;
        maxCount = count;
      }
    }

    return maxCategory;
  }

  private async saveTopics(topics: TrendingTopic[]): Promise<number> {
    let saved = 0;

    for (const topic of topics) {
      try {
        await db.saveTrendingTopic(topic);
        saved++;
      } catch (error) {
        logger.error('Failed to save trending topic', error as Error, {
          bot: 'trend-detector',
          topic: topic.topic,
        });
      }
    }

    return saved;
  }

  private emitTrendEvents(topics: TrendingTopic[]): void {
    for (const topic of topics) {
      const previous = this.previousTopics.get(topic.normalizedTopic);

      if (!previous) {
        // New trend detected
        events.emitTrendDetected(topic);
      } else if (topic.score > previous.score * 1.1) {
        // Significant score increase
        events.emitTrendUpdated(topic);
      }
    }
  }

  // ===========================================
  // Public API
  // ===========================================

  getStats(): object {
    return {
      isRunning: this.isRunning,
      cachedTopics: this.topicCache.size,
      trackedTopics: this.previousTopics.size,
    };
  }

  async getTrendingTopics(limit = 50): Promise<TrendingTopic[]> {
    return db.getTrendingTopics(limit);
  }

  async getTopicDetails(topic: string): Promise<TrendingTopic | null> {
    const normalized = this.normalizeTopic(topic);
    if (!normalized) return null;
    return db.getTrendingTopicByNormalized(normalized);
  }

  // Force refresh
  async refresh(): Promise<TrendingTopic[]> {
    return this.detectTrends();
  }
}

// Singleton export
export const trendDetector = new TrendDetector();
