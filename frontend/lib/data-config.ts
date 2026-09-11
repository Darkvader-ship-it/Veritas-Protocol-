/**
 * Data Mode Configuration
 *
 * REAL DATA ONLY - No demo mode
 */

// Always mainnet - no demo mode
export const DATA_MODE = 'mainnet' as const;

export const isDemoMode = () => false;  // NEVER demo mode
export const isMainnetMode = () => true;

// Display configuration
export const getDataModeConfig = () => ({
  mode: DATA_MODE,
  isDemo: false,
  isMainnet: true,
  description: 'Using real blockchain data from Somnia Shannon',
  badgeColor: 'green',
  badgeText: 'LIVE DATA',
});
