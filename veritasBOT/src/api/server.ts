/**
 * VeritasBOT API Server
 *
 * Exposes bot functionality via REST API
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from '../core/config.js';
import { events } from '../core/event-stream.js';
import { apiLogger as logger } from '../core/logger.js';
import { SmartMoneyAggregator } from '../bots/smart-money-aggregator.js';
import { BacktestingEngine } from '../bots/backtesting-engine.js';
import { AntiGamingDetector } from '../bots/anti-gaming-detector.js';
import { multiPlatformTracker } from '../bots/multi-platform-tracker.js';
import { trendDetector } from '../bots/trend-detector.js';
import { crossPlatformSignals } from '../bots/cross-platform-signals.js';
import { db } from '../core/database.js';
import type { BacktestSettings } from '../types/index.js';
import { registerCascadeRoutes } from './cascade-routes.js';

// ===========================================
// Server Setup
// ===========================================

const fastify = Fastify({
  logger: false, // We use our own logger
});

// Register plugins
await fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

await fastify.register(websocket);

// ===========================================
// Bot Instances
// ===========================================

const smartMoney = new SmartMoneyAggregator();
const backtest = new BacktestingEngine();
const antiGaming = new AntiGamingDetector();

// ===========================================
// Middleware
// ===========================================

// API Key authentication (optional)
fastify.addHook('preHandler', async (request, reply) => {
  // Skip auth for health check and WebSocket
  if (request.url === '/health' || request.url === '/api/signals/susomniaribe') return;

  // If API secret is configured, require it
  if (config.api.secret) {
    const apiKey = request.headers['x-api-key'];
    if (apiKey !== config.api.secret) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  }
});

// Request logging
fastify.addHook('onResponse', (request, reply, done) => {
  logger.info(`${request.method} ${request.url} ${reply.statusCode}`);
  done();
});

// ===========================================
// Health Check
// ===========================================

fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    bots: {
      smartMoney: smartMoney.getStats(),
      antiGaming: antiGaming.getStats(),
    },
  };
});

// ===========================================
// Smart Money Endpoints
// ===========================================

fastify.get('/api/signals/current/:platform', async (request, reply) => {
  const { platform } = request.params as { platform: string };

  if (platform !== 'dreamdex') {
    return reply.status(400).send({ error: 'Only dreamdex supported currently' });
  }

  const signal = await smartMoney.getCurrentSignal();

  return {
    success: true,
    data: signal,
    timestamp: new Date(),
  };
});

fastify.get('/api/signals/history', async (request) => {
  const { platform = 'dreamdex', limit = '50' } = request.query as {
    platform?: string;
    limit?: string;
  };

  const signals = await smartMoney.getSignalHistory(parseInt(limit));

  return {
    success: true,
    data: signals,
    pagination: {
      limit: parseInt(limit),
      total: signals.length,
    },
    timestamp: new Date(),
  };
});

fastify.get('/api/signals/traders', async () => {
  const traders = smartMoney.getTrackedTraders();

  return {
    success: true,
    data: traders,
    timestamp: new Date(),
  };
});

// ===========================================
// Backtest Endpoints
// ===========================================

fastify.post('/api/backtest', async (request, reply) => {
  const body = request.body as {
    leader: string;
    startDate: string;
    endDate: string;
    initialCapital?: number;
    allocationPercent?: number;
    maxBetSize?: number;
    compounding?: boolean;
  };

  if (!body.leader) {
    return reply.status(400).send({ error: 'leader is required' });
  }

  const settings: BacktestSettings = {
    leader: body.leader,
    startDate: body.startDate ? new Date(body.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: body.endDate ? new Date(body.endDate) : new Date(),
    initialCapital: body.initialCapital || 1,
    allocationPercent: body.allocationPercent || 0.1,
    maxBetSize: body.maxBetSize || 0.1,
    compounding: body.compounding ?? true,
  };

  try {
    const result = await backtest.runBacktest(settings);

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Backtest failed', error as Error);
    return reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ===========================================
// Anti-Gaming Endpoints
// ===========================================

fastify.get('/api/alerts/pending', async () => {
  const alerts = await antiGaming.getPendingAlerts();

  return {
    success: true,
    data: alerts,
    timestamp: new Date(),
  };
});

fastify.post('/api/alerts/:id/dismiss', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { reviewedBy, notes } = request.body as { reviewedBy?: string; notes?: string };

  try {
    await antiGaming.dismissAlert(parseInt(id), reviewedBy || 'api', notes);

    return {
      success: true,
      message: 'Alert dismissed',
    };
  } catch (error) {
    return reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
});

fastify.post('/api/alerts/:id/confirm', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { reviewedBy, notes } = request.body as { reviewedBy?: string; notes?: string };

  try {
    await antiGaming.confirmAlert(parseInt(id), reviewedBy || 'api', notes);

    return {
      success: true,
      message: 'Alert confirmed',
    };
  } catch (error) {
    return reply.status(500).send({
      success: false,
      error: (error as Error).message,
    });
  }
});

fastify.get('/api/wallet/:address/analyze', async (request) => {
  const { address } = request.params as { address: string };

  const analysis = await antiGaming.analyzeWallet(address);

  return {
    success: true,
    data: analysis,
    timestamp: new Date(),
  };
});

// ===========================================
// Multi-Platform Endpoints
// ===========================================

// Trending Topics
fastify.get('/api/trends', async (request, reply) => {
  const { limit = '50' } = request.query as { limit?: string };

  try {
    const trends = await trendDetector.getTrendingTopics(parseInt(limit));

    return {
      success: true,
      data: trends || [],
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn('Failed to get trends', { error: (error as Error).message });
    return {
      success: true,
      data: [],
      message: 'No trend data available yet',
      timestamp: new Date(),
    };
  }
});

fastify.get('/api/trends/:topic', async (request, reply) => {
  const { topic } = request.params as { topic: string };

  const details = await trendDetector.getTopicDetails(topic);

  if (!details) {
    return reply.status(404).send({
      success: false,
      error: 'Topic not found',
    });
  }

  return {
    success: true,
    data: details,
    timestamp: new Date(),
  };
});

// Cross-Platform Signals
fastify.get('/api/cross-signals', async (request, reply) => {
  const { limit = '50' } = request.query as { limit?: string };

  try {
    const signals = await crossPlatformSignals.getSignals(parseInt(limit));

    return {
      success: true,
      data: signals || [],
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn('Failed to get cross-signals', { error: (error as Error).message });
    return {
      success: true,
      data: [],
      message: 'No cross-platform signals available yet',
      timestamp: new Date(),
    };
  }
});

fastify.get('/api/cross-signals/strongest', async (request) => {
  const { limit = '10' } = request.query as { limit?: string };

  const signals = await crossPlatformSignals.getStrongestSignals(parseInt(limit));

  return {
    success: true,
    data: signals,
    timestamp: new Date(),
  };
});

fastify.get('/api/cross-signals/:topic', async (request, reply) => {
  const { topic } = request.params as { topic: string };

  const signal = await crossPlatformSignals.getSignalByTopic(topic);

  if (!signal) {
    return reply.status(404).send({
      success: false,
      error: 'Signal not found for this topic',
    });
  }

  return {
    success: true,
    data: signal,
    timestamp: new Date(),
  };
});

// Unified Leaderboard
fastify.get('/api/leaderboard/unified', async (request, reply) => {
  const { limit = '100' } = request.query as { limit?: string };

  try {
    const leaderboard = await multiPlatformTracker.getUnifiedLeaderboard(parseInt(limit));

    return {
      success: true,
      data: leaderboard || [],
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn('Failed to get unified leaderboard', { error: (error as Error).message });
    return {
      success: true,
      data: [],
      message: 'No leaderboard data available yet',
      timestamp: new Date(),
    };
  }
});

fastify.get('/api/trader/:address', async (request, reply) => {
  const { address } = request.params as { address: string };

  const trader = await multiPlatformTracker.getTraderProfile(address);

  if (!trader) {
    return reply.status(404).send({
      success: false,
      error: 'Trader not found',
    });
  }

  return {
    success: true,
    data: trader,
    timestamp: new Date(),
  };
});

// Smart Money Activity
fastify.get('/api/smart-money/activity', async (request, reply) => {
  const { limit = '100' } = request.query as { limit?: string };

  try {
    const activity = await db.getSmartMoneyActivity(parseInt(limit));

    return {
      success: true,
      data: activity || [],
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn('Failed to get smart money activity', { error: (error as Error).message });
    return {
      success: true,
      data: [],
      message: 'No smart money activity available',
      timestamp: new Date(),
    };
  }
});

fastify.get('/api/smart-money/by-topic/:topic', async (request) => {
  const { topic } = request.params as { topic: string };
  const { limit = '50' } = request.query as { limit?: string };

  const activity = await db.getSmartMoneyByTopic(topic, parseInt(limit));

  return {
    success: true,
    data: activity,
    timestamp: new Date(),
  };
});

// Platform Status
fastify.get('/api/platforms/status', async (request, reply) => {
  try {
    const statuses = await multiPlatformTracker.getPlatformStatuses();

    return {
      success: true,
      data: statuses || [],
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn('Failed to get platform statuses', { error: (error as Error).message });
    return {
      success: true,
      data: [],
      message: 'Platform status unavailable',
      timestamp: new Date(),
    };
  }
});

// ===========================================
// WebSocket for Real-time Signals
// ===========================================

fastify.register(async function (fastify) {
  fastify.get('/api/signals/susomniaribe', { websocket: true }, (connection) => {
    logger.info('WebSocket client connected');

    // Susomniaribe to signal events
    const unsusomniaribe = events.onSignalGenerated((event) => {
      connection.socket.send(
        JSON.stringify({
          type: 'SIGNAL',
          data: event.payload,
          timestamp: event.timestamp,
        })
      );
    });

    // Handle disconnect
    connection.socket.on('close', () => {
      logger.info('WebSocket client disconnected');
      unsusomniaribe();
    });
  });
});

// ===========================================
// Server Lifecycle
// ===========================================

export async function startServer(): Promise<void> {
  try {
    // Start bots
    if (config.features.enableSmartMoney) {
      await smartMoney.start();
    }

    if (config.features.enableAntiGaming) {
      await antiGaming.start();
    }

    // Start multi-platform bots
    await multiPlatformTracker.start();
    await trendDetector.start();
    await crossPlatformSignals.start();

    // Register cascade prevention routes
    await registerCascadeRoutes(fastify);

    // Start server
    await fastify.listen({
      port: config.api.port,
      host: config.api.host,
    });

    logger.info(`API server running on http://${config.api.host}:${config.api.port}`);
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

export async function stopServer(): Promise<void> {
  logger.info('Stopping server...');

  await smartMoney.stop();
  await antiGaming.stop();
  await multiPlatformTracker.stop();
  await trendDetector.stop();
  await crossPlatformSignals.stop();
  await fastify.close();

  logger.info('Server stopped');
}

// ===========================================
// Standalone Execution
// ===========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  process.on('SIGINT', async () => {
    await stopServer();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await stopServer();
    process.exit(0);
  });

  startServer();
}
