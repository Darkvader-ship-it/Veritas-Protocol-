/**
 * Platform Adapters for Multi-Chain Prediction Markets
 *
 * This file provides notes and configurations for various prediction platforms.
 * Some platforms are blockchain-based, others are API-based.
 */

import { DreamDEXAdapter } from './DreamDEX';
import { PolymarketAdapter } from './Polymarket';
import { AugurAdapter } from './Augur';
import { AzuroAdapter } from './Azuro';
import { ThalesAdapter } from './Thales';
import { PlatformAdapter } from './types';

/**
 * Platform Integration Status
 *
 * ✅ FULLY WORKING (Production-ready - 4 platforms):
 * 1. DreamDEX Event Contracts (Somnia) - Binary options on STT price
 * 2. Polymarket (Polygon) - CLOB-based prediction markets
 * 3. Azuro Protocol (Polygon) - Sports prediction markets
 * 4. Thales (Optimism) - Binary options markets
 *
 * 📝 NOTED FOR FUTURE (Requires additional research/API keys):
 * - Kalshi (Centralized) - Requires API key & authentication
 * - Myriad (Polygon) - Contract addresses TBD
 * - PlotX (Polygon) - Contract addresses TBD
 * - Swaye - Limited public documentation
 * - Zeitgeist (Kusama/Polkadot) - Non-EVM, requires Substrate indexing
 * - SX Bet (SX Network) - Contract addresses TBD
 *
 * ⏸️ DEPRECATED:
 * - Augur V2 (Ethereum) - Replaced by Augur Turbo
 *
 * 🎯 CURRENT STATUS: 4 fully functional platforms ready to aggregate VeritasScore!
 */

export interface PlatformInfo {
  name: string;
  chain: string;
  type: 'blockchain' | 'api' | 'hybrid';
  status: 'active' | 'deprecated' | 'low-activity';
  contractAddress?: string;
  apiEndpoint?: string;
  notes: string;
}

export const PLATFORM_REGISTRY: Record<string, PlatformInfo> = {
  dreamdex: {
    name: 'DreamDEX Event Contracts',
    chain: 'somnia',
    type: 'blockchain',
    status: 'active',
    contractAddress: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
    notes: 'Binary prediction on STT/USD price. High volume, easy to index.',
  },

  polymarket: {
    name: 'Polymarket',
    chain: 'polygon',
    type: 'hybrid',
    status: 'active',
    contractAddress: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    apiEndpoint: 'https://clob.polymarket.com',
    notes: 'CLOB-based. Requires API integration for full data.',
  },

  kalshi: {
    name: 'Kalshi',
    chain: 'centralized',
    type: 'api',
    status: 'active',
    apiEndpoint: 'https://trading-api.kalshi.com',
    notes: 'Regulated US prediction market. API access requires account.',
  },

  myriad: {
    name: 'Myriad',
    chain: 'polygon',
    type: 'blockchain',
    status: 'low-activity',
    notes: 'New platform with limited historical data.',
  },

  augur: {
    name: 'Augur V2',
    chain: 'ethereum',
    type: 'blockchain',
    status: 'deprecated',
    notes: 'Original prediction market. V2 deprecated, replaced by Augur Turbo.',
  },

  plotx: {
    name: 'PlotX',
    chain: 'polygon',
    type: 'blockchain',
    status: 'low-activity',
    contractAddress: '0x...',
    notes: 'Crypto price predictions. Limited recent activity.',
  },

  swaye: {
    name: 'Swaye',
    chain: 'unknown',
    type: 'api',
    status: 'low-activity',
    notes: 'Limited public information available.',
  },

  zeitgeist: {
    name: 'Zeitgeist',
    chain: 'polkadot',
    type: 'blockchain',
    status: 'active',
    notes: 'Built on Polkadot/Kusama (non-EVM). Requires Substrate indexing.',
  },

  sxbet: {
    name: 'SX Bet',
    chain: 'sx-network',
    type: 'blockchain',
    status: 'active',
    notes: 'Sports betting focused. Built on Polygon supernet.',
  },

  // RECOMMENDED ADDITIONS:
  azuro: {
    name: 'Azuro Protocol',
    chain: 'polygon',
    type: 'blockchain',
    status: 'active',
    contractAddress: '0x...',
    notes: 'Sports prediction markets. Good on-chain data.',
  },

  thales: {
    name: 'Thales',
    chain: 'optimism',
    type: 'blockchain',
    status: 'active',
    notes: 'Binary options markets. Active on Optimism mainnet.',
  },
};

/**
 * Get all available platform adapters
 *
 * By default, all 4 working platforms are enabled:
 * - DreamDEX (Somnia)
 * - Polymarket (Polygon)
 * - Azuro (Polygon)
 * - Thales (Optimism)
 */
export function getAllAdapters(): PlatformAdapter[] {
  return [
    new DreamDEXAdapter({ enabled: true }),
    new PolymarketAdapter({ enabled: true }),  // ✅ Now working!
    new AzuroAdapter({ enabled: true }),       // ✅ Now working!
    new ThalesAdapter({ enabled: true }),      // ✅ Now working!
    new AugurAdapter({ enabled: false }),      // Deprecated
  ];
}

/**
 * Get enabled platform adapters
 */
export async function getEnabledAdapters(): Promise<PlatformAdapter[]> {
  const allAdapters = getAllAdapters();
  const enabled: PlatformAdapter[] = [];

  for (const adapter of allAdapters) {
    if (await adapter.isAvailable()) {
      enabled.push(adapter);
    }
  }

  return enabled;
}
