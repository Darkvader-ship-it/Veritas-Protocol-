# Speed Markets Dedicated Page

## What Was Created

A complete **Speed Markets** page at `/speed-markets` where you can:
- ✅ View all your Speed Markets bets (pending and completed)
- ✅ Place new bets on BTC/ETH
- ✅ Resolve pending bets with one click
- ✅ See detailed statistics (win rate, total PnL, volume)
- ✅ Track maturity time for pending bets
- ✅ View final prices and outcomes for completed bets

---

## How to Access

### Option 1: Navigation Menu
1. Click **Speed Markets** in the top navigation bar (desktop)
2. Or click the hamburger menu → **Speed Markets** (mobile)

### Option 2: Direct URL
- Local: http://localhost:3003/speed-markets
- Production: https://veritas.xyz/speed-markets

---

## Features

### 📊 Statistics Dashboard

The top section shows:
- **Total Trades** - How many Speed Markets bets you've placed
- **Pending** - Bets waiting for maturity
- **Win Rate** - Percentage of wins (e.g., "60.0% - 6W / 4L")
- **Total PnL** - Your profit/loss in USD

### ⚡ Available Markets

Shows BTC and ETH cards where you can:
- See current price and 24h change
- Click **UP** or **DOWN** to place a bet
- Choose time frame (5 min to 24 hours)
- Set amount ($5 - $200 USD)
- See potential payout (1.9x multiplier)

### 📋 Bet History (Tabs)

#### Pending Tab
Shows bets that haven't matured yet:
- Asset (BTC/ETH) with icon
- Direction (UP/DOWN)
- Strike price
- Amount staked
- Potential win amount
- Time remaining until maturity
- Time frame duration

#### Completed Tab
Shows resolved bets:
- Asset and direction
- Strike price → Final price
- Outcome (WIN/LOSS badge)
- PnL (profit/loss in USD)
- Resolved timestamp

### 🔄 Resolution Button

When you have pending bets:
1. Click **"Resolve Bets (X)"** button at top-right
2. Backend fetches current BTC/ETH prices
3. Compares final price vs strike price
4. Updates outcome (win/loss) and PnL
5. Shows toast notification with results
6. Stats auto-refresh

---

## How Resolution Works

### For Each Pending Bet:

1. **Maturity Check**:
   - Only bets where `current time > maturity` are resolved
   - Bets not yet matured are skipped

2. **Price Comparison**:
   ```typescript
   finalPrice = getCurrentPrice(asset); // BTC or ETH

   // UP wins if price went higher
   if (direction === 'UP') {
     won = finalPrice > strikePrice;
   }

   // DOWN wins if price went lower or stayed same
   if (direction === 'DOWN') {
     won = finalPrice <= strikePrice;
   }
   ```

3. **PnL Calculation**:
   ```typescript
   payout_multiplier = 1.9x

   if (won) {
     pnl = amount * 0.9; // 90% profit
   } else {
     pnl = -amount; // 100% loss
   }
   ```

4. **Database Update**:
   - Sets `outcome` to 'win' or 'loss'
   - Sets `final_price` to current price
   - Sets `pnl_usd` to calculated profit/loss
   - Sets `resolved_at` to current timestamp

---

## Example User Flow

### Placing a Bet

1. Go to **Speed Markets** page
2. See BTC is at $95,000
3. Click **UP** on BTC card
4. Select **5 min** time frame
5. Enter **$50** amount
6. See potential payout: **$95.00** (1.9x)
7. Click **"Place simulated bet"**
8. See success modal
9. Bet appears in **Pending** tab

### Resolving Bets

1. Wait for bet to mature (5 minutes)
2. See "Matured" badge on pending bet
3. Click **"Resolve Bets (1)"** button
4. Backend checks BTC price: **$95,500**
5. Comparison: `$95,500 > $95,000` → You won!
6. Toast shows: "Resolved 1 bets. 1 wins, 0 losses. 0 still pending."
7. Stats update:
   - Total Trades: 1
   - Wins: 1
   - Losses: 0
   - Win Rate: 100.0%
   - Total PnL: +$45.00
8. Bet moves to **Completed** tab with WIN badge

---

## Why Bets Were Stuck in "Pending"

### Problem
You placed Speed Markets bets, but they remained in "pending" status on the dashboard even after maturity.

### Root Cause
1. **No Automatic Resolution** - There's no background job running to auto-resolve bets
2. **Manual Trigger Required** - You must call the `/api/speedmarkets/resolve` endpoint
3. **No Dedicated Page** - There was no UI to view or manage Speed Markets bets

### Solution
✅ Created dedicated Speed Markets page
✅ Added "Resolve Bets" button for one-click resolution
✅ Shows all pending and completed bets
✅ Displays maturity countdown
✅ Added navigation link for easy access

---

## API Endpoints Used

### GET /api/speedmarkets/simulate?follower={address}&limit=50
Fetches your Speed Markets trades.

**Response:**
```json
{
  "trades": [
    {
      "id": 123,
      "asset": "BTC",
      "direction": "UP",
      "amountUsd": 50,
      "strikePrice": 95000,
      "finalPrice": 95500,
      "estimatedPayout": 95,
      "timeFrameSeconds": 300,
      "maturity": "2026-01-24T08:35:00.000Z",
      "outcome": "win",
      "pnlUsd": 45,
      "simulatedAt": "2026-01-24T08:30:00.000Z",
      "resolvedAt": "2026-01-24T08:35:30.000Z"
    }
  ],
  "count": 1
}
```

