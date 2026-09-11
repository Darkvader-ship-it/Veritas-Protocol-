# Veritas Copy Trading Executor

Automated service that monitors leader wallets and executes copy trades for followers.

## Modes

### 1. Production Mode (`index.ts`)
Full execution mode - executes real copy trades on mainnet.

### 2. Simulation Mode (`simulator.ts`) - TESTNET
Test mode that uses **real mainnet data** with **simulated execution**:
- Monitors **real mainnet** DreamDEX Event Contracts bets from leaders
- Checks followers from **testnet** vault
- **Logs** simulated trades to database (no real execution)
- **Tracks virtual PnL** based on real mainnet outcomes

This allows testing copy-trading strategies with zero risk before going live!

## How It Works

1. **Leader Detection**: Automatically discovers leaders from vault contract events
2. **Bet Monitoring**: Watches DreamDEX Event Contracts for leader bets (WebSocket + polling)
3. **Copy Execution**: When a leader bets, executes copy trades for all followers
4. **State Persistence**: Saves state to prevent duplicate executions on restart

## Prerequisites

1. **Executor Wallet**: A Somnia wallet with STT for gas fees
2. **Contract Setup**: The CopyTradingVault must have your executor wallet configured
3. **Node.js**: v18+ recommended

## Setup

### 1. Install Dependencies

```bash
cd services/copy-trading
npm install
```

### 2. Configure Environment

Add to `frontend/.env.local`:

```env
# Copy Trading Executor
EXECUTOR_PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC endpoints
Somnia_RPC_URL=https://somnia-dataseed.somnia.org/
Somnia_WS_URL=wss://somnia-ws-node.nariox.org:443
```

### 3. Set Executor on Contract

The vault contract owner must call `setExecutor(address)` with your executor wallet address:

```solidity
// Using cast (foundry)
cast send $VAULT_ADDRESS "setExecutor(address)" $EXECUTOR_ADDRESS --private-key $OWNER_KEY --rpc-url https://somnia-dataseed.somnia.org/
```

### 4. Fund the Executor

Send at least 0.1 STT to the executor wallet for gas fees.

## Running

### Simulation Mode (Testnet) - Recommended First

```bash
# 1. Create the database table first
# Run the SQL in schema.sql in your Supabase SQL Editor

# 2. Install dependencies
npm install

# 3. Run the simulator
npm run simulate

# Or with auto-reload:
npm run simulate:dev
```

### Production Mode (Mainnet)

```bash
npm run dev    # Development with auto-reload
```

### Production Build

```bash
npm run build
npm run start:prod
```

### With PM2 (recommended for production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the service
pm2 start npm --name "copy-executor" -- run start:prod

# View logs
pm2 logs copy-executor

# Monitor
pm2 monit
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Copy Trading Executor                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  WebSocket  │    │   Polling   │    │   Leader    │     │
│  │  Listener   │    │   Backup    │    │  Discovery  │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └────────┬─────────┴─────────┬────────┘             │
│                  ▼                   ▼                      │
│         ┌─────────────────────────────────┐                │
│         │        Event Handler            │                │
│         │   (Filter leader bets only)     │                │
│         └──────────────┬──────────────────┘                │
│                        ▼                                    │
│         ┌─────────────────────────────────┐                │
│         │     Copy Trade Executor         │                │
│         │   - Get followers               │                │
│         │   - Check balances              │                │
│         │   - Execute batch tx            │                │
│         └──────────────┬──────────────────┘                │
│                        ▼                                    │
│         ┌─────────────────────────────────┐                │
│         │      CopyTradingVault           │                │
│         │   (Somnia Smart Contract)          │                │
│         └─────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EXECUTOR_PRIVATE_KEY` | required | Private key for executor wallet |
| `Somnia_RPC_URL` | somnia rpc | Somnia JSON-RPC endpoint |
| `Somnia_WS_URL` | nariox ws | Somnia WebSocket endpoint |
| `POLL_INTERVAL_MS` | 3000 | Polling interval in ms |
| `MAX_GAS_PRICE_GWEI` | 10 | Max gas price to execute |
| `MIN_COPY_AMOUNT_STT` | 0.001 | Minimum copy amount |

## Monitoring

The service logs to stdout. Key log messages:

- `LEADER BET DETECTED` - A followed leader placed a bet
- `SUCCESS!` - Copy trades executed successfully
- `No eligible followers` - Followers have no balance or already copied
- `Gas too high` - Skipped execution due to high gas

## Troubleshooting

### "Executor wallet mismatch"

The vault contract has a different executor configured. The contract owner needs to call `setExecutor()`.

### "Low executor balance"

Fund the executor wallet with at least 0.1 STT for gas.

### "WebSocket connection failed"

The service will fall back to polling. This is normal if WebSocket endpoint is unavailable.

### No copy trades executing

1. Check if there are followers in the vault
2. Verify followers have deposited funds
3. Ensure leaders are being detected (check logs)

## Security Notes

- The executor private key has limited permissions (only copy trade execution)
- Users can withdraw their funds at any time (with 1-hour timelock)
- The executor cannot access user funds directly
- All trades are recorded on-chain for transparency
