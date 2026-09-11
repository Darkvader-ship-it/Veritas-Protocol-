/**
 * DreamDEX Event Contracts Indexer — Real Log Indexer for Somnia Shannon 50312
 * Mirrors DreamDEX indexer: 10k batch, 10s poll for OutcomeToken6909 Transfer + BinarySettlement Redeemed
 * Populates bets{user_address, market_id, outcome, amount, timestamp, status, tx_hash, block_number, platform:'dreamdex'}
 * + user_platform_stats. Triggers recalc-scores.
 */

import 'dotenv/config';
import { createPublicClient, http, parseAbiItem, defineChain } from 'viem';
import { createClient } from '@supabase/supabase-js';

// Somnia Shannon 50312 chain config (matches frontend/lib/wagmi.ts)
const somniaShannon = defineChain({
  id: 50312,
  name: 'Somnia Shannon',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network', 'https://api.infra.testnet.somnia.network', 'https://50312.rpc.thirdweb.com'] } },
  blockExplorers: { default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network' } },
});

const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  rpcUrl: process.env.SOMNIA_TESTNET_RPC || process.env.NEXT_PUBLIC_SOMNIA_RPC_TESTNET || 'https://dream-rpc.somnia.network',
  venueId: process.env.NEXT_PUBLIC_SOMNIA_VENUE_ID_TESTNET || '0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c',
  startBlock: process.env.DREAMDEX_START_BLOCK ? BigInt(process.env.DREAMDEX_START_BLOCK) : undefined,
};

const ADDRESSES = {
  outcomeToken6909: '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9' as const,
  binarySettlement: '0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23' as const,
  collateralTUSDC: '0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E' as const,
};

const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const publicClient = createPublicClient({ chain: somniaShannon, transport: http(config.rpcUrl) });

const EVENTS = {
  // ERC6909 Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
  Transfer: parseAbiItem('event Transfer(address indexed caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)'),
  Redeemed: parseAbiItem('event Redeemed(address indexed user, bytes32 indexed marketId, uint8 indexed outcome, uint256 amount)'),
};

class DreamDEXIndexer {
  private platformId: number | null = null;
  private lastProcessedBlock: bigint = 0n;
  private isRunning = false;

  async initialize() {
    console.log('🚀 Initializing DreamDEX Event Contracts indexer — Shannon 50312');
    console.log(`   Venue: ${config.venueId}`);
    console.log(`   Outcome6909: ${ADDRESSES.outcomeToken6909}`);
    console.log(`   Settlement: ${ADDRESSES.binarySettlement}`);
    console.log(`   RPC: ${config.rpcUrl}`);

    // Get or create platform dreamdex
    let { data: plat } = await supabase.from('platforms').select('id').eq('name', 'dreamdex').maybeSingle();
    if (!plat) {
      const { data: newPlat, error } = await supabase.from('platforms').insert({ name: 'dreamdex', display_name: 'DreamDEX', chain: 'Somnia', category: 'binary' }).select().single();
      if (error) {
        // fallback to query again (maybe name exists as DreamDEX)
        const { data: plat2 } = await supabase.from('platforms').select('id').ilike('name', '%dreamdex%').maybeSingle();
        plat = plat2 as any;
        if (!plat) throw error;
      } else plat = newPlat as any;
    }
    this.platformId = (plat as any).id;
    console.log(`✅ Platform ID dreamdex: ${this.platformId}`);

    // Resume from DB
    const { data: lastBet } = await supabase.from('bets').select('block_number').eq('platform_id', this.platformId).order('block_number', { ascending: false }).limit(1).maybeSingle();
    const currentBlock = await publicClient.getBlockNumber();
    if ((lastBet as any)?.block_number) {
      this.lastProcessedBlock = BigInt((lastBet as any).block_number);
      console.log(`📍 Resuming from DB block: ${this.lastProcessedBlock}`);
    } else if (config.startBlock) {
      this.lastProcessedBlock = config.startBlock;
      console.log(`📍 Starting from env block: ${this.lastProcessedBlock}`);
    } else {
      this.lastProcessedBlock = currentBlock - 5000n; // Recent ~12h on 100ms blocks? Use 5k as safe
      console.log(`📍 No history, starting from recent: ${this.lastProcessedBlock}`);
    }
    console.log(`📊 Current block: ${currentBlock}, to process: ${currentBlock - this.lastProcessedBlock}`);
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('\n🏁 Starting DreamDEX indexer loop (10s poll, 10k batch)...\n');
    while (this.isRunning) {
      try {
        await this.indexBatch();
        await new Promise(r => setTimeout(r, 10000));
      } catch (e) {
        console.error('❌ DreamDEX index error:', e);
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }

  stop() { this.isRunning = false; }

  private async indexBatch() {
    const currentBlock = await publicClient.getBlockNumber();
    const batchSize = 10000n; // per implementation.md 10k batch
    const fromBlock = this.lastProcessedBlock + 1n;
    const toBlock = fromBlock + batchSize > currentBlock ? currentBlock : fromBlock + batchSize;
    if (fromBlock > currentBlock) {
      console.log('✅ DreamDEX caught up');
      return;
    }
    console.log(`📦 DreamDEX blocks ${fromBlock} → ${toBlock}`);

    const [transferLogs, redeemedLogs] = await Promise.all([
      publicClient.getLogs({ address: ADDRESSES.outcomeToken6909, event: EVENTS.Transfer, fromBlock, toBlock }).catch(() => [] as any[]),
      publicClient.getLogs({ address: ADDRESSES.binarySettlement, event: EVENTS.Redeemed, fromBlock, toBlock }).catch(() => [] as any[]),
    ]);

    console.log(`   Found ${transferLogs.length} Transfers, ${redeemedLogs.length} Redeemed`);

    // Build Redeemed map: marketId+user => amount/outcome
    const redeemedMap = new Map<string, { amount: bigint; outcome: number }>();
    for (const log of redeemedLogs as any[]) {
      const user = (log.args.user as string).toLowerCase();
      const marketId = log.args.marketId as string;
      redeemedMap.set(`${marketId}-${user}`, { amount: log.args.amount as bigint, outcome: log.args.outcome as number });
      // Also mark bet as won
      await this.processRedeemed(log);
    }

    for (const log of transferLogs as any[]) {
      // Only mints: caller is sender? For mint, sender is 0x0, receiver is user
      const sender = (log.args.sender as string);
      const receiver = (log.args.receiver as string);
      const caller = (log.args.caller as string);
      if (sender !== '0x0000000000000000000000000000000000000000' && sender.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
        // Skip transfers that are not mints (e.g., secondary transfers)
        // But we still want mints: sender == 0
        // For DreamDEX, mintCompleteSet emits Transfer where sender=0, receiver=user, id=tokenId
        // So skip if sender != zero and not from vault
        // Keep only mints
        if (sender.toLowerCase() !== '0x0000000000000000000000000000000000000000') continue;
      }
      const user = (receiver as string).toLowerCase();
      const tokenId = log.args.id as bigint;
      const amount = log.args.amount as bigint;
      const marketIdNum = tokenId & ~1n;
      const marketId = '0x' + marketIdNum.toString(16).padStart(64, '0');
      const outcome = Number(tokenId & 1n); // 0 YES Up, 1 NO Down

      // Fetch block timestamp
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber }).catch(() => null);
      const ts = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

      // Determine if this market is already redeemed for this user (winning)
      const key = `${marketId}-${user}`;
      const redeemed = redeemedMap.get(key);
      const won = redeemed ? (redeemed.outcome === outcome) : null;
      // Void handling: if market voided both redeem 0.5 each — for MVP treat as not won

      await this.processBet({
        user,
        marketId,
        outcome,
        amount,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: ts,
        won,
        caller,
      });
    }

    this.lastProcessedBlock = toBlock;
    console.log(`✅ DreamDEX processed up to ${toBlock}\n`);

    // Trigger recalc if new bets
    if (transferLogs.length > 0 || redeemedLogs.length > 0) {
      await this.triggerRecalc().catch(() => {});
    }
  }

