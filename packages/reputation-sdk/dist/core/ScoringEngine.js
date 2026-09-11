const DEFAULT_CONFIG = {
    platformWeights: [],
    tierThresholds: {
        bronze: 0,
        silver: 500,
        gold: 2000,
        platinum: 5000,
        diamond: 15000,
    },
    recencyBonus: {
        enabled: true,
        windowDays: 90,
        multiplier: 0.5,
    },
};
export class ScoringEngine {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Get platform weight (defaults to 1.0 if not specified)
     */
    getPlatformWeight(platformId) {
        const weight = this.config.platformWeights?.find((w) => w.platformId === platformId);
        return weight?.weight ?? 1.0;
    }
    /**
     * Calculate tier based on total score
     */
    calculateTier(totalScore) {
        const thresholds = this.config.tierThresholds;
        if (totalScore >= thresholds.diamond)
            return 'diamond';
        if (totalScore >= thresholds.platinum)
            return 'platinum';
        if (totalScore >= thresholds.gold)
            return 'gold';
        if (totalScore >= thresholds.silver)
            return 'silver';
        return 'bronze';
    }
    /**
     * Calculate recency bonus based on recent activity
     */
    calculateRecencyBonus(recentStats) {
        if (!this.config.recencyBonus?.enabled)
            return 0;
        const { wins, totalBets, winRate } = recentStats;
        if (totalBets === 0)
            return 0;
        // Simple recency score: wins * win_rate_factor
        const winRateFactor = winRate > 50 ? winRate / 50 : 0.5;
        const recentScore = wins * 100 * winRateFactor;
        return Math.floor(recentScore * this.config.recencyBonus.multiplier);
    }
    /**
     * Calculate unified TruthScore from multiple platform stats
     */
    calculateTruthScore(walletAddress, platformStats, recentStats) {
        const breakdown = [];
        let totalScore = 0;
        // Calculate weighted score for each platform
        for (const stats of platformStats) {
            const weight = this.getPlatformWeight(stats.platformId);
            const weightedScore = Math.floor(stats.score * weight);
            breakdown.push({
                platformId: stats.platformId,
                platformName: stats.platformId, // Will be replaced with actual name by caller
                score: stats.score,
                weight,
            });
            totalScore += weightedScore;
        }
        // Add recency bonus
        if (recentStats) {
            const recencyBonus = this.calculateRecencyBonus(recentStats);
            totalScore += recencyBonus;
        }
        return {
            walletAddress: walletAddress.toLowerCase(),
            totalScore,
            breakdown,
            tier: this.calculateTier(totalScore),
            lastUpdated: Date.now(),
        };
    }
    /**
     * Calculate score for a single platform (used by adapters)
     */
    calculatePlatformScore(stats) {
        const { wins, totalBets, winRate, volume } = stats;
        // Base formula (can be customized per platform in adapter)
        // Base points: 100 per win
        const winPoints = wins * 100;
        // Win rate bonus: Extra points for > 55% accuracy
        const winRateBonus = winRate > 55 ? (winRate - 55) * 10 : 0;
        // Volume bonus: Rewards active traders (capped to prevent gaming)
        const volumeNative = Number(volume) / 1e18;
        const volumeBonus = Math.min(500, Math.floor(volumeNative * 10));
        // Consistency bonus: Rewards regular participation
        const consistencyBonus = totalBets >= 100
            ? 300
            : totalBets >= 50
                ? 200
                : totalBets >= 20
                    ? 100
                    : 0;
        return Math.floor(winPoints + winRateBonus + volumeBonus + consistencyBonus);
    }
    /**
     * Compare two users for leaderboard sorting
     */
    compareScores(a, b) {
        // Primary: Total score
        if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
        }
        // Secondary: Number of platforms (more diversification = higher rank)
        return b.breakdown.length - a.breakdown.length;
    }
    /**
     * Get tier display info
     */
    getTierInfo(tier) {
        const thresholds = this.config.tierThresholds;
        switch (tier) {
            case 'diamond':
                return { name: 'Diamond', color: '#b9f2ff', minScore: thresholds.diamond };
            case 'platinum':
                return { name: 'Platinum', color: '#e5e4e2', minScore: thresholds.platinum };
            case 'gold':
                return { name: 'Gold', color: '#ffd700', minScore: thresholds.gold };
            case 'silver':
                return { name: 'Silver', color: '#c0c0c0', minScore: thresholds.silver };
            default:
                return { name: 'Bronze', color: '#cd7f32', minScore: thresholds.bronze };
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// Default singleton instance
export const scoringEngine = new ScoringEngine();
//# sourceMappingURL=ScoringEngine.js.map