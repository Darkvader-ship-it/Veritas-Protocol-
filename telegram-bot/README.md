# Veritas Telegram Bot

> Multi-platform prediction market monitoring and reputation tracking bot for Telegram

## Features

### 🎯 Multi-Platform Support

- **Polymarket Integration**
  - Browse trending and active prediction markets
  - Search markets by keywords
  - Real-time market probabilities and volumes
  - Price change alerts (coming soon)

- **DreamDEX Event Contracts**
  - Current round monitoring
  - Historical round lookup
  - User statistics and win rate tracking
  - Round start/end notifications (coming soon)

- **Veritas Reputation**
  - Check VeritasScore for any address
  - Link wallet to track personal stats
  - View global leaderboards
  - Track multi-platform reputation

### 🔔 Alert System (Coming Soon)

- Price change notifications
- Volume spike alerts
- New market announcements
- Round start/end reminders
- Custom threshold settings

## Setup

### Prerequisites

- Node.js 18+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Somnia RPC access
- Veritas contracts deployed

### Installation

1. **Install dependencies:**
   ```bash
   cd telegram-bot
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```env
   # Required
   TELEGRAM_BOT_TOKEN=your_bot_token_here

   # Contract addresses (update after deployment)
   VERITAS_CORE_ADDRESS=0x...
   REPUTATION_NFT_ADDRESS=0x...

   # Optional customization
   NETWORK=testnet
   ENABLE_POLYMARKET=true
   ENABLE_DREAMDEXSWAP=true
   ENABLE_VERITASSCORE=true
   ```

### Running the Bot

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

**Using PM2 (recommended for production):**
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name veritas-bot
pm2 save
pm2 startup
```

## Bot Commands

### General Commands

- `/start` - Welcome message and quick actions
- `/help` - List all available commands
- `/about` - About Veritas platform
- `/settings` - Configure bot preferences

### Polymarket Commands

- `/markets` - View top 5 trending markets
- `/search <query>` - Search markets by keyword
- `/market <id>` - Get detailed market information

### DreamDEX Commands

- `/dreamdex` - Get current prediction round
- `/round <epoch>` - Get specific round details
- `/mystats` - View your DreamDEX statistics

### VeritasScore Commands

- `/score <address>` - Check VeritasScore for any address
- `/myscore` - Check your own VeritasScore
- `/register <address>` - Link your wallet address
- `/leaderboard` - View global rankings

### Alert Commands

- `/alerts` - View your active alerts
- `/susomniaribe <market_id>` - Susomniaribe to market updates
- `/unsusomniaribe <market_id>` - Unsusomniaribe from updates

## Usage Examples

### Check Trending Markets
```
User: /markets
Bot: 📊 Top 5 Trending Markets:

1. Will Bitcoin reach $100k by end of 2024?
   🟢 Yes: 67.3%
   🔴 No: 32.7%
   💰 Volume: $2.4M

[Trade on Polymarket] [Get Alerts]
```

### Monitor DreamDEX Round
```
User: /dreamdex
Bot: 🥞 DreamDEX Event Contracts Round 12345

🔒 Lock Price: $245.67
📈 Close Price: $248.23 (+1.04%)

💰 Total Pool: 123.45 STT
🐂 Bull: 78.9 STT (63.9%)
🐻 Bear: 44.55 STT (36.1%)

✅ Round Ended

[Trade on DreamDEX] [Refresh]
```

### Check VeritasScore
```
User: /score 0x1234...5678
Bot: 👑 VeritasScore Profile

📊 VeritasScore: 2,450
🏅 Tier: Platinum

📈 Statistics:
• Total Predictions: 156
• Correct: 98
• Win Rate: 62.8%
• Total Volume: 45.6 STT

🔗 Connected Platforms:
• DreamDEX Event Contracts
• Polymarket

👤 Address: 0x1234...5678

[View Full Profile] [Visit Dashboard]
```

## Architecture

```
telegram-bot/
├── src/
│   ├── bot/
│   │   ├── commands.ts      # Command handlers
│   │   └── handlers.ts      # Callback handlers
│   ├── services/
│   │   ├── polymarket.service.ts    # Polymarket API
│   │   ├── dreamdex.service.ts   # DreamDEX contracts
│   │   └── veritas.service.ts   # Veritas contracts
│   ├── config/
│   │   └── index.ts         # Configuration management
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── index.ts             # Main entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Features Roadmap

### Phase 1: Core Functionality ✅
- [x] Polymarket market browsing
- [x] DreamDEX round monitoring
- [x] VeritasScore lookup
- [x] Basic commands
- [x] Wallet linking

### Phase 2: Alert System 🔄
- [ ] Price change alerts
- [ ] Volume spike notifications
- [ ] New market announcements
- [ ] Round reminders
- [ ] Custom thresholds

### Phase 3: Advanced Features 📋
- [ ] User portfolios
- [ ] Trade history import
- [ ] Performance analytics
- [ ] Group chat support
- [ ] Admin panel

### Phase 4: Automation 📋
- [ ] Auto-trading signals
- [ ] Market analysis
- [ ] Trend detection
- [ ] Copy trading alerts

## Integration with Veritas Web App

The bot seamlessly integrates with the Veritas web platform:

1. **Unified Accounts**: Link wallet in bot to access web dashboard
2. **Reputation Sync**: VeritasScore updates reflect in both platforms
3. **Deep Links**: Bot provides direct links to web profiles
4. **Consistent Data**: Shared blockchain data ensures accuracy

## Security

- Bot never requests private keys
- Wallet linking is for read-only access
- Contract interactions require web wallet
- User data stored locally in session
- No sensitive data transmitted

## Troubleshooting

### Bot not responding
- Check if bot process is running
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure network connectivity

### Market data not loading
- Check Polymarket API status
- Verify internet connection
- Clear cache and retry

### Contract data errors
- Verify contract addresses in `.env`
- Check RPC endpoint is responsive
- Confirm network selection (testnet/mainnet)

## Support

- 🌐 Website: https://veritas.com
- 📱 Telegram: @veritas
- 📧 Email: support@veritas.com
- 🐛 Issues: GitHub Issues

## License

MIT License - see LICENSE file for details

---

Built with ❤️ for the Seedify Prediction Markets Hackathon on Somnia
