import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Polymarket API endpoints
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

interface PolymarketMarket {
  condition_id: string;
  question: string;
  description?: string;
  end_date_iso: string;
  outcomes: string[];
  active: boolean;
  closed: boolean;
}

interface PolymarketTrade {
  id: string;
  market: string;
  asset_id: string;
  maker_address: string;
  taker_address: string;
  side: 'BUY' | 'SELL';
  size: string; // Number of shares
  price: string; // Price per share (0-1)
  timestamp: string;
  transaction_hash?: string;
}

class PolymarketIndexer {
  private platformId: number = 2; // Polymarket platform ID
  private pollingInterval: number = 60000; // 1 minute
  private isRunning: boolean = false;

  async initialize() {
    console.log('🔷 Polymarket Indexer Starting...\n');

    // Verify platform exists
    const { data: platform } = await supabase
      .from('platforms')
      .select('id, name')
      .eq('id', this.platformId)
      .single();

    if (!platform) {
      throw new Error('Polymarket platform not found in database');
    }

    console.log(`✅ Platform: ${platform.name} (ID: ${platform.id})\n`);
  }

  // Fetch active markets from Gamma API
  async fetchActiveMarkets(): Promise<PolymarketMarket[]> {
    try {
      const response = await axios.get(`${GAMMA_API_BASE}/markets`, {
        params: {
          closed: false,
          active: true,
          limit: 100,
        },
      });

      console.log(`📊 Found ${response.data.length || 0} active markets`);
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Error fetching markets:', error.message);
      return [];
    }
  }

  // Fetch trades for a specific market
  async fetchMarketTrades(conditionId: string): Promise<PolymarketTrade[]> {
    try {
      // Note: Polymarket's trade API requires specific endpoints
      // This is a simplified version - you may need to use their subgraph or CLOB API
      const response = await axios.get(`${CLOB_API_BASE}/trades`, {
        params: {
          market: conditionId,
          limit: 100,
        },
      });

      return response.data || [];
    } catch (error: any) {
      console.error(`❌ Error fetching trades for ${conditionId}:`, error.message);
      return [];
    }
  }

  // Index trades from Polymarket
  async indexTrades() {
    console.log('\n🔍 Indexing Polymarket trades...');

    try {
      // Get active markets
      const markets = await this.fetchActiveMarkets();

      if (markets.length === 0) {
        console.log('No active markets found');
        return;
      }

      let totalNewTrades = 0;

      // For each market, fetch recent trades
      for (const market of markets.slice(0, 10)) { // Limit to 10 markets for now
        console.log(`\n📈 Market: ${market.question}`);

        const trades = await this.fetchMarketTrades(market.condition_id);

        for (const trade of trades) {
          // Check if we already have this trade
          const { data: existing } = await supabase
            .from('bets')
            .select('id')
            .eq('tx_hash', trade.id)
            .eq('platform_id', this.platformId)
            .single();

          if (existing) continue; // Skip if already indexed

          // Get or create user for the trader
          const traderAddress = trade.taker_address || trade.maker_address;
          const { data: user } = await this.getOrCreateUser(traderAddress);

          if (!user) {
            console.log(`⚠️  Could not create user for ${traderAddress}`);
            continue;
          }

          // Calculate bet amount (shares * price)
          const shares = parseFloat(trade.size);
          const price = parseFloat(trade.price);
          const amount = shares * price;

          // Insert bet
          const { error } = await supabase.from('bets').insert({
            user_id: user.id,
            platform_id: this.platformId,
            market_id: market.condition_id,
            position: trade.side, // 'BUY' or 'SELL'
            amount: (amount * 1e18).toString(), // Convert to wei-like format
            tx_hash: trade.id,
            timestamp: new Date(trade.timestamp).toISOString(),
            won: null, // Will be updated later when market resolves
          });

          if (error) {
            console.error('❌ Error inserting bet:', error);
          } else {
            totalNewTrades++;
            console.log(`  ✅ Indexed trade: ${trade.side} ${shares} shares @ $${price}`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n✅ Indexed ${totalNewTrades} new trades`);
    } catch (error: any) {
      console.error('❌ Error indexing trades:', error.message);
    }
  }

  // Get or create user by wallet address
  async getOrCreateUser(walletAddress: string) {
    const address = walletAddress.toLowerCase();

    // Check if user exists
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', address)
      .single();

    if (user) return { data: user };

    // Create new user
    return await supabase
      .from('users')
      .insert({ wallet_address: address })
      .select('id')
      .single();
  }

  // Start the indexer with polling
  async start() {
    await this.initialize();
    this.isRunning = true;

    console.log(`⏱️  Polling every ${this.pollingInterval / 1000} seconds\n`);

    while (this.isRunning) {
      try {
        await this.indexTrades();
      } catch (error: any) {
        console.error('❌ Indexing error:', error.message);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
    }
  }

  stop() {
    this.isRunning = false;
    console.log('\n🛑 Polymarket indexer stopped');
  }
}

// Run the indexer
const indexer = new PolymarketIndexer();

indexer.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📴 Shutting down...');
  indexer.stop();
  setTimeout(() => process.exit(0), 1000);
});
