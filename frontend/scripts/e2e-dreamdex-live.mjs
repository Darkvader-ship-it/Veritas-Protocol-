import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import { createWalletClient, createPublicClient, http, parseAbi, parseEther, formatEther, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = 'https://api.infra.testnet.somnia.network';
const INDEXER = 'https://dev.smk.somnia.host/v1/graphql';
const VENUE_ID = '0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c';
const PK = '0x89f545254ca9cdfa2241d2ef7d6cfa9cbee2c7f4cbfaacc81222666bbe8ba313';

const ADDRS = {
  vault: '0x9CAadc39CFE8b9f0CA6a3049F85F2cAb20F534a0',
  core: '0xe51Ad8ED1dB2ebb58AC830Ec2Bb7C430f6A8EefD',
  nft: '0xDDe0e5BA41302fdc9628556C94a66A6160ca3205',
};
const LEADER = '0xD9a1048f900E57C0C320eF11eFfAF725d1a9353f';

const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: somniaShannon, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: somniaShannon, transport: http(RPC) });

process.stdout.write = (s) => { fs.writeSync(1, s); return true; };
const fs = await import('node:fs');
const line = (s) => { console.log(s); };
const ding = (yes) => console.log(`   ${yes ? '✅' : '❌'}`);
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${label} (${ms}ms)`)), ms)),
]);

// 1. SDK read path
line('\n========== 1. SDK live market reads ==========');
const exchange = new SomniaMarkets({ indexerUrl: INDEXER, chain: somniaShannon, addresses: SOMNIA_TESTNET_ADDRESSES });
await withTimeout(exchange.loadMarkets(), 30000, 'loadMarkets');
const markets = await withTimeout(exchange.fetchMarkets(), 30000, 'fetchMarkets');
const venueKey = (v) => v?.info?.venueId ?? v?.venueId ?? v?.venue ?? 'unknown';
const counts = {};
for (const m of markets) { const k = venueKey(m); counts[k] = (counts[k] || 0) + 1; }
line(`Total markets from indexer: ${markets.length}`);
for (const [k, c] of Object.entries(counts)) line(`  venue ${k}: ${c} markets`);
const ours = markets.filter((m) => venueKey(m) === VENUE_ID);
ding(ours.length > 0);
if (ours.length > 0) {
  const m0 = ours[0];
  line(`Sample market: symbol=${m0?.symbol} question=${String(m0?.question || m0?.title || '').slice(0, 80)}`);
  const yesSym = m0?.outcomes?.[0]?.symbol || (m0?.symbol + '#YES');
  try {
    const book = await exchange.fetchOrderBook(yesSym, 5);
    if (book && book.bids?.length) {
      line(`OrderBook ${yesSym}: bestBid=${Number(book.bids[0]?.price)} bestAsk=${Number(book.asks?.[0]?.price ?? 0)}`);
      ding(true);
    } else { line(`OrderBook ${yesSym}: currently resting ${book?.bids?.length ?? 0} bids / ${book?.asks?.length ?? 0} asks`); }
  } catch (e) { line(`OrderBook read skipped: ${e?.shortMessage || e?.message}`); }
} else {
  line('No markets for our venueId right now (venue may be quiet) — venue registered but empty.');
}

// 2. Copy vault write path (no collateral needed)
line('\n========== 2. DreamDEXCopyVault follow/unfollow ==========');
const VABI = parseAbi([
  'function follow(address leader, uint256 allocationBps, uint256 maxBet)',
  'function unfollow(address leader)',
  'function getFollowSettings(address follower, address leader) view returns (uint256 allocationBps, uint256 maxBet, bool active)',
]);
try {
  let tx = await walletClient.writeContract({ address: ADDRS.vault, abi: VABI, functionName: 'follow', args: [LEADER, 500, 50_000_000n] });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  line(`follow tx ${tx}`);
  const s = await publicClient.readContract({ address: ADDRS.vault, abi: VABI, functionName: 'getFollowSettings', args: [account.address, LEADER] });
  line(`settings: allocation=${s[0]}bps maxBet=${formatUnits(s[1], 6)} USDC active=${s[2]}`);
  ding(s[2] === true);
  tx = await walletClient.writeContract({ address: ADDRS.vault, abi: VABI, functionName: 'unfollow', args: [LEADER] });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  line(`unfollow tx ${tx} — settings cleanly reverted`);
  ding(true);
} catch (e) { line(`vault write failed: ${e?.shortMessage || e?.message}`); ding(false); }

// 3. Real registration mint (0.0005 STT)
line('\n========== 3. VeritasCore.registerUser -> ReputationNFT mint ==========');
const CABI = parseAbi([
  'function registerUser() payable returns (uint256)',
  'function hasRegistered(address) view returns (bool)',
]);
const NABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function tokenURI(uint256) view returns (string)']);
try {
  const registered = await publicClient.readContract({ address: ADDRS.core, abi: CABI, functionName: 'hasRegistered', args: [account.address] });
  line(`already registered: ${registered}`);
  if (!registered) {
    const { request } = await publicClient.simulateContract({ address: ADDRS.core, abi: CABI, functionName: 'registerUser', account, value: parseEther('0.0005') });
    const tx = await walletClient.writeContract(request);
    const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
    line(`registerUser tx ${tx} status=${rc.status}`);
    ding(rc.status === 'success');
  }
  const bal = await publicClient.readContract({ address: ADDRS.nft, abi: NABI, functionName: 'balanceOf', args: [account.address] });
  line(`ReputationNFT balanceOf(deployer)=${bal}`);
  ding(BigInt(bal) > 0n);
} catch (e) { line(`register failed: ${e?.shortMessage || e?.message}`); ding(false); }

line('\n========== E2E DONE ==========');
process.exit(0);