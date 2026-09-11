/**
 * Platform Adapters - Index
 *
 * Exports all adapters and the registry.
 * Import from here to access the unified adapter system.
 */

// Types
export * from './types.js';

// Registry
export { adapterRegistry } from './registry.js';

// Individual Adapters
export { DreamDEXAdapter, dreamdexSwapAdapter } from './dreamdex.js';
export { PolymarketAdapter, polymarketAdapter } from './polymarket.js';
export { AzuroAdapter, azuroAdapter } from './azuro.js';
export { OvertimeAdapter, overtimeAdapter } from './overtime.js';
export { LimitlessAdapter, limitlessAdapter } from './limitless.js';
export { SpeedMarketsAdapter, speedMarketsAdapter } from './speedmarkets.js';

// ===========================================
// Convenience Setup Function
// ===========================================

import { adapterRegistry } from './registry.js';
import { dreamdexSwapAdapter } from './dreamdex.js';
import { polymarketAdapter } from './polymarket.js';
import { azuroAdapter } from './azuro.js';
import { overtimeAdapter } from './overtime.js';
import { limitlessAdapter } from './limitless.js';
import { speedMarketsAdapter } from './speedmarkets.js';
import { logger } from '../core/logger.js';
import type { Platform } from '../types/index.js';

/**
 * Register all available adapters.
 * Call this once at startup before using the registry.
 *
 * @param platforms - Optional list of platforms to register (default: all)
 */
export function registerAdapters(platforms?: Platform[]): void {
  const allAdapters = [
    dreamdexSwapAdapter,
    polymarketAdapter,
    azuroAdapter,
    overtimeAdapter,
    limitlessAdapter,
    speedMarketsAdapter,
  ];

  for (const adapter of allAdapters) {
    if (!platforms || platforms.includes(adapter.platform)) {
      adapterRegistry.register(adapter);
    }
  }

  logger.info(`Registered ${adapterRegistry.getAll().length} adapters`);
}

/**
 * Initialize all registered adapters.
 * Call after registerAdapters().
 */
export async function initializeAdapters(): Promise<void> {
  await adapterRegistry.initializeAll();
}

/**
 * Cleanup all adapters.
 * Call on shutdown.
 */
export async function cleanupAdapters(): Promise<void> {
  await adapterRegistry.cleanupAll();
}

/**
 * Full setup: register and initialize all adapters.
 *
 * @param platforms - Optional list of platforms to enable
 */
export async function setupAdapters(platforms?: Platform[]): Promise<void> {
  registerAdapters(platforms);
  await initializeAdapters();
}
