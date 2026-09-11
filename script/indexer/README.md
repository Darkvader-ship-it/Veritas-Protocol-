# Veritas Real User Indexer

This script indexes real DreamDEX Event Contracts users from Somnia mainnet and calculates their theoretical VeritasScores based on historical performance.

## Overview

The indexer:
1. Queries DreamDEXPrediction contract for `BetBull` and `BetBear` events
2. Tracks `Claim` events to identify wins
3. Calculates statistics for each unique user:
   - Total bets placed
   - Win/loss record
   - Total volume wagered
   - Win rate percentage
   - Theoretical VeritasScore
4. Ranks users by VeritasScore
5. Exports top 100 users to `frontend/data/real-users.json`

## Installation

From the project root:

```bash
npm install
```

This installs:
- `viem` - For blockchain interactions
- `tsx` - TypeScript execution
- `@types/node` - TypeScript definitions

## Usage

### Run the Indexer

From the project root:

```bash
npm run index-users
```

This will:
- Connect to Somnia mainnet via public RPC
- Index the last 100,000 blocks (configurable)
- Process all bet and claim events
- Calculate user statistics
- Save results to `frontend/data/real-users.json`

### Configuration

Edit `IndexRealUsers.ts` to customize:

```typescript
// Block range to index
const blocksToIndex = 100000n; // Default: last 100k blocks

// Minimum bets required
const minBets = 5; // Default: 5 bets minimum

// Number of top users to export
const topN = 100; // Default: top 100 users
```

### Output Format

`frontend/data/real-users.json`:

```json
{
  "lastIndexed": 1704067200000,
  "totalUsers": 100,
  "fromBlock": "34500000",
  "toBlock": "34600000",
  "users": [
    {
      "address": "0x1234...",
      "totalBets": 150,
      "totalVolume": "5000000000000000000",
      "wins": 95,
      "losses": 55,
      "unclaimed": 0,
      "winRate": 63.33,
      "veritasScore": 1250,
      "rank": 1,
      "bets": []
    }
  ]
}
```

## VeritasScore Calculation

The theoretical VeritasScore is calculated as:

```
VeritasScore = (winRate × 1000) + (totalBets × 2) + (volumeInSTT / 10)
```

Where:
- `winRate`: Win percentage (0-1) multiplied by 1000
- `totalBets`: Number of prediction rounds participated in
- `volumeInSTT`: Total STT wagered divided by 10

Score is capped between 0-10,000.

### Example:

User with:
- 60% win rate
- 100 total bets
- 10 STT wagered

```
VeritasScore = (0.6 × 1000) + (100 × 2) + (10 / 10)
           = 600 + 200 + 1
           = 801
```

## Frontend Integration

The `UnclaimedReputationBanner` component:

1. Loads `real-users.json` when a wallet connects
2. Checks if the connected address exists in the data
3. Displays a prominent banner showing:
   - User's rank
   - VeritasScore
   - Win rate
   - Total bets
   - "Claim Your Reputation NFT" CTA

### Banner Features

- **Animated entrance** with Framer Motion
- **Session persistence** - Dismisses for current session
- **Mobile responsive** - Adapts to all screen sizes
- **Auto-progress bar** - Visual indicator
- **Touch-friendly** - 44px minimum tap targets

## Performance Notes

### RPC Rate Limits

The indexer includes:
- Batch processing (2000 blocks per batch)
- 100ms delay between batches
- Error handling for failed batches

For faster indexing:
- Use a paid RPC provider (Alchemy, Infura, QuickNode)
- Increase batch size if RPC allows
- Remove delays between batches

### Large Block Ranges

For indexing from contract deployment (~2020):
- Blocks to index: ~15,000,000+
- Estimated time: 2-4 hours (public RPC)
- Recommended: Run overnight or use paid RPC

### Optimization

To index full history efficiently:

```typescript
// Option 1: Increase batch size (if RPC allows)
const batchSize = 10000n;

// Option 2: Save checkpoints
// Modify script to resume from last processed block

// Option 3: Parallel processing
// Split block range across multiple processes
```

## Example Output

```
🚀 Veritas Real User Indexer

═══════════════════════════════════════════════════

📍 Current Somnia block: 34652891

🔍 Indexing range: 100000 blocks
   From: 34552891
   To: 34652891

📊 Fetching bet events from block 34552891 to 34652891...
  Fetching batch: 34552891 to 34554890...
  ✓ Bull bets: 127, Bear bets: 143, Claims: 98
  ...

✅ Total events fetched:
   Bull bets: 12,450
   Bear bets: 13,892
   Claims: 9,234

📈 Processing user statistics...

✅ Processed 3,456 unique users

🎯 Filtered users with 5+ bets: 892
🏆 Selected top 100 users

💾 Data saved to: frontend/data/real-users.json

═══════════════════════════════════════════════════
                    SUMMARY
═══════════════════════════════════════════════════
📅 Last Indexed: 12/31/2024, 11:59:59 PM
📊 Block Range: 34552891 → 34652891
👥 Total Users Indexed: 100

🏆 Top 10 Users:
───────────────────────────────────────────────────
1. 0x1234...5678
   Score: 1850 | Bets: 250 | Win Rate: 68.0%
   Volume: 25.4532 STT

2. 0xabcd...ef01
   Score: 1723 | Bets: 198 | Win Rate: 71.2%
   Volume: 18.9234 STT

...

═══════════════════════════════════════════════════

✅ Indexing complete!
```

## Troubleshooting

### RPC Connection Issues

If you get connection errors:

```typescript
// Use alternative Somnia RPC
const client = createPublicClient({
  chain: somnia,
  transport: http('https://somnia-dataseed2.somnia.org'),
});
```

### Out of Memory

For very large datasets:

```typescript
// Process in smaller chunks
const blocksToIndex = 50000n; // Reduce from 100k

// Or clear bets array to save memory
users: topUsers.map(user => ({
  ...user,
  bets: [], // Already cleared in current version
}))
```

### JSON File Too Large

To reduce file size:

```typescript
// Reduce number of users exported
const topN = 50; // Instead of 100

// Remove unnecessary fields
users: topUsers.map(({ address, veritasScore, rank, winRate, totalBets }) => ({
  address,
  veritasScore,
  rank,
  winRate,
  totalBets,
}))
```

## Next Steps

After indexing:

1. **Deploy Contracts** - Deploy Veritas to Somnia testnet/mainnet
2. **Update ENV** - Add contract addresses to `frontend/.env.local`
3. **Test Banner** - Connect with an indexed wallet address
4. **Allow Registration** - Users can claim their reputation NFT
5. **Re-index Periodically** - Update data weekly/monthly

## Production Considerations

For production use:

- **Automate** - Run indexer via cron job or GitHub Actions
- **Incremental Updates** - Only index new blocks since last run
- **Database** - Store data in PostgreSQL/MongoDB instead of JSON
- **API** - Serve data via backend API instead of static JSON
- **Caching** - Use Redis for frequently accessed data
- **Monitoring** - Alert on indexer failures
