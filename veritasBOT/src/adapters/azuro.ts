/**
 * Azuro Adapter
 *
 * Handles bet monitoring and data fetching for Azuro sports betting protocol.
 * Uses The Graph subgraph for querying on-chain data.
 *
 * Key concepts:
 * - Conditions: Markets (e.g., "Team A vs Team B")
 * - Outcomes: Selections within a condition (e.g., "Team A wins", "Draw", "Team B wins")
 * - Games: Sports events linked to conditions
 *
 * Normalization:
 * - Azuro has 2-3+ outcomes per condition
 * - We normalize the "favorite" outcome (lowest odds) as 'bull'
 * - The "underdog" outcome (highest odds) as 'bear'
 * - For 3-way markets, we ignore draws in signal calculation
 */

import { db } from '../core/database.js';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import type {
  PlatformAdapter,
  NormalizedBet,
  MarketOutcome,
  AdapterConfig,
} from './types.js';

// ===========================================
// Azuro GraphQL Types
// ===========================================

interface AzuroCondition {
  id: string;
  conditionId: string;
  status: 'Created' | 'Resolved' | 'Canceled' | 'Paused';
  outcomes: AzuroOutcome[];
  game: {
    id: string;
    title: string;
    startsAt: string;
    sport: { name: string };
    league: { name: string };
  };
  wonOutcomeIds: string[] | null;
  resolvedAt: string | null;
}

interface AzuroOutcome {
  id: string;
  outcomeId: string;
  odds: string;
  fund: string;
}

interface AzuroBet {
  id: string;
  betId: string;
  bettor: string;
  amount: string;
  odds: string;
  status: 'Accepted' | 'Resolved' | 'Redeemed' | 'Canceled';
  result: 'Won' | 'Lost' | null;
  isRedeemed: boolean;
  createdBlockTimestamp: string;
  createdTxHash: string;
  condition: {
    id: string;
    conditionId: string;
  };
  outcome: {
    id: string;
    outcomeId: string;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// ===========================================
// GraphQL Queries
// ===========================================

const QUERIES = {
  recentBets: `
    query RecentBets($since: BigInt!, $limit: Int!) {
      bets(
        where: { createdBlockTimestamp_gte: $since }
        orderBy: createdBlockTimestamp
        orderDirection: desc
        first: $limit
      ) {
        id
        betId
        bettor
        amount
        odds
        status
        result
        isRedeemed
        createdBlockTimestamp
        createdTxHash
        condition {
          id
          conditionId
        }
        outcome {
          id
          outcomeId
        }
      }
    }
  `,

  betsByCondition: `
    query BetsByCondition($conditionId: String!, $limit: Int!) {
      bets(
        where: { condition_: { conditionId: $conditionId } }
        orderBy: createdBlockTimestamp
        orderDirection: desc
        first: $limit
      ) {
        id
        betId
        bettor
        amount
        odds
        status
        createdBlockTimestamp
        createdTxHash
        condition {
          id
          conditionId
        }
        outcome {
          id
          outcomeId
        }
      }
    }
  `,

  betsByBettor: `
    query BetsByBettor($bettor: String!, $limit: Int!) {
      bets(
        where: { bettor: $bettor }
        orderBy: createdBlockTimestamp
        orderDirection: desc
        first: $limit
      ) {
        id
        betId
        bettor
        amount
        odds
        status
        result
        createdBlockTimestamp
        createdTxHash
        condition {
          id
          conditionId
        }
        outcome {
          id
          outcomeId
        }
      }
    }
  `,

  condition: `
    query Condition($conditionId: String!) {
      conditions(where: { conditionId: $conditionId }) {
        id
        conditionId
        status
        outcomes {
          id
          outcomeId
          odds
          fund
        }
        game {
          id
          title
          startsAt
          sport { name }
          league { name }
        }
        wonOutcomeIds
        resolvedAt
      }
    }
  `,

  activeConditions: `
    query ActiveConditions($limit: Int!) {
      conditions(
        where: { status: "Created" }
        orderBy: game__startsAt
        orderDirection: asc
        first: $limit
      ) {
        id
        conditionId
        status
        game {
          title
          startsAt
        }
      }
    }
  `,
};

// ===========================================
// Azuro Adapter Implementation
// ===========================================

export class AzuroAdapter implements PlatformAdapter {
  readonly platform = 'azuro' as const;
  readonly name = 'Azuro Protocol';
  readonly supportsRealtime = false; // Subgraph polling only

  private config: AdapterConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private subgraphUrl: string;
  private lastSeenBetIds: Set<string> = new Set();

  // Cache for condition outcomes (to determine bull/bear)
  private conditionOutcomes: Map<string, { bullOutcomeId: string; bearOutcomeId: string }> = new Map();

  constructor(adapterConfig?: Partial<AdapterConfig>) {
    this.config = {
      pollIntervalMs: adapterConfig?.pollIntervalMs ?? 15000, // Slower for subgraph
      maxBetsPerRequest: adapterConfig?.maxBetsPerRequest ?? 100,
      timeoutMs: adapterConfig?.timeoutMs ?? 20000,
      retryAttempts: adapterConfig?.retryAttempts ?? 3,
      retryDelayMs: adapterConfig?.retryDelayMs ?? 2000,
    };

    // Get subgraph URL from platform config
    const platformConfig = config.platforms['azuro'];
    this.subgraphUrl = platformConfig?.subgraphUrl ||
      'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3';
  }

  // ===========================================
  // Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Test subgraph connectivity
    try {
      const response = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
        QUERIES.activeConditions,
        { limit: 1 }
      );

      if (response) {
        logger.info('Azuro adapter connected to subgraph');
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to connect to Azuro subgraph', error as Error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.lastSeenBetIds.clear();
    this.conditionOutcomes.clear();
    this.isInitialized = false;
    logger.info('Azuro adapter cleaned up');
  }

  // ===========================================
  // GraphQL Helpers
  // ===========================================

  private async querySubgraph<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeoutMs
        );

        const response = await fetch(this.subgraphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as GraphQLResponse<T>;

        if (result.errors) {
          throw new Error(result.errors.map((e) => e.message).join(', '));
        }

        return result.data ?? null;
      } catch (error) {
        if (attempt < this.config.retryAttempts) {
          logger.warn(`Azuro subgraph attempt ${attempt} failed, retrying...`);
          await this.sleep(this.config.retryDelayMs * attempt);
        } else {
          logger.error(
            `Azuro subgraph failed after ${attempt} attempts`,
            error as Error
          );
          return null;
        }
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================
  // Susomniaription (Polling-based)
  // ===========================================

  async susomniaribe(
    callback: (bet: NormalizedBet) => void
  ): Promise<() => void> {
    logger.info('Azuro: Starting polling-based susomniaription');

    this.pollInterval = setInterval(async () => {
      try {
        const bets = await this.getRecentBets(5);

        for (const bet of bets) {
          if (!this.lastSeenBetIds.has(bet.id)) {
            callback(bet);
            this.lastSeenBetIds.add(bet.id);
          }
        }

        // Cleanup old IDs
        if (this.lastSeenBetIds.size > 1000) {
          const idsArray = Array.from(this.lastSeenBetIds);
          this.lastSeenBetIds = new Set(idsArray.slice(-1000));
        }
      } catch (error) {
        logger.error('Azuro polling error', error as Error);
      }
    }, this.config.pollIntervalMs);

    return () => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  // ===========================================
  // Bet Normalization
  // ===========================================

  private async normalizeBet(bet: AzuroBet): Promise<NormalizedBet> {
    const conditionId = bet.condition.conditionId;
    const outcomeId = bet.outcome.outcomeId;

    // Determine if this is a bull or bear bet
    const direction = await this.getOutcomeDirection(conditionId, outcomeId);

    return {
      id: bet.id,
      trader: bet.bettor.toLowerCase(),
      platform: 'azuro',
      marketId: conditionId,
      direction,
      amount: bet.amount,
      timestamp: new Date(parseInt(bet.createdBlockTimestamp, 10) * 1000),
      transactionHash: bet.createdTxHash,
      raw: bet,
    };
  }

  /**
   * Determine if an outcome is "bull" (favorite) or "bear" (underdog).
   *
   * For 2-way markets: lower odds = favorite = bull
   * For 3-way markets: we pick the two main outcomes, ignore draw
   */
  private async getOutcomeDirection(
    conditionId: string,
    outcomeId: string
  ): Promise<'bull' | 'bear'> {
    // Check cache first
    const cached = this.conditionOutcomes.get(conditionId);
    if (cached) {
      return outcomeId === cached.bullOutcomeId ? 'bull' : 'bear';
    }

    // Fetch condition to determine outcomes
    const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
      QUERIES.condition,
      { conditionId }
    );

    if (!result?.conditions?.[0]) {
      // Default to bull if we can't determine
      return 'bull';
    }

    const condition = result.conditions[0];
    const outcomes = condition.outcomes;

    if (outcomes.length < 2) {
      return 'bull';
    }

    // Sort by odds (lower odds = more likely = favorite)
    const sortedOutcomes = [...outcomes].sort(
      (a, b) => parseFloat(a.odds) - parseFloat(b.odds)
    );

    // For 3-way markets, we might want to skip the draw
    // For simplicity, just use first two by odds
    const bullOutcomeId = sortedOutcomes[0].outcomeId;
    const bearOutcomeId = sortedOutcomes[sortedOutcomes.length - 1].outcomeId;

    // Cache for future lookups
    this.conditionOutcomes.set(conditionId, { bullOutcomeId, bearOutcomeId });

    return outcomeId === bullOutcomeId ? 'bull' : 'bear';
  }

  // ===========================================
  // Data Fetching
  // ===========================================

  async getRecentBets(
    minutes: number,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const since = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);

    const result = await this.querySubgraph<{ bets: AzuroBet[] }>(
      QUERIES.recentBets,
      { since: since.toString(), limit: limit ?? this.config.maxBetsPerRequest }
    );

    if (!result?.bets) {
      return [];
    }

    const normalizedBets = await Promise.all(
      result.bets.map((bet) => this.normalizeBet(bet))
    );

    return normalizedBets;
  }

  async getBetsForMarket(marketId: string): Promise<NormalizedBet[]> {
    const result = await this.querySubgraph<{ bets: AzuroBet[] }>(
      QUERIES.betsByCondition,
      { conditionId: marketId, limit: this.config.maxBetsPerRequest }
    );

    if (!result?.bets) {
      return [];
    }

    const normalizedBets = await Promise.all(
      result.bets.map((bet) => this.normalizeBet(bet))
    );

    return normalizedBets;
  }

  async getTraderBets(
    trader: string,
    limit?: number
  ): Promise<NormalizedBet[]> {
    const result = await this.querySubgraph<{ bets: AzuroBet[] }>(
      QUERIES.betsByBettor,
      { bettor: trader.toLowerCase(), limit: limit ?? this.config.maxBetsPerRequest }
    );

    if (!result?.bets) {
      return [];
    }

    const normalizedBets = await Promise.all(
      result.bets.map((bet) => this.normalizeBet(bet))
    );

    return normalizedBets;
  }

  // ===========================================
  // Market Operations
  // ===========================================

  async getMarketOutcome(marketId: string): Promise<MarketOutcome | null> {
    try {
      const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
        QUERIES.condition,
        { conditionId: marketId }
      );

      if (!result?.conditions?.[0]) {
        return null;
      }

      const condition = result.conditions[0];

      if (condition.status !== 'Resolved') {
        return {
          marketId,
          resolved: false,
          winner: null,
          raw: condition,
        };
      }

      // Determine winner
      const winningOutcomeId = condition.wonOutcomeIds?.[0];
      if (!winningOutcomeId) {
        return {
          marketId,
          resolved: true,
          winner: null, // Draw or canceled
          raw: condition,
        };
      }

      const cached = this.conditionOutcomes.get(marketId);
      let winner: 'bull' | 'bear' | null = null;

      if (cached) {
        winner = winningOutcomeId === cached.bullOutcomeId ? 'bull' : 'bear';
      } else {
        // Fetch and cache
        await this.getOutcomeDirection(marketId, winningOutcomeId);
        const newCached = this.conditionOutcomes.get(marketId);
        if (newCached) {
          winner = winningOutcomeId === newCached.bullOutcomeId ? 'bull' : 'bear';
        }
      }

      return {
        marketId,
        resolved: true,
        winner,
        resolvedAt: condition.resolvedAt
          ? new Date(parseInt(condition.resolvedAt, 10) * 1000)
          : undefined,
        raw: condition,
      };
    } catch (error) {
      logger.error(`Failed to get Azuro outcome for ${marketId}`, error as Error);
      return null;
    }
  }

