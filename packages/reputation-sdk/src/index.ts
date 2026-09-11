/**
 * @veritas/reputation-sdk
 *
 * Decentralized reputation SDK for prediction markets.
 * Index any protocol, get unified VeritasScore.
 *
 * @example
 * ```typescript
 * import {
 *   ReputationSDK,
 *   createDreamDEXAdapter,
 *   createPolymarketAdapter,
 * } from '@veritas/reputation-sdk';
 *
 * const sdk = new ReputationSDK({
 *   adapters: [
 *     createDreamDEXAdapter('https://somnia-dataseed.somnia.org'),
 *     createPolymarketAdapter('https://polygon-rpc.com'),
 *   ],
 * });
 *
 * await sdk.initialize();
 *
 * // Get unified VeritasScore
 * const score = await sdk.getVeritasScore('0x...');
 * console.log(`VeritasScore: ${score.totalScore} (${score.tier})`);
 *
 * // Get all bets across platforms
 * const bets = await sdk.getAllBets('0x...');
 * console.log(`Total bets: ${bets.length}`);
 * ```
 */

// Main SDK
export { ReputationSDK } from './core/ReputationSDK.js';

// Adapters
export { DreamDEXAdapter, createDreamDEXAdapter } from './adapters/dreamdex.js';
export { PolymarketAdapter, createPolymarketAdapter } from './adapters/polymarket.js';

// Core
export { BaseAdapter } from './core/BaseAdapter.js';
export { ScoringEngine, scoringEngine } from './core/ScoringEngine.js';

// Types
export type {
  Bet,
  UserStats,
  VeritasScore,
  AdapterConfig,
  AdapterEvent,
  BetEvent,
  ResolveEvent,
  EventCallback,
  ProtocolAdapter,
  StorageProvider,
  ReputationSDKOptions,
} from './types/index.js';
