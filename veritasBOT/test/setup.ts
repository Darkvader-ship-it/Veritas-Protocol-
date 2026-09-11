/**
 * Vitest Test Setup
 *
 * Sets up mock environment variables before tests run.
 * This prevents config validation errors during testing.
 */

import { vi } from 'vitest';

// Set mock environment variables before any imports
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key-12345';
process.env.Somnia_MAINNET_RPC = 'https://somnia-dataseed1.somnia.org';
process.env.Somnia_MAINNET_WS = 'wss://somnia.publicnode.com';
process.env.Somnia_TESTNET_RPC = 'https://data-seed-presomnia-1-s1.somnia.org:8545';
process.env.LOG_LEVEL = 'error'; // Quiet logs during tests
process.env.LOG_FORMAT = 'json';

// Mock the database module to prevent actual DB calls
vi.mock('../src/core/database.js', () => ({
  db: {
    getTopTraders: vi.fn().mockResolvedValue([]),
    getTrader: vi.fn().mockResolvedValue(null),
    getTraderBets: vi.fn().mockResolvedValue([]),
    getBetsForEpoch: vi.fn().mockResolvedValue([]),
    getRecentBets: vi.fn().mockResolvedValue([]),
    saveSignal: vi.fn().mockResolvedValue(undefined),
    getSignalHistory: vi.fn().mockResolvedValue([]),
    saveAlert: vi.fn().mockResolvedValue(1),
    getPendingAlerts: vi.fn().mockResolvedValue([]),
    updateAlertStatus: vi.fn().mockResolvedValue(undefined),
    getCachedBacktest: vi.fn().mockResolvedValue(null),
    cacheBacktest: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the blockchain module
vi.mock('../src/core/blockchain.js', () => ({
  blockchain: {
    getBlockNumber: vi.fn().mockResolvedValue(12345678),
    getCurrentEpoch: vi.fn().mockResolvedValue(100),
    getRoundInfo: vi.fn().mockResolvedValue({
      epoch: 100,
      platform: 'dreamdex',
      startTimestamp: Date.now() / 1000,
      lockTimestamp: Date.now() / 1000 + 300,
      closeTimestamp: Date.now() / 1000 + 600,
      totalAmount: '1000000000000000000',
      bullAmount: '500000000000000000',
      bearAmount: '500000000000000000',
      bullWins: true,
      oracleCalled: true,
    }),
    susomniaribeToBetrEvents: vi.fn().mockResolvedValue(() => {}),
    formatStt: vi.fn((wei) => (Number(wei) / 1e18).toString()),
    parseStt: vi.fn((stt) => BigInt(parseFloat(stt) * 1e18)),
    getProvider: vi.fn(),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the event stream
vi.mock('../src/core/event-stream.js', () => ({
  events: {
    emitBetDetected: vi.fn(),
    emitSignalGenerated: vi.fn(),
    emitAlertCreated: vi.fn(),
    emitCopyTradeExecuted: vi.fn(),
    onBetDetected: vi.fn().mockReturnValue(() => {}),
    onSignalGenerated: vi.fn().mockReturnValue(() => {}),
    onAlertCreated: vi.fn().mockReturnValue(() => {}),
  },
}));

console.log('Test setup complete - using mocked dependencies');