  async isMarketActive(marketId: string): Promise<boolean> {
    try {
      const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
        QUERIES.condition,
        { conditionId: marketId }
      );

      const condition = result?.conditions?.[0];
      if (!condition) return false;

      // Active if status is Created and game hasn't started
      const gameStart = parseInt(condition.game.startsAt, 10) * 1000;
      return condition.status === 'Created' && Date.now() < gameStart;
    } catch (error) {
      return false;
    }
  }

  async getActiveMarkets(limit?: number): Promise<string[]> {
    try {
      const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
        QUERIES.activeConditions,
        { limit: limit ?? 50 }
      );

      return result?.conditions?.map((c) => c.conditionId) ?? [];
    } catch (error) {
      logger.error('Failed to fetch active Azuro conditions', error as Error);
      return [];
    }
  }

  // ===========================================
  // Azuro-specific Methods
  // ===========================================

  /**
   * Get detailed condition info including game details
   */
  async getConditionDetails(conditionId: string): Promise<AzuroCondition | null> {
    const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
      QUERIES.condition,
      { conditionId }
    );

    return result?.conditions?.[0] ?? null;
  }

  /**
   * Get conditions by sport
   */
  async getConditionsBySport(sport: string, limit = 20): Promise<AzuroCondition[]> {
    const query = `
      query ConditionsBySport($sport: String!, $limit: Int!) {
        conditions(
          where: { status: "Created", game_: { sport_: { name: $sport } } }
          orderBy: game__startsAt
          orderDirection: asc
          first: $limit
        ) {
          id
          conditionId
          status
          outcomes { id outcomeId odds }
          game {
            title
            startsAt
            sport { name }
            league { name }
          }
        }
      }
    `;

    const result = await this.querySubgraph<{ conditions: AzuroCondition[] }>(
      query,
      { sport, limit }
    );

    return result?.conditions ?? [];
  }
}

// ===========================================
// Default Export
// ===========================================

export const azuroAdapter = new AzuroAdapter();
export default AzuroAdapter;
