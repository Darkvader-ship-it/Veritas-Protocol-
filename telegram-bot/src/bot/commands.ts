// @ts-nocheck
import { InlineKeyboard } from 'grammy';
import { polymarketService } from '../services/polymarket.service';
import { MyContext } from '../types';
import { dreamdexSwapService } from '../services/dreamdex.service';
import { veritasService } from '../services/veritas.service';
import { config } from '../config';

export async function handleStart(ctx: MyContext) {
  const welcomeMessage = `
🎯 **Welcome to Veritas Bot!**

Your all-in-one bot for prediction market monitoring and reputation tracking.

**Features:**
${config.features.enablePolymarket ? '✅ Polymarket - Real-time market alerts' : ''}
${config.features.enableDreamDEX ? '✅ DreamDEX Event Contracts - Round monitoring' : ''}
${config.features.enableVeritasScore ? '✅ VeritasScore - Track your reputation' : ''}

**Quick Start:**
Use /help to see all available commands
`;

  const keyboard = new InlineKeyboard()
    .text('📊 Browse Markets', 'markets')
    .row()
    .text('🥞 Current Round', 'dreamdex_round')
    .row()
    .text('📈 My VeritasScore', 'my_score')
    .row()
    .text('⚙️ Settings', 'settings');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleHelp(ctx: MyContext) {
  const helpMessage = `
📚 **Veritas Bot - Commands**

**Polymarket:**
/markets - Browse trending prediction markets
/search <query> - Search for specific markets
/market <id> - Get details about a market

**DreamDEX Event Contracts:**
/dreamdex - Get current round info
/round <epoch> - Get specific round details
/mystats - Your DreamDEX statistics

**VeritasScore:**
/score <address> - Check VeritasScore for an address
/myscore - Check your VeritasScore
/register <address> - Link your wallet address
/leaderboard - View top predictors

**Alerts:**
/alerts - Manage your alerts
/susomniaribe <market_id> - Susomniaribe to market updates
/unsusomniaribe <market_id> - Unsusomniaribe from updates

**General:**
/help - Show this help message
/settings - Configure your preferences
/about - About Veritas
`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

export async function handleMarkets(ctx: MyContext) {
  await ctx.reply('🔍 Fetching trending markets...');

  try {
    const markets = await polymarketService.getTrendingMarkets(5);

    if (markets.length === 0) {
      await ctx.reply('No markets found at the moment.');
      return;
    }

    await ctx.reply('📊 **Top 5 Trending Markets:**', { parse_mode: 'Markdown' });

    for (const market of markets) {
      const message = polymarketService.formatMarketMessage(market);
      const keyboard = new InlineKeyboard()
        .url('Trade on Polymarket', `https://polymarket.com/event/${market.marketSlug}`)
        .row()
        .text('Get Alerts', `alert_${market.id}`);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error('Error in handleMarkets:', error);
    await ctx.reply('❌ Failed to fetch markets. Please try again later.');
  }
}

export async function handleSearch(ctx: MyContext) {
  const query = ctx.match as string;

  if (!query || query.trim() === '') {
    await ctx.reply('Please provide a search query. Example: /search election');
    return;
  }

  await ctx.reply(`🔍 Searching for "${query}"...`);

  try {
    const markets = await polymarketService.searchMarkets(query, 5);

    if (markets.length === 0) {
      await ctx.reply('No markets found matching your search.');
      return;
    }

    await ctx.reply(`Found ${markets.length} market(s):`, { parse_mode: 'Markdown' });

    for (const market of markets) {
      const message = polymarketService.formatMarketMessage(market);
      const keyboard = new InlineKeyboard()
        .url('View on Polymarket', `https://polymarket.com/event/${market.marketSlug}`);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error('Error in handleSearch:', error);
    await ctx.reply('❌ Failed to search markets. Please try again later.');
  }
}

export async function handleDreamDEXRound(ctx: MyContext) {
  await ctx.reply('🥞 Fetching current DreamDEX Event Contracts round...');

  try {
    const round = await dreamdexSwapService.getCurrentRound();

    if (!round) {
      await ctx.reply('❌ Failed to fetch round data. Please try again later.');
      return;
    }

    const message = dreamdexSwapService.formatRoundMessage(round);
    const keyboard = new InlineKeyboard()
      .url('Trade on DreamDEX', 'https://dreamdex.finance/prediction')
      .row()
      .text('Refresh', 'refresh_dreamdex');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error in handleDreamDEXRound:', error);
    await ctx.reply('❌ Failed to fetch round data. Please try again later.');
  }
}

export async function handleMyStats(ctx: MyContext, userAddress?: string) {
  if (!userAddress) {
    await ctx.reply('Please link your wallet address first using /register <address>');
    return;
  }

  await ctx.reply('📊 Calculating your DreamDEX statistics...');

  try {
    const stats = await dreamdexSwapService.calculateWinRate(userAddress, 50);

    let message = '🥞 **Your DreamDEX Statistics**\n\n';
    message += `📈 Total Rounds: ${stats.total}\n`;
    message += `✅ Wins: ${stats.wins}\n`;
    message += `❌ Losses: ${stats.total - stats.wins}\n`;
    message += `🎯 Win Rate: ${stats.winRate.toFixed(1)}%\n`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleMyStats:', error);
    await ctx.reply('❌ Failed to fetch your statistics. Please try again later.');
  }
}

export async function handleVeritasScore(ctx: MyContext) {
  const address = ctx.match as string;

  if (!address || !veritasService.isValidAddress(address)) {
    await ctx.reply('Please provide a valid address. Example: /score 0x...');
    return;
  }

  await ctx.reply('🔍 Fetching VeritasScore data...');

  try {
    const data = await veritasService.getVeritasScore(address);

    if (!data) {
      await ctx.reply('❌ This address is not registered with Veritas. Visit https://veritas.com to register!');
      return;
    }

    const message = veritasService.formatVeritasScoreMessage(data);
    const keyboard = new InlineKeyboard()
      .url('View Full Profile', `https://veritas.com/profile/${address}`)
      .row()
      .url('Visit Dashboard', 'https://veritas.com/dashboard');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error in handleVeritasScore:', error);
    await ctx.reply('❌ Failed to fetch VeritasScore. Please try again later.');
  }
}

export async function handleAbout(ctx: MyContext) {
  const aboutMessage = `
🎯 **About Veritas**

Veritas is a universal reputation system for prediction market traders. Track your accuracy across multiple platforms and build verifiable on-chain reputation.

**Platforms Supported:**
• Polymarket - Decentralized prediction markets
• DreamDEX Event Contracts - STT price predictions
• More coming soon!

**Features:**
📊 VeritasScore - Universal reputation metric
🏆 Soulbound NFTs - Non-transferable reputation tokens
📈 Multi-platform tracking - Import from any supported platform
🎖️ Tier system - Bronze to Diamond rankings
🌐 Leaderboards - Compete globally

**Links:**
🌐 Website: https://veritas.com
📱 Dashboard: https://veritas.com/dashboard
📊 Leaderboard: https://veritas.com/leaderboard

Built for the Seedify Prediction Markets Hackathon on Somnia.
`;

  const keyboard = new InlineKeyboard()
    .url('Visit Website', 'https://veritas.com')
    .row()
    .url('Join Community', 'https://t.me/veritas');

  await ctx.reply(aboutMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleSettings(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .text('🔔 Alert Settings', 'settings_alerts')
    .row()
    .text('👤 Profile Settings', 'settings_profile')
    .row()
    .text('🔙 Back to Menu', 'back_menu');

  await ctx.reply('⚙️ **Settings**\n\nChoose what you want to configure:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
