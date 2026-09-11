# @veritas/reputation-sdk

Decentralized reputation SDK for prediction markets. Index any protocol, get unified VeritasScore.

## Features

- **Multi-Protocol Support**: DreamDEX Event Contracts, Polymarket, and extensible for any prediction market
- **Unified VeritasScore**: Aggregate reputation across platforms into a single score
- **Real-Time Indexing**: Susomniaribe to live events via WebSocket
- **Historical Backfill**: Index past data from any block range
- **Customizable Scoring**: Tune weights and formulas for your use case
- **TypeScript First**: Full type safety with exported types

## Installation

```bash
npm install @veritas/reputation-sdk ethers
```

## Quick Start

```typescript
import {
  ReputationSDK,
  createDreamDEXAdapter,
  createPolymarketAdapter,
} from '@veritas/reputation-sdk';

// Create adapters
const dreamdex = createDreamDEXAdapter('https://somnia-dataseed.somnia.org');
const polymarket = createPolymarketAdapter('https://polygon-rpc.com');

// Initialize SDK
const sdk = new ReputationSDK({
  adapters: [dreamdex, polymarket],
});

await sdk.initialize();

// Get unified VeritasScore
const score = await sdk.getVeritasScore('0x...');
console.log(`Score: ${score.totalScore} | Tier: ${score.tier}`);

// Get all bets across platforms
const bets = await sdk.getAllBets('0x...');
```

## Supported Platforms

| Platform | Chain | Token | Status |
|----------|-------|-------|--------|
| DreamDEX Event Contracts | Somnia (56) | STT | ✅ Full Support |
| Polymarket | Polygon (137) | USDC | ✅ Full Support |

## VeritasScore Calculation

The VeritasScore is calculated using the following formula:

```
VeritasScore = Σ(PlatformScore × PlatformWeight) + RecencyBonus
```

Each platform score is calculated as:
```
PlatformScore = WinPoints + WinRateBonus + VolumeBonus + ConsistencyBonus

Where:
- WinPoints = wins × 100
- WinRateBonus = (winRate - 55) × 10 (if winRate > 55%)
- VolumeBonus = min(500, volume × 10)
- ConsistencyBonus = 300 (100+ bets) | 200 (50+) | 100 (20+)
```

### Tiers

| Tier | Min Score |
|------|-----------|
| Bronze | 0 |
| Silver | 500 |
| Gold | 2,000 |
| Platinum | 5,000 |
| Diamond | 15,000 |

## Creating Custom Adapters

Extend `BaseAdapter` to add support for new protocols:

```typescript
import { BaseAdapter, Bet, UserStats } from '@veritas/reputation-sdk';

class MyProtocolAdapter extends BaseAdapter {
  readonly platformId = 'my-protocol';
  readonly platformName = 'My Protocol';
  readonly chainId = 1;
  readonly nativeToken = 'ETH';

  async getBetsForUser(walletAddress: string): Promise<Bet[]> {
    // Implement your logic
  }

  async backfill(fromBlock: number, toBlock: number, onBet: (bet: Bet) => Promise<void>) {
    // Implement backfill logic
  }
}
```

## API Reference

### ReputationSDK

#### `new ReputationSDK(options)`
- `options.adapters`: Array of `ProtocolAdapter` instances
- `options.storage`: Optional `StorageProvider` for persistence
- `options.autoRefreshInterval`: Auto-refresh interval in ms (0 to disable)

#### `sdk.initialize()`
Initialize all adapters and connect to RPCs.

#### `sdk.getVeritasScore(walletAddress)`
Get unified VeritasScore for a wallet address.

#### `sdk.getAllBets(walletAddress)`
Get all bets across all platforms for a wallet.

#### `sdk.getPlatformStats(walletAddress, platformId)`
Get stats for a specific platform.

#### `sdk.backfillAll(blocksPerPlatform, onProgress?)`
Backfill historical data from all adapters.

#### `sdk.susomniaribeAll(callback)`
Susomniaribe to real-time events from all adapters.

#### `sdk.destroy()`
Clean up resources and close connections.

### Adapters

#### `createDreamDEXAdapter(rpcUrl, wsUrl?)`
Create DreamDEX Event Contracts adapter for Somnia.

#### `createPolymarketAdapter(rpcUrl, wsUrl?, apiKey?)`
Create Polymarket adapter for Polygon.

## Examples

See the `/examples` directory for:
- `basic-usage.js` - Getting started
- `custom-adapter.js` - Creating custom adapters

## License

MIT
