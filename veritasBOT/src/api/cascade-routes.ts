/**
 * Cascade Prevention API Routes
 *
 * Endpoints for managing and querying cascade copy prevention
 */

import type { FastifyInstance } from 'fastify';
import { cascadePreventionService } from '../services/cascade-prevention.js';
import { apiLogger as logger } from '../core/logger.js';

export async function registerCascadeRoutes(fastify: FastifyInstance): Promise<void> {
  // ===========================================
  // Copy Status Endpoints
  // ===========================================

  /**
   * Check if a trader can be copied
   * GET /api/cascade/can-copy/:address
   */
  fastify.get('/api/cascade/can-copy/:address', async (request, reply) => {
    const { address } = request.params as { address: string };

    try {
      const eligibility = await cascadePreventionService.canCopyTrader(address);

      return {
        success: true,
        data: eligibility,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to check copy eligibility', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * Get full copy status for a trader
   * GET /api/cascade/status/:address
   */
  fastify.get('/api/cascade/status/:address', async (request, reply) => {
    const { address } = request.params as { address: string };

    try {
      const status = await cascadePreventionService.getCopyStatus(address);

      return {
        success: true,
        data: status,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get copy status', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * Get copy chain for a trader
   * GET /api/cascade/chain/:address
   */
  fastify.get('/api/cascade/chain/:address', async (request, reply) => {
    const { address } = request.params as { address: string };

    try {
      const chain = await cascadePreventionService.getCopyChain(address);

      return {
        success: true,
        data: {
          address,
          chain,
          depth: chain.length > 0 ? chain[chain.length - 1].depth : 0,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get copy chain', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // ===========================================
  // Follow Management Endpoints
  // ===========================================

  /**
   * Validate a follow request (pre-check before creating)
   * POST /api/cascade/validate-follow
   */
  fastify.post('/api/cascade/validate-follow', async (request, reply) => {
    const { follower, leader } = request.body as { follower: string; leader: string };

    if (!follower || !leader) {
      return reply.status(400).send({
        success: false,
        error: 'follower and leader addresses are required',
      });
    }

    try {
      const validation = await cascadePreventionService.validateFollow(follower, leader);

      return {
        success: true,
        data: validation,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to validate follow', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * Create a new follow with cascade prevention
   * POST /api/cascade/follow
   */
  fastify.post('/api/cascade/follow', async (request, reply) => {
    const { follower, leader, platform = 'all', allocationPercent = 10 } = request.body as {
      follower: string;
      leader: string;
      platform?: string;
      allocationPercent?: number;
    };

    if (!follower || !leader) {
      return reply.status(400).send({
        success: false,
        error: 'follower and leader addresses are required',
      });
    }

    try {
      const result = await cascadePreventionService.createFollow(
        follower,
        leader,
        platform as any,
        allocationPercent
      );

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        message: 'Follow created successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to create follow', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * Check for circular follow
   * GET /api/cascade/circular-check
   */
  fastify.get('/api/cascade/circular-check', async (request, reply) => {
    const { follower, leader } = request.query as { follower: string; leader: string };

    if (!follower || !leader) {
      return reply.status(400).send({
        success: false,
        error: 'follower and leader query params are required',
      });
    }

    try {
      const isCircular = await cascadePreventionService.detectCircularFollow(follower, leader);

      return {
        success: true,
        data: {
          wouldCreateCircle: isCircular,
          message: isCircular
            ? 'This follow would create a circular chain'
            : 'No circular chain detected',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to check circular follow', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // ===========================================
  // Leaderboard Endpoints (Original vs Copy Traders)
  // ===========================================

  /**
   * Get original traders leaderboard (non-copy traders only)
   * GET /api/cascade/leaderboard/original
   */
  fastify.get('/api/cascade/leaderboard/original', async (request, reply) => {
    const { limit = '100' } = request.query as { limit?: string };

    try {
      const { db } = await import('../core/database.js');
      const { data, error } = await db.raw
        .from('original_traders_leaderboard')
        .select('*')
        .limit(parseInt(limit));

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get original traders leaderboard', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * Get copy traders leaderboard
   * GET /api/cascade/leaderboard/copy-traders
   */
  fastify.get('/api/cascade/leaderboard/copy-traders', async (request, reply) => {
    const { limit = '100' } = request.query as { limit?: string };

    try {
      const { db } = await import('../core/database.js');
      const { data, error } = await db.raw
        .from('copy_traders_leaderboard')
        .select('*')
        .limit(parseInt(limit));

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get copy traders leaderboard', error as Error);
      return reply.status(500).send({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // ===========================================
  // Cache Management
  // ===========================================

  /**
   * Get cache stats
   * GET /api/cascade/cache/stats
   */
  fastify.get('/api/cascade/cache/stats', async () => {
    return {
      success: true,
      data: cascadePreventionService.getCacheStats(),
      timestamp: new Date(),
    };
  });

  /**
   * Clear cache
   * POST /api/cascade/cache/clear
   */
  fastify.post('/api/cascade/cache/clear', async () => {
    cascadePreventionService.clearCache();

    return {
      success: true,
      message: 'Cache cleared',
      timestamp: new Date(),
    };
  });

  logger.info('Cascade prevention routes registered');
}

export default registerCascadeRoutes;
