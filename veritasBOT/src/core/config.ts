/**
 * Configuration Management
 * Loads and validates environment configuration
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { BotConfig, PlatformConfig } from '../types/index.js';

// Load environment variables
dotenvConfig();

// ===========================================
// Environment Schema
// ===========================================

const envSchema = z.object({
  // Database
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // Blockchain
  Somnia_MAINNET_RPC: z.string().url().default('https://somnia-dataseed1.somnia.org'),
  Somnia_MAINNET_WS: z.string().default('wss://somnia.publicnode.com'),
  Somnia_TESTNET_RPC: z.string().url().default('https://data-seed-presomnia-1-s1.somnia.org:8545'),
  POLYGON_RPC: z.string().url().optional(),
  POLYGON_WS: z.string().optional(),

  // Contracts
  DREAMDEX_PREDICTION_ADDRESS: z.string().default('0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9'),
  COPY_TRADING_VAULT: z.string().optional(),

  // Execution
  EXECUTOR_PRIVATE_KEY: z.string().optional(),
  MAX_GAS_PRICE_GWEI: z.coerce.number().default(10),
  MIN_COPY_AMOUNT_STT: z.coerce.number().default(0.001),

  // API
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  API_SECRET: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Feature Flags
  ENABLE_SMART_MONEY: z.coerce.boolean().default(true),
  ENABLE_BACKTESTING: z.coerce.boolean().default(true),
  ENABLE_ANTI_GAMING: z.coerce.boolean().default(true),
  ENABLE_PORTFOLIO_OPTIMIZER: z.coerce.boolean().default(true),
  ENABLE_COPY_EXECUTION: z.coerce.boolean().default(false),

  // Bot Configuration
  SIGNAL_MIN_TRADERS: z.coerce.number().default(3),
  SIGNAL_MIN_VOLUME_STT: z.coerce.number().default(1),
  GAMING_CHECK_INTERVAL_MS: z.coerce.number().default(60000),
  WASH_TRADING_THRESHOLD: z.coerce.number().default(3),
  BACKTEST_CACHE_TTL_HOURS: z.coerce.number().default(24),
  BACKTEST_MAX_HISTORY_DAYS: z.coerce.number().default(365),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  WS_RECONNECT_DELAY_MS: z.coerce.number().default(5000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  // External APIs
  POLYMARKET_API_URL: z.string().url().default('https://gamma-api.polymarket.com'),

  // Notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

// ===========================================
// Configuration Class
// ===========================================

class Configuration {
  private env: EnvConfig;
  private platformConfigs: Record<string, PlatformConfig>;

  constructor() {
    // Validate environment
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('Configuration validation failed:');
      for (const error of result.error.errors) {
        console.error(`  ${error.path.join('.')}: ${error.message}`);
      }
      throw new Error('Invalid configuration. Check your .env file.');
    }

    this.env = result.data;

    // Load platform configs
    this.platformConfigs = this.loadPlatformConfigs();
  }

  private loadPlatformConfigs(): Record<string, PlatformConfig> {
    try {
      const configPath = join(process.cwd(), 'config', 'platforms.json');
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Could not load platforms.json, using defaults');
      return {
        dreamdex: {
          name: 'DreamDEX Event Contracts',
          chainId: 56,
          predictionContract: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
          roundDuration: 300,
          bufferSeconds: 30,
          platformFee: 0.03,
          minBetAmount: '0.001',
          currency: 'STT',
          explorerUrl: 'https://somniascan.com',
        },
      };
    }
  }

  // ===========================================
  // Getters
  // ===========================================

  get database() {
    return {
      url: this.env.SUPABASE_URL,
      serviceKey: this.env.SUPABASE_SERVICE_KEY,
    };
  }

  get blockchain() {
    return {
      somniaMainnetRpc: this.env.Somnia_MAINNET_RPC,
      somniaMainnetWs: this.env.Somnia_MAINNET_WS,
      somniaTestnetRpc: this.env.Somnia_TESTNET_RPC,
      polygonRpc: this.env.POLYGON_RPC,
      polygonWs: this.env.POLYGON_WS,
    };
  }

  get contracts() {
    return {
      dreamDEX: this.env.DREAMDEX_PREDICTION_ADDRESS,
      copyTradingVault: this.env.COPY_TRADING_VAULT,
    };
  }

  get execution() {
    return {
      privateKey: this.env.EXECUTOR_PRIVATE_KEY,
      maxGasPriceGwei: this.env.MAX_GAS_PRICE_GWEI,
      minCopyAmountStt: this.env.MIN_COPY_AMOUNT_STT,
    };
  }

  get api() {
    return {
      port: this.env.API_PORT,
      host: this.env.API_HOST,
      secret: this.env.API_SECRET,
      corsOrigins: this.env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    };
  }

  get features(): BotConfig {
    return {
      enableSmartMoney: this.env.ENABLE_SMART_MONEY,
      enableBacktesting: this.env.ENABLE_BACKTESTING,
      enableAntiGaming: this.env.ENABLE_ANTI_GAMING,
      enablePortfolioOptimizer: this.env.ENABLE_PORTFOLIO_OPTIMIZER,
      enableCopyExecution: this.env.ENABLE_COPY_EXECUTION,
      signalMinTraders: this.env.SIGNAL_MIN_TRADERS,
      signalMinVolumeStt: this.env.SIGNAL_MIN_VOLUME_STT,
      gamingCheckIntervalMs: this.env.GAMING_CHECK_INTERVAL_MS,
      washTradingThreshold: this.env.WASH_TRADING_THRESHOLD,
      backtestCacheTtlHours: this.env.BACKTEST_CACHE_TTL_HOURS,
      backtestMaxHistoryDays: this.env.BACKTEST_MAX_HISTORY_DAYS,
      pollIntervalMs: this.env.POLL_INTERVAL_MS,
      wsReconnectDelayMs: this.env.WS_RECONNECT_DELAY_MS,
    };
  }

  get logging() {
    return {
      level: this.env.LOG_LEVEL,
      format: this.env.LOG_FORMAT,
    };
  }

  get externalApis() {
    return {
      polymarketUrl: this.env.POLYMARKET_API_URL,
    };
  }

  get notifications() {
    return {
      telegramToken: this.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: this.env.TELEGRAM_ADMIN_CHAT_ID,
      discordWebhook: this.env.DISCORD_WEBHOOK_URL,
    };
  }

  get platforms() {
    return this.platformConfigs;
  }

  getPlatform(platform: string): PlatformConfig | undefined {
    return this.platformConfigs[platform];
  }

  // ===========================================
  // Validation Helpers
  // ===========================================

  validateExecutionEnabled(): void {
    if (!this.env.ENABLE_COPY_EXECUTION) {
      throw new Error('Copy execution is disabled. Set ENABLE_COPY_EXECUTION=true');
    }
    if (!this.env.EXECUTOR_PRIVATE_KEY) {
      throw new Error('EXECUTOR_PRIVATE_KEY is required for copy execution');
    }
    if (!this.env.COPY_TRADING_VAULT) {
      throw new Error('COPY_TRADING_VAULT is required for copy execution');
    }
  }

  validateApiSecret(): void {
    if (!this.env.API_SECRET) {
      throw new Error('API_SECRET is required for authenticated endpoints');
    }
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const config = new Configuration();
export type { EnvConfig };