### GET /api/speedmarkets/simulate?follower={address}&stats=true
Fetches your Speed Markets statistics.

**Response:**
```json
{
  "follower": "0x123...",
  "totalTrades": 10,
  "wins": 6,
  "losses": 4,
  "pending": 2,
  "winRate": "60.0",
  "totalPnlUsd": "120.50",
  "totalVolumeUsd": "500.00"
}
```

### GET /api/speedmarkets/resolve
Resolves all matured pending bets.

**Response:**
```json
{
  "resolved": 5,
  "skipped": 2,
  "pending": 2,
  "wins": 3,
  "losses": 2,
  "winRate": "60.0%",
  "currentPrices": {
    "BTC": 95500,
    "ETH": 2980
  },
  "tradesChecked": 7,
  "duration": 1250,
  "timestamp": "2026-01-24T08:35:00.000Z"
}
```

---

## Files Created

### /app/speed-markets/page.tsx
Main Speed Markets page with:
- Stats cards
- Available markets (BTC/ETH)
- Pending bets list
- Completed bets list
- Resolve button
- Refresh button

### /components/MobileNav.tsx (Modified)
Added Speed Markets link to navigation:
```typescript
{ href: '/speed-markets', label: 'Speed Markets', icon: Zap }
```

---

## Database Schema

Speed Markets bets are stored in the `speed_simulated_trades` table:

```sql
CREATE TABLE speed_simulated_trades (
  id SERIAL PRIMARY KEY,
  follower TEXT NOT NULL,           -- Wallet address (lowercase)
  asset TEXT NOT NULL,               -- 'BTC' or 'ETH'
  direction TEXT NOT NULL,           -- 'UP' or 'DOWN'
  amount_usd NUMERIC NOT NULL,       -- Bet amount in USD
  strike_price NUMERIC NOT NULL,     -- Price at time of bet
  final_price NUMERIC,               -- Price at resolution
  estimated_payout NUMERIC,          -- Potential payout
  time_frame_seconds INT,            -- Time to maturity (seconds)
  maturity TIMESTAMPTZ NOT NULL,     -- When bet matures
  outcome TEXT DEFAULT 'pending',    -- 'pending', 'win', 'loss'
  pnl_usd NUMERIC,                   -- Profit/loss in USD
  simulated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for fast lookups
CREATE INDEX idx_speed_follower ON speed_simulated_trades(follower);
CREATE INDEX idx_speed_outcome ON speed_simulated_trades(outcome);
CREATE INDEX idx_speed_maturity ON speed_simulated_trades(maturity);
```

---

## Testing Checklist

### ✅ View Speed Markets Page
1. Go to http://localhost:3003/speed-markets
2. Connect wallet
3. See stats dashboard (may show 0 if no bets placed)
4. See BTC and ETH market cards

### ✅ Place a Bet
1. Click **UP** on BTC card
2. Select **5 min** time frame
3. Enter **$10** amount
4. Click **"Place simulated bet"**
5. See success modal
6. Click **"View in Dashboard"** or refresh page
7. See bet in **Pending** tab

### ✅ Resolve Bets (Before Maturity)
1. Click **"Resolve Bets (1)"** immediately
2. Toast shows: "Resolved 0 bets. 0 wins, 0 losses. 1 still pending."
3. Bet remains in **Pending** tab

### ✅ Resolve Bets (After Maturity)
1. Wait 5 minutes (or use shorter time frame for testing)
2. See "Matured" badge on pending bet
3. Click **"Resolve Bets (1)"**
4. Toast shows result (e.g., "Resolved 1 bets. 1 wins, 0 losses.")
5. Bet moves to **Completed** tab
6. See final price and PnL
7. Stats update

### ✅ Navigation
1. Click **Speed Markets** in top nav (desktop)
2. Or hamburger menu → **Speed Markets** (mobile)
3. Page loads correctly

---

## Next Steps

### Recommended
1. ✅ **Test Resolution** - Place a bet with 5-minute time frame and wait to resolve
2. ⏳ **Auto-Resolution** - Set up cron job to auto-resolve bets every 5 minutes
3. ⏳ **Real-Time Updates** - Add polling to auto-refresh pending bets
4. ⏳ **Charts** - Add price charts showing strike vs final price
5. ⏳ **Filters** - Add filters for asset (BTC/ETH) and outcome (win/loss)

### Future Enhancements
- Win/loss streak indicator
- Best performing time frames
- Daily/weekly PnL charts
- Export trade history to CSV
- Push notifications for matured bets
- Live price updates on pending bets

---

## Summary

✅ **Created**: Dedicated Speed Markets page at `/speed-markets`
✅ **Added**: Navigation link for easy access
✅ **Implemented**: One-click bet resolution
✅ **Built**: Pending and completed bet views
✅ **Displayed**: Real-time statistics
✅ **Fixed**: Issue of bets being stuck in "pending"

**URL**: http://localhost:3003/speed-markets

Now you can easily view, manage, and resolve your Speed Markets bets!
