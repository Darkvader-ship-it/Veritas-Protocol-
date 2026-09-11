/**
 * Cascade Prevention Service
 *
 * Prevents cascade copy trading problems:
 * 1. Copy chains (A→B→C→D...) - Only allow copying original traders
 * 2. Circular follows (A→B→A) - Detect and prevent loops
 * 3. Late bets (copies) - Only copy bets placed early in rounds
 */

import { db } from '../core/database.js';
import { logger } from '../core/logger.js';
import type { Bet, Platform } from '../types/index.js';

// ===========================================
// Types
// ===========================================

export interface CopyEligibility {
  allowed: boolean;
  reason: string;
  copyDepth: number;
  isCopyTrader: boolean;
}

export interface CopyChainNode {
  address: string;
  depth: number;
  tier?: string;
  score?: number;
}

export interface CopyStatus {
  isCopyTrader: boolean;
  copyDepth: number;
  originalSource: string | null;
  followedBy: string[];
  following: string[];
}

// ===========================================
// Constants
// ===========================================

// Only copy bets placed within first N seconds of a round
const ORIGINAL_BET_WINDOW_SECONDS = 30;

// Cache TTL in milliseconds
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// ===========================================
// Cascade Prevention Service
// ===========================================

export class CascadePreventionService {
  private copyTraderCache: Map<string, { data: CopyEligibility; timestamp: number }> = new Map();

  constructor() {
    logger.info('CascadePreventionService initialized');
  }

  // ===========================================
  // Public API
  // ===========================================

  /**
   * Check if a trader can be copied (is not themselves a copy trader)
   */
  async canCopyTrader(leaderAddress: string): Promise<CopyEligibility> {
    const normalizedAddress = leaderAddress.toLowerCase();

    // Check cache first
    const cached = this.copyTraderCache.get(normalizedAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // Try to use RPC function if available
      const { data: rpcResult, error: rpcError } = await db.raw.rpc('can_copy_trader', {
        trader_addr: normalizedAddress,
      });

      if (!rpcError && rpcResult && rpcResult.length > 0) {
        const row = rpcResult[0];
        const eligibility: CopyEligibility = {
          allowed: row.allowed ?? true,
          reason: row.reason ?? 'Unknown trader - allowed by default',
          copyDepth: row.copy_depth ?? 0,
          isCopyTrader: (row.copy_depth ?? 0) > 0,
        };

        this.copyTraderCache.set(normalizedAddress, {
          data: eligibility,
          timestamp: Date.now(),
        });

        return eligibility;
      }

      // Fallback to direct table query
      return this.checkCopyTraderFallback(normalizedAddress);
    } catch (error) {
      logger.error('Failed to check copy eligibility', error as Error);
      return this.checkCopyTraderFallback(normalizedAddress);
    }
  }

  /**
   * Detect if creating a follow would create a circular chain
   */
  async detectCircularFollow(follower: string, leader: string): Promise<boolean> {
    const normalizedFollower = follower.toLowerCase();
    const normalizedLeader = leader.toLowerCase();

    // Same address is always circular
    if (normalizedFollower === normalizedLeader) {
      return true;
    }

    try {
      // Try to use RPC function if available
      const { data: rpcResult, error: rpcError } = await db.raw.rpc('detect_circular_follow', {
        p_follower: normalizedFollower,
        p_leader: normalizedLeader,
      });

      if (!rpcError && rpcResult !== null) {
        return Boolean(rpcResult);
      }

      // Fallback: do BFS in JavaScript
      return this.detectCircularFollowFallback(normalizedFollower, normalizedLeader);
    } catch (error) {
      logger.error('Failed to detect circular follow', error as Error);
      return this.detectCircularFollowFallback(normalizedFollower, normalizedLeader);
    }
  }

  /**
   * Get the copy depth of a trader
   * 0 = original trader, 1+ = copy trader
   */
  async getCopyDepth(address: string): Promise<number> {
    const eligibility = await this.canCopyTrader(address);
    return eligibility.copyDepth;
  }

  /**
   * Check if a bet is likely original (placed early in the round)
   */
  isBetOriginal(bet: Bet, roundStartTime: number): boolean {
    const betTimeMs = bet.timestamp.getTime();
    const roundStartMs = roundStartTime * 1000; // Convert to ms if in seconds

    const secondsFromStart = (betTimeMs - roundStartMs) / 1000;

    // Bet is original if placed within the window
    return secondsFromStart <= ORIGINAL_BET_WINDOW_SECONDS;
  }

  /**
   * Get full copy status for a trader
   */
  async getCopyStatus(address: string): Promise<CopyStatus> {
    const normalizedAddress = address.toLowerCase();

    try {
      // Get copy trader info
      const { data: traderData } = await db.raw
        .from('copy_traders')
        .select('is_copy_trader, copy_depth, original_source')
        .eq('address', normalizedAddress)
        .single();

      // Get followers
      const { data: followersData } = await db.raw
        .from('copy_follows')
        .select('follower')
        .eq('leader', normalizedAddress)
        .eq('active', true);

      // Get following
      const { data: followingData } = await db.raw
        .from('copy_follows')
        .select('leader')
        .eq('follower', normalizedAddress)
        .eq('active', true);

      return {
        isCopyTrader: traderData?.is_copy_trader ?? false,
        copyDepth: traderData?.copy_depth ?? 0,
        originalSource: traderData?.original_source ?? null,
        followedBy: (followersData || []).map((r: { follower: string }) => r.follower),
        following: (followingData || []).map((r: { leader: string }) => r.leader),
      };
    } catch (error) {
      logger.error('Failed to get copy status', error as Error);
      return {
        isCopyTrader: false,
        copyDepth: 0,
        originalSource: null,
        followedBy: [],
        following: [],
      };
    }
  }

