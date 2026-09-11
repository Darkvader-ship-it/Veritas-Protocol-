// @ts-nocheck
import axios from 'axios';
import { config } from '../config';
import { PolymarketMarket, PolymarketEvent } from '../types';

export class PolymarketService {
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheDuration = 60 * 1000; // 1 minute

  constructor() {
    this.baseUrl = config.polymarket.apiUrl;
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > this.cacheDuration;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getTrendingMarkets(limit: number = 10): Promise<PolymarketMarket[]> {
    const cacheKey = `trending:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: { active: true, limit: 50, enableOrderBook: true },
      });

      const markets: PolymarketMarket[] = response.data;
      const trending = markets
        .sort((a, b) => b.volumeNum - a.volumeNum)
        .slice(0, limit);

      this.setCache(cacheKey, trending);
      return trending;
    } catch (error) {
      console.error('Error fetching trending markets:', error);
      throw error;
    }
  }

  async getActiveMarkets(limit: number = 20): Promise<PolymarketMarket[]> {
    const cacheKey = `active:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/markets`, {
        params: { active: true, archived: false, limit },
      });

      const markets: PolymarketMarket[] = response.data;
      this.setCache(cacheKey, markets);
      return markets;
    } catch (error) {
      console.error('Error fetching active markets:', error);
      throw error;
    }
  }

  async getMarket(marketId: string): Promise<PolymarketMarket | null> {
    const cacheKey = `market:${marketId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseUrl}/markets/${marketId}`);
      const market: PolymarketMarket = response.data;
      this.setCache(cacheKey, market);
      return market;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      console.error(`Error fetching market ${marketId}:`, error);
      throw error;
    }
  }

  async searchMarkets(query: string, limit: number = 10): Promise<PolymarketMarket[]> {
    try {
      const markets = await this.getActiveMarkets(100);
      const lowerQuery = query.toLowerCase();

      return markets
        .filter(market =>
          market.question.toLowerCase().includes(lowerQuery) ||
          market.description?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching markets:', error);
      throw error;
    }
  }

  formatMarketMessage(market: PolymarketMarket): string {
    const probabilities = market.outcomePrices.map(price => (parseFloat(price) * 100).toFixed(1));
    const volume = this.formatVolume(market.volumeNum);

    let message = `📊 **${market.question}**\n\n`;

    market.outcomes.forEach((outcome, index) => {
      const prob = probabilities[index];
      const emoji = parseFloat(prob) >= 50 ? '🟢' : '🔴';
      message += `${emoji} ${outcome}: **${prob}%**\n`;
    });

    message += `\n💰 Volume: $${volume}`;

    if (market.endDate) {
      const endDate = new Date(market.endDate);
      message += `\n⏰ Ends: ${endDate.toLocaleDateString()}`;
    }

    const status = market.archived ? '📦 Archived' : market.closed ? '🔒 Closed' : '✅ Active';
    message += `\n\n${status}`;

    return message;
  }

  private formatVolume(volume: number): string {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toFixed(0);
  }

  async detectPriceChanges(marketId: string, threshold: number = 5): Promise<boolean> {
    // This would require tracking price history
    // For now, return false - implement with database later
    return false;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const polymarketService = new PolymarketService();