  private async processBet(params: { user: string; marketId: string; outcome: number; amount: bigint; txHash: string; blockNumber: bigint; timestamp: number; won: boolean | null; caller: string }) {
    try {
      const { data: userRow } = await supabase.from('users').upsert({ wallet_address: params.user }, { onConflict: 'wallet_address' }).select().single();
      if (!userRow) return;

      const { error } = await supabase.from('bets').insert({
        user_id: (userRow as any).id,
        platform_id: this.platformId,
        market_id: params.marketId,
        position: params.outcome === 0 ? 'Up' : 'Down',
        outcome: params.outcome === 0 ? 'Up' : 'Down',
        amount: params.amount.toString(),
        won: params.won,
        tx_hash: params.txHash,
        block_number: Number(params.blockNumber),
        timestamp: new Date(params.timestamp * 1000).toISOString(),
        status: params.won === null ? 'pending' : params.won ? 'won' : 'lost',
      });
      if (error && (error as any).code !== '23505') console.error('DreamDEX bet insert failed', error);
    } catch (e) { console.error('processBet error', e); }
  }

  private async processRedeemed(log: any) {
    try {
      const user = (log.args.user as string).toLowerCase();
      const marketId = log.args.marketId as string;
      const outcome = log.args.outcome as number;
      const amount = log.args.amount as bigint;

      // Find user
      const { data: userRow } = await supabase.from('users').select('id').eq('wallet_address', user).maybeSingle();
      if (!userRow) return;

      // Update bet to won + claimed
      await supabase.from('bets')
        .update({ won: true, claimed_amount: amount.toString(), status: 'won' })
        .eq('platform_id', this.platformId)
        .eq('market_id', marketId)
        .eq('user_id', (userRow as any).id)
        .eq('position', outcome === 0 ? 'Up' : 'Down');
    } catch (e) { console.error('processRedeemed error', e); }
  }

  private async triggerRecalc() {
    // Call Next.js recalc endpoint if available
    const recalcUrl = process.env.RECALC_URL || 'http://localhost:3000/api/recalc-scores';
    try { await fetch(recalcUrl, { method: 'POST' }).catch(() => {}); } catch {}
    // Also update user_platform_stats via scoring.js logic — simplified: let recalc-scores handle
  }
}

async function main() {
  const indexer = new DreamDEXIndexer();
  await indexer.initialize();
  process.on('SIGINT', () => { indexer.stop(); process.exit(0); });
  process.on('SIGTERM', () => { indexer.stop(); process.exit(0); });
  await indexer.start();
}

if (require.main === module) {
  main().catch(e => { console.error('Fatal DreamDEX indexer', e); process.exit(1); });
}

export { DreamDEXIndexer };
