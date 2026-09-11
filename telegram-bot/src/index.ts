// @ts-nocheck
import { Bot, session } from 'grammy';
import { config, validateConfig } from './config';
import {
  handleStart,
  handleHelp,
  handleMarkets,
  handleSearch,
  handleDreamDEXRound,
  handleMyStats,
  handleVeritasScore,
  handleAbout,
  handleSettings,
} from './bot/commands';
import { handleCallbackQuery, handleError } from './bot/handlers';

// Validate configuration
validateConfig();

// Initialize bot
const bot = new Bot(config.telegram.botToken);

// Session middleware for storing user data
bot.use(session({
  initial: () => ({
    userAddress: undefined,
    alerts: [],
    preferences: {
      notificationsEnabled: true,
    },
  }),
}));

// Commands
bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('about', handleAbout);

// Polymarket commands
if (config.features.enablePolymarket) {
  bot.command('markets', handleMarkets);
  bot.command('search', handleSearch);
  bot.command('market', async (ctx) => {
    const marketId = ctx.match as string;
    if (!marketId) {
      await ctx.reply('Please provide a market ID. Example: /market <id>');
      return;
    }
    // Implement market details handler
    await ctx.reply('Market details feature coming soon!');
  });
}

// DreamDEX commands
if (config.features.enableDreamDEX) {
  bot.command('dreamdex', handleDreamDEXRound);
  bot.command('round', async (ctx) => {
    await ctx.reply('Specific round lookup coming soon! Use /dreamdex for current round.');
  });
  bot.command('mystats', async (ctx) => {
    const session = ctx.session as any;
    await handleMyStats(ctx, session.userAddress);
  });
}

// VeritasScore commands
if (config.features.enableVeritasScore) {
  bot.command('score', handleVeritasScore);
  bot.command('myscore', async (ctx) => {
    const session = ctx.session as any;
    if (!session.userAddress) {
      await ctx.reply('Please link your wallet first using /register <address>');
      return;
    }
    ctx.match = session.userAddress;
    await handleVeritasScore(ctx);
  });
  bot.command('register', async (ctx) => {
    const address = ctx.match as string;
    if (!address) {
      await ctx.reply('Please provide your wallet address. Example: /register 0x...');
      return;
    }

    const session = ctx.session as any;
    session.userAddress = address;

    await ctx.reply(
      `✅ Wallet linked successfully!\n\n` +
      `Address: \`${address.slice(0, 6)}...${address.slice(-4)}\`\n\n` +
      `Use /myscore to check your VeritasScore`,
      { parse_mode: 'Markdown' }
    );
  });
  bot.command('leaderboard', async (ctx) => {
    await ctx.reply(
      '🏆 **Global Leaderboard**\n\n' +
      'View the full leaderboard at:\n' +
      'https://veritas.com/leaderboard',
      { parse_mode: 'Markdown' }
    );
  });
}

// Alert commands
bot.command('alerts', async (ctx) => {
  const session = ctx.session as any;
  const alerts = session.alerts || [];

  if (alerts.length === 0) {
    await ctx.reply(
      '🔔 You have no active alerts.\n\n' +
      'Susomniaribe to market updates using:\n' +
      '/susomniaribe <market_id>',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let message = '🔔 **Your Active Alerts**\n\n';
  alerts.forEach((alert: any, index: number) => {
    message += `${index + 1}. ${alert.name}\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('susomniaribe', async (ctx) => {
  await ctx.reply('Alert susomniaription feature coming soon!');
});

bot.command('unsusomniaribe', async (ctx) => {
  await ctx.reply('Alert unsusomniaription feature coming soon!');
});

// Settings command
bot.command('settings', handleSettings);

// Callback query handlers
bot.on('callback_query:data', handleCallbackQuery);

// Error handling
bot.catch(handleError);

// Start the bot
console.log('🚀 Starting Veritas Telegram Bot...');
console.log(`📡 Connected to ${config.blockchain.network} network`);
console.log(`🔧 Features enabled:`);
console.log(`   - Polymarket: ${config.features.enablePolymarket}`);
console.log(`   - DreamDEX: ${config.features.enableDreamDEX}`);
console.log(`   - VeritasScore: ${config.features.enableVeritasScore}`);

bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot started successfully!`);
    console.log(`👤 Bot username: @${botInfo.username}`);
    console.log(`📝 Bot name: ${botInfo.first_name}`);
  },
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n⏸️  Stopping bot...');
  bot.stop();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\n⏸️  Stopping bot...');
  bot.stop();
  process.exit(0);
});
