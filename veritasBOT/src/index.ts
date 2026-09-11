/**
 * VeritasBOT - Trading Bot System for Veritas
 *
 * Main entry point that orchestrates all bot components.
 */

import { config } from './core/config.js';
import { blockchain } from './core/blockchain.js';
import { logger, logStartup, logShutdown } from './core/logger.js';
import { startServer, stopServer } from './api/server.js';

// ===========================================
// Version Info
// ===========================================

const VERSION = '1.0.0';
const NAME = 'VeritasBOT';

// ===========================================
// ASCII Art Banner
// ===========================================

const banner = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   ████████╗██████╗ ██╗   ██╗████████╗██╗  ██╗                  ║
║   ╚══██╔══╝██╔══██╗██║   ██║╚══██╔══╝██║  ██║                  ║
║      ██║   ██████╔╝██║   ██║   ██║   ███████║                  ║
║      ██║   ██╔══██╗██║   ██║   ██║   ██╔══██║                  ║
║      ██║   ██║  ██║╚██████╔╝   ██║   ██║  ██║                  ║
║      ╚═╝   ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝                  ║
║                                                                ║
║   ██████╗  ██████╗ ████████╗                                   ║
║   ██╔══██╗██╔═══██╗╚══██╔══╝                                   ║
║   ██████╔╝██║   ██║   ██║                                      ║
║   ██╔══██╗██║   ██║   ██║                                      ║
║   ██████╔╝╚██████╔╝   ██║                                      ║
║   ╚═════╝  ╚═════╝    ╚═╝                                      ║
║                                                                ║
║   Smart Money Signals • Backtesting • Anti-Gaming              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`;

// ===========================================
// Main Function
// ===========================================

async function main(): Promise<void> {
  console.log(banner);
  logStartup(NAME, VERSION);

  // Log configuration
  logger.info('Configuration loaded', {
    features: {
      smartMoney: config.features.enableSmartMoney,
      backtesting: config.features.enableBacktesting,
      antiGaming: config.features.enableAntiGaming,
      portfolioOptimizer: config.features.enablePortfolioOptimizer,
      copyExecution: config.features.enableCopyExecution,
    },
    api: {
      port: config.api.port,
      host: config.api.host,
    },
  });

  // Verify blockchain connection (optional - server can run without it)
  try {
    const blockNumber = await blockchain.getBlockNumber('somnia-mainnet');
    logger.info(`Connected to Somnia Mainnet at block ${blockNumber}`);
  } catch (error) {
    logger.warn('Failed to connect to blockchain - running in API-only mode', {
      error: (error as Error).message,
    });
    logger.warn('Blockchain-dependent features (live bet monitoring) will be unavailable');
  }

  // Start the API server (which also starts enabled bots)
  await startServer();

  logger.info('');
  logger.info('VeritasBOT is running!');
  logger.info('');
  logger.info('Available endpoints:');
  logger.info(`  GET  /health                    - Health check`);
  logger.info(`  GET  /api/signals/current/:p    - Current smart money signal`);
  logger.info(`  GET  /api/signals/history       - Signal history`);
  logger.info(`  GET  /api/signals/traders       - Tracked traders`);
  logger.info(`  POST /api/backtest              - Run backtest`);
  logger.info(`  GET  /api/alerts/pending        - Pending gaming alerts`);
  logger.info(`  GET  /api/wallet/:addr/analyze  - Analyze wallet`);
  logger.info(`  WS   /api/signals/susomniaribe     - Real-time signals`);
  logger.info('');
}

// ===========================================
// Graceful Shutdown
// ===========================================

async function shutdown(): Promise<void> {
  logShutdown(NAME);

  await stopServer();
  await blockchain.cleanup();

  logger.info('Goodbye!');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
  shutdown();
});

// ===========================================
// Run
// ===========================================

main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});
