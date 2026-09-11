/**
 * Azuro Protocol Fetcher with Pagination
 *
 * Fetches sports betting markets from Azuro subgraphs
 * Supports multiple chains: Polygon, Gnosis, Arbitrum
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const AZURO_SUBGRAPHS = {
  live: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-live-data-feed',
  polygon: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  gnosis: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
};

const PAGE_SIZE = 100;

export class AzuroFetcher extends BasePlatformFetcher {
  platform = 'azuro';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, 100);
    const skip = cursor ? parseInt(cursor) : 0;

    // Query games with Created status (active betting markets)
    const query = `
      query GetGames($first: Int!, $skip: Int!) {
        games(
          first: $first
          skip: $skip
          where: { status: Created }
          orderBy: startsAt
          orderDirection: asc
        ) {
          id
          gameId
          startsAt
          status
          sport { name slug }
          league { name slug country { name } }
          participants { name image }
          conditions(first: 5, where: { status: Created }) {
            conditionId
            status
            turnover
            outcomes { outcomeId }
          }
        }
      }
    `;

    // Fetch from all chains in parallel
    const allMarkets: UnifiedMarket[] = [];

    for (const [chain, subgraphUrl] of Object.entries(AZURO_SUBGRAPHS)) {
      try {
        const response = await fetch(subgraphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: { first: pageSize, skip },
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) continue;

        const result = await response.json();
        if (result.errors) {
          console.error(`[Azuro] ${chain} query error:`, result.errors[0]?.message);
          continue;
        }

        const games = result.data?.games || [];

        for (const g of games) {
          const market = this.transformGame(g, chain);
          if (market) allMarkets.push(market);
        }
      } catch (error: any) {
        console.error(`[Azuro] ${chain} fetch error:`, error.message);
      }
    }

    // Sort by start time
    allMarkets.sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0));

    const hasMore = allMarkets.length >= pageSize;
    const nextCursor = hasMore ? String(skip + pageSize) : undefined;

    return {
      data: allMarkets,
      hasMore,
      nextCursor,
    };
  }

  private transformGame(game: any, chain: string): UnifiedMarket | null {
    if (!game) return null;

    const participants = game.participants?.map((p: any) => p.name) || [];
    const title = participants.length >= 2
      ? `${participants[0]} vs ${participants[1]}`
      : game.league?.name || 'Unknown Match';

    // Calculate total volume from conditions
    const totalTurnover = game.conditions?.reduce((sum: number, c: any) => {
      return sum + (parseFloat(c.turnover) || 0);
    }, 0) || 0;
    const volume = totalTurnover / 1e6; // Convert from wei

    const outcomes = [
      { id: 'home', name: participants[0] || 'Home', probability: 33, odds: 3 },
      { id: 'away', name: participants[1] || 'Away', probability: 33, odds: 3 },
      { id: 'draw', name: 'Draw', probability: 34, odds: 2.94 },
    ];

    return {
      id: normalizeMarketId(this.platform, `${chain}-${game.gameId}`),
      platform: this.platform,
      externalId: game.gameId,
      title,
      question: title,
      category: game.sport?.name || 'Sports',
      outcomes,
      status: 'open',
      yesPrice: 0.33,
      noPrice: 0.33,
      volume,
      expiresAt: parseInt(game.startsAt) * 1000,
      metadata: {
        gameId: game.gameId,
        sport: game.sport?.name,
        league: game.league?.name,
        country: game.league?.country?.name,
        participants,
        chain,
        conditionsCount: game.conditions?.length || 0,
      },
      chain: chain === 'live' ? 'Multi-chain' : chain.charAt(0).toUpperCase() + chain.slice(1),
      currency: chain === 'gnosis' ? 'xDAI' : 'USDC',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new AzuroFetcher());
export const azuroFetcher = new AzuroFetcher();
