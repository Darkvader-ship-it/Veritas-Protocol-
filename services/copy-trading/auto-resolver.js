/**
 * Auto Resolver Service
 *
 * Automatically resolves pending simulated trades across ALL platforms:
 * - DreamDEX (Somnia on-chain)
 * - Polymarket (Gamma API)
 * - Overtime (The Odds API scores)
 * - Limitless (Limitless API)
 * - Speed Markets (Price comparison)
 *
 * Run with: node auto-resolver.js
 * Or via pm2: pm2 start ecosystem.config.js
 *
 * Environment Variables:
 * - FRONTEND_URL: Base URL for API calls (default: http://localhost:3000)
 * - RESOLVE_INTERVAL_MS: How often to check (default: 60000 = 1 minute)
 */

require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

// Configuration
const CONFIG = {
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  RESOLVE_INTERVAL_MS: parseInt(process.env.RESOLVE_INTERVAL_MS) || 60000, // 1 minute default
  PLATFORMS: [
    { name: 'DreamDEX', endpoint: '/api/dreamdex/resolve' },
    { name: 'Polymarket', endpoint: '/api/polymarket/resolve' },
    { name: 'Overtime', endpoint: '/api/overtime/resolve' },
    { name: 'Limitless', endpoint: '/api/limitless/resolve' },
    { name: 'Speed Markets', endpoint: '/api/speedmarkets/resolve' },
    { name: 'Azuro', endpoint: '/api/azuro/resolve' },
    { name: 'SX Bet', endpoint: '/api/sxbet/resolve' },
  ],
};

// Stats tracking
const stats = {
  startTime: new Date(),
  totalRuns: 0,
  totalResolved: 0,
  lastRun: null,
  platformStats: {},
};

/**
 * Call a platform's resolve endpoint
 */
async function resolvePlatform(platform) {
  const url = `${CONFIG.FRONTEND_URL}${platform.endpoint}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Update platform stats
    if (!stats.platformStats[platform.name]) {
      stats.platformStats[platform.name] = { resolved: 0, errors: 0, lastResult: null };
    }

    stats.platformStats[platform.name].resolved += data.resolved || 0;
    stats.platformStats[platform.name].lastResult = {
      resolved: data.resolved || 0,
      pending: data.pending || 0,
      wins: data.wins || 0,
      losses: data.losses || 0,
      winRate: data.winRate || 'N/A',
      duration: data.duration || 0,
    };

    return {
      success: true,
      platform: platform.name,
      resolved: data.resolved || 0,
      pending: data.pending || 0,
    };
  } catch (error) {
    if (!stats.platformStats[platform.name]) {
      stats.platformStats[platform.name] = { resolved: 0, errors: 0, lastResult: null };
    }
    stats.platformStats[platform.name].errors++;

    return {
      success: false,
      platform: platform.name,
      error: error.message,
    };
  }
}

/**
 * Run resolution for all platforms
 */
async function resolveAllPlatforms() {
  const runStart = Date.now();
  stats.totalRuns++;
  stats.lastRun = new Date();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Resolution run #${stats.totalRuns}`);
  console.log('='.repeat(60));

  let totalResolved = 0;
  let totalPending = 0;
  const results = [];

  // Resolve all platforms sequentially to avoid overwhelming the server
  for (const platform of CONFIG.PLATFORMS) {
    const result = await resolvePlatform(platform);
    results.push(result);

    if (result.success) {
      totalResolved += result.resolved;
      totalPending += result.pending;

      if (result.resolved > 0) {
        console.log(`  ✅ ${platform.name}: Resolved ${result.resolved}, ${result.pending} pending`);
      } else if (result.pending > 0) {
        console.log(`  ⏳ ${platform.name}: ${result.pending} pending (none ready)`);
      } else {
        console.log(`  ✓  ${platform.name}: No pending trades`);
      }
    } else {
      console.log(`  ❌ ${platform.name}: ${result.error}`);
    }
  }

  stats.totalResolved += totalResolved;

  const duration = Date.now() - runStart;
  console.log('-'.repeat(60));
  console.log(`Resolved: ${totalResolved} | Pending: ${totalPending} | Duration: ${duration}ms`);
  console.log(`Total resolved (all time): ${stats.totalResolved}`);

  return { totalResolved, totalPending, duration, results };
}

/**
 * Print current stats
 */
function printStats() {
  console.log('\n📊 Auto-Resolver Stats:');
  console.log(`   Running since: ${stats.startTime.toISOString()}`);
  console.log(`   Total runs: ${stats.totalRuns}`);
  console.log(`   Total resolved: ${stats.totalResolved}`);
  console.log(`   Last run: ${stats.lastRun?.toISOString() || 'Never'}`);
  console.log('\n   Platform breakdown:');

  for (const [platform, data] of Object.entries(stats.platformStats)) {
    const lastWinRate = data.lastResult?.winRate || 'N/A';
    console.log(`     ${platform}: ${data.resolved} resolved, ${data.errors} errors, Win rate: ${lastWinRate}`);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         VERITAS AUTO-RESOLVER SERVICE                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Automatically resolves simulated trades across all platforms║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Frontend URL: ${CONFIG.FRONTEND_URL}`);
  console.log(`Resolve interval: ${CONFIG.RESOLVE_INTERVAL_MS / 1000} seconds`);
  console.log(`Platforms: ${CONFIG.PLATFORMS.map(p => p.name).join(', ')}`);
  console.log('');

  // Run immediately on startup
  console.log('Running initial resolution...');
  await resolveAllPlatforms();

  // Set up interval
  console.log(`\nScheduled to run every ${CONFIG.RESOLVE_INTERVAL_MS / 1000} seconds...`);

  setInterval(async () => {
    try {
      await resolveAllPlatforms();
    } catch (error) {
      console.error('Resolution error:', error);
    }
  }, CONFIG.RESOLVE_INTERVAL_MS);

  // Print stats every 10 minutes
  setInterval(() => {
    printStats();
  }, 600000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down auto-resolver...');
    printStats();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nShutting down auto-resolver...');
    printStats();
    process.exit(0);
  });
}

main().catch(console.error);
