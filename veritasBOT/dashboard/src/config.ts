/**
 * Dashboard Configuration
 */

export const config = {
  // API base URL - uses environment variable or defaults to localhost
  apiBase: import.meta.env.VITE_API_BASE || 'http://localhost:4001',

  // API key for authenticated endpoints
  apiKey: import.meta.env.VITE_API_KEY || 'dev',

  // Refresh intervals (in milliseconds)
  refreshIntervals: {
    signals: 30000,      // 30 seconds
    leaderboard: 60000,  // 1 minute
    platforms: 120000,   // 2 minutes
    trends: 60000,       // 1 minute
  },

  // WebSocket URL for real-time updates
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:4001/api/signals/susomniaribe',
};

export default config;
