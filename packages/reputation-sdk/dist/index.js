/**
 * @truthbounty/reputation-sdk
 *
 * Decentralized reputation SDK for prediction markets.
 * Index any protocol, get unified TruthScore.
 *
 * @example
 * ```typescript
 * import {
 *   ReputationSDK,
 *   createPancakeSwapAdapter,
 *   createPolymarketAdapter,
 * } from '@truthbounty/reputation-sdk';
 *
 * const sdk = new ReputationSDK({
 *   adapters: [
 *     createPancakeSwapAdapter('https://bsc-dataseed.binance.org'),
 *     createPolymarketAdapter('https://polygon-rpc.com'),
 *   ],
 * });
 *
 * await sdk.initialize();
 *
 * // Get unified TruthScore
 * const score = await sdk.getTruthScore('0x...');
 * console.log(`TruthScore: ${score.totalScore} (${score.tier})`);
 *
 * // Get all bets across platforms
 * const bets = await sdk.getAllBets('0x...');
 * console.log(`Total bets: ${bets.length}`);
 * ```
 */
// Main SDK
export { ReputationSDK } from './core/ReputationSDK.js';
// Adapters
export { PancakeSwapAdapter, createPancakeSwapAdapter } from './adapters/pancakeswap.js';
export { PolymarketAdapter, createPolymarketAdapter } from './adapters/polymarket.js';
// Core
export { BaseAdapter } from './core/BaseAdapter.js';
export { ScoringEngine, scoringEngine } from './core/ScoringEngine.js';
//# sourceMappingURL=index.js.map