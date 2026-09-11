/**
 * Structured Logger
 * Pino-based logging with pretty printing support
 */

import pino from 'pino';

// Get config without circular dependency
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'pretty';

// ===========================================
// Logger Configuration
// ===========================================

const transport =
  LOG_FORMAT === 'pretty'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      }
    : undefined;

export const logger = pino({
  level: LOG_LEVEL,
  transport,
  base: {
    service: 'veritasbot',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// ===========================================
// Child Loggers for Different Components
// ===========================================

export const createBotLogger = (botName: string) => {
  return logger.child({ bot: botName });
};

export const smartMoneyLogger = createBotLogger('smart-money');
export const backtestLogger = createBotLogger('backtest');
export const antiGamingLogger = createBotLogger('anti-gaming');
export const portfolioLogger = createBotLogger('portfolio');
export const copyTradingLogger = createBotLogger('copy-trading');
export const apiLogger = createBotLogger('api');

// ===========================================
// Utility Functions
// ===========================================

export const logStartup = (component: string, version: string) => {
  logger.info('');
  logger.info('='.repeat(50));
  logger.info(`  ${component} v${version}`);
  logger.info('='.repeat(50));
  logger.info('');
};

export const logShutdown = (component: string) => {
  logger.info('');
  logger.info(`${component} shutting down...`);
  logger.info('');
};

export const logError = (message: string, error: Error, context?: object) => {
  logger.error({
    msg: message,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};
