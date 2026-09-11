import type { UserStats, TruthScore } from '../types/index.js';
/**
 * TruthScore Calculation Engine
 *
 * Aggregates scores from multiple platforms into a unified TruthScore.
 * The scoring system is designed to:
 * 1. Reward consistent winners
 * 2. Value accuracy over volume
 * 3. Give weight to active participation
 * 4. Prevent gaming through volume manipulation
 */
export interface PlatformWeight {
    platformId: string;
    weight: number;
}
export interface ScoringConfig {
    platformWeights?: PlatformWeight[];
    tierThresholds?: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
        diamond: number;
    };
    recencyBonus?: {
        enabled: boolean;
        windowDays: number;
        multiplier: number;
    };
}
export declare class ScoringEngine {
    private config;
    constructor(config?: Partial<ScoringConfig>);
    /**
     * Get platform weight (defaults to 1.0 if not specified)
     */
    private getPlatformWeight;
    /**
     * Calculate tier based on total score
     */
    private calculateTier;
    /**
     * Calculate recency bonus based on recent activity
     */
    calculateRecencyBonus(recentStats: {
        wins: number;
        totalBets: number;
        winRate: number;
    }): number;
    /**
     * Calculate unified TruthScore from multiple platform stats
     */
    calculateTruthScore(walletAddress: string, platformStats: UserStats[], recentStats?: {
        wins: number;
        totalBets: number;
        winRate: number;
    }): TruthScore;
    /**
     * Calculate score for a single platform (used by adapters)
     */
    calculatePlatformScore(stats: UserStats): number;
    /**
     * Compare two users for leaderboard sorting
     */
    compareScores(a: TruthScore, b: TruthScore): number;
    /**
     * Get tier display info
     */
    getTierInfo(tier: TruthScore['tier']): {
        name: string;
        color: string;
        minScore: number;
    };
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ScoringConfig>): void;
}
export declare const scoringEngine: ScoringEngine;
//# sourceMappingURL=ScoringEngine.d.ts.map