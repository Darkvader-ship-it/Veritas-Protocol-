/**
 * Metaculus Fetcher with Pagination
 *
 * Fetches forecasting questions from Metaculus
 * Uses offset-based pagination
 */

import {
  BasePlatformFetcher,
  PaginatedResult,
  UnifiedMarket,
  registerPlatformFetcher,
  normalizeMarketId,
} from '../market-fetcher';

const METACULUS_API = 'https://www.metaculus.com/api2';
const PAGE_SIZE = 100;

export class MetaculusFetcher extends BasePlatformFetcher {
  platform = 'metaculus';

  async fetchPage(cursor?: string, limit?: number): Promise<PaginatedResult<UnifiedMarket>> {
    const pageSize = Math.min(limit || PAGE_SIZE, 100);
    const offset = cursor ? parseInt(cursor) : 0;

    // Fetch open binary questions
    const url = `${METACULUS_API}/questions/?limit=${pageSize}&offset=${offset}&status=open&type=binary&order_by=-activity`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Metaculus API error: ${response.status}`);
    }

    const result = await response.json();
    const rawQuestions = result.results || [];
    const totalCount = result.count;

    // API already filters by type=binary and status=open, no need to filter again
    const markets: UnifiedMarket[] = rawQuestions
      .map((q: any) => this.transformQuestion(q));

    const hasMore = offset + rawQuestions.length < totalCount;
    const nextCursor = hasMore ? String(offset + pageSize) : undefined;

    return {
      data: markets,
      hasMore,
      nextCursor,
      totalCount,
    };
  }

  private transformQuestion(q: any): UnifiedMarket {
    // Get prediction from aggregations if available
    const aggregation = q.question?.aggregations?.recency_weighted?.latest;
    const prediction = aggregation?.centers?.[0] ?? 0.5;
    const yesPrice = prediction;
    const noPrice = 1 - prediction;

    // Determine category from projects
    let category = 'General';
    const projects = q.projects;
    if (projects?.question_series?.[0]?.name) {
      category = projects.question_series[0].name;
    } else if (projects?.leaderboard_tag?.[0]?.name) {
      category = projects.leaderboard_tag[0].name;
    }

    const questionId = q.id || q.question?.id;
    const closeTime = q.scheduled_close_time || q.question?.scheduled_close_time;
    const resolveTime = q.scheduled_resolve_time || q.question?.scheduled_resolve_time;

    return {
      id: normalizeMarketId(this.platform, String(questionId)),
      platform: this.platform,
      externalId: String(questionId),
      title: q.title || q.question?.title,
      question: q.title || q.question?.title,
      description: q.question?.description?.slice(0, 500) || q.description?.slice(0, 500),
      category,
      outcomes: [
        { id: 'yes', name: 'Yes', probability: yesPrice * 100, odds: yesPrice > 0.01 ? 1 / yesPrice : 100 },
        { id: 'no', name: 'No', probability: noPrice * 100, odds: noPrice > 0.01 ? 1 / noPrice : 100 },
      ],
      status: q.status === 'open' || q.question?.status === 'open' ? 'open' : 'closed',
      yesPrice,
      noPrice,
      volume: q.forecasts_count || q.nr_forecasters || 0, // Use forecasts count as proxy for activity
      closesAt: closeTime ? new Date(closeTime).getTime() : undefined,
      expiresAt: resolveTime ? new Date(resolveTime).getTime() : undefined,
      metadata: {
        url: `https://www.metaculus.com/questions/${questionId}`,
        author: q.author_username,
        created: q.created_at,
        forecastsCount: q.forecasts_count,
        commentCount: q.comment_count,
        slug: q.slug,
      },
      chain: 'Off-chain',
      currency: 'Points',
      fetchedAt: Date.now(),
    };
  }
}

registerPlatformFetcher(new MetaculusFetcher());
export const metaculusFetcher = new MetaculusFetcher();