  /**
   * Get the full copy chain for a trader
   */
  async getCopyChain(address: string): Promise<CopyChainNode[]> {
    const normalizedAddress = address.toLowerCase();
    const chain: CopyChainNode[] = [];
    const visited = new Set<string>();

    let currentAddress = normalizedAddress;

    while (currentAddress && !visited.has(currentAddress)) {
      visited.add(currentAddress);

      try {
        const { data: traderData } = await db.raw
          .from('copy_traders')
          .select('address, copy_depth, original_source')
          .eq('address', currentAddress)
          .single();

        // Also get tier info from unified_traders if available
        const { data: unifiedData } = await db.raw
          .from('unified_traders')
          .select('tier, unified_score')
          .eq('primary_address', currentAddress)
          .single();

        chain.push({
          address: currentAddress,
          depth: traderData?.copy_depth ?? 0,
          tier: unifiedData?.tier,
          score: unifiedData?.unified_score,
        });

        // Move to the source
        currentAddress = traderData?.original_source ?? '';
      } catch {
        break;
      }
    }

    return chain.reverse(); // Original first, then copies
  }

  /**
   * Validate a new follow request
   */
  async validateFollow(
    follower: string,
    leader: string
  ): Promise<{ valid: boolean; error?: string }> {
    const normalizedFollower = follower.toLowerCase();
    const normalizedLeader = leader.toLowerCase();

    // Check 1: Self-follow
    if (normalizedFollower === normalizedLeader) {
      return { valid: false, error: 'Cannot follow yourself' };
    }

    // Check 2: Leader is not a copy trader
    const eligibility = await this.canCopyTrader(normalizedLeader);
    if (!eligibility.allowed) {
      return { valid: false, error: eligibility.reason };
    }

    // Check 3: No circular follows
    const isCircular = await this.detectCircularFollow(normalizedFollower, normalizedLeader);
    if (isCircular) {
      return { valid: false, error: 'This follow would create a circular chain' };
    }

    // Check 4: Already following
    const { data: existingFollow } = await db.raw
      .from('copy_follows')
      .select('id')
      .eq('follower', normalizedFollower)
      .eq('leader', normalizedLeader)
      .eq('active', true);

    if (existingFollow && existingFollow.length > 0) {
      return { valid: false, error: 'Already following this trader' };
    }

    return { valid: true };
  }

  /**
   * Create a validated follow relationship
   */
  async createFollow(
    follower: string,
    leader: string,
    platform: Platform | 'all' = 'all',
    allocationPercent: number = 10
  ): Promise<{ success: boolean; error?: string }> {
    // Validate first
    const validation = await this.validateFollow(follower, leader);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const normalizedFollower = follower.toLowerCase();
    const normalizedLeader = leader.toLowerCase();

    try {
      // Get leader's copy depth (should be 0 for original traders)
      const leaderDepth = await this.getCopyDepth(normalizedLeader);

      // Create the follow with copy tracking
      const { error } = await db.raw.from('copy_follows').insert({
        follower: normalizedFollower,
        leader: normalizedLeader,
        platform,
        allocation_percent: allocationPercent,
        copy_depth: leaderDepth + 1,
        is_follower_copy_trader: true,
        original_source: normalizedLeader,
        active: true,
        created_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // Clear cache for follower
      this.copyTraderCache.delete(normalizedFollower);

      logger.info('Follow created with cascade prevention', {
        follower: normalizedFollower.slice(0, 10),
        leader: normalizedLeader.slice(0, 10),
        copyDepth: leaderDepth + 1,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to create follow', error as Error);
      return { success: false, error: 'Database error creating follow' };
    }
  }

  // ===========================================
  // Fallback Methods
  // ===========================================

  private async checkCopyTraderFallback(address: string): Promise<CopyEligibility> {
    try {
      const { data, error } = await db.raw
        .from('copy_traders')
        .select('is_copy_trader, copy_depth')
        .eq('address', address)
        .single();

      if (error || !data) {
        return {
          allowed: true,
          reason: 'New trader - allowed',
          copyDepth: 0,
          isCopyTrader: false,
        };
      }

      if (data.is_copy_trader) {
        return {
          allowed: false,
          reason: 'Cannot copy a copy trader',
          copyDepth: data.copy_depth,
          isCopyTrader: true,
        };
      }

      return {
        allowed: true,
        reason: 'Original trader - allowed',
        copyDepth: 0,
        isCopyTrader: false,
      };
    } catch {
      // If table doesn't exist, allow by default
      return {
        allowed: true,
        reason: 'Unable to verify - allowed by default',
        copyDepth: 0,
        isCopyTrader: false,
      };
    }
  }

  private async detectCircularFollowFallback(follower: string, leader: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [leader];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current)) continue;
      visited.add(current);

      // Check if current follows back to original follower
      try {
        const { data } = await db.raw
          .from('copy_follows')
          .select('leader')
          .eq('follower', current)
          .eq('active', true);

        for (const row of data ?? []) {
          if (row.leader === follower) {
            return true; // Circular!
          }
          if (!visited.has(row.leader)) {
            queue.push(row.leader);
          }
        }
      } catch {
        break;
      }

      // Prevent infinite loops
      if (visited.size > 1000) {
        logger.warn('Circular detection exceeded max depth');
        break;
      }
    }

    return false;
  }

  // ===========================================
  // Cache Management
  // ===========================================

  clearCache(): void {
    this.copyTraderCache.clear();
    logger.info('CascadePreventionService cache cleared');
  }

  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.copyTraderCache.size,
      ttlMs: CACHE_TTL_MS,
    };
  }
}

// ===========================================
// Singleton Instance
// ===========================================

export const cascadePreventionService = new CascadePreventionService();

export default CascadePreventionService;
