import { SomniaMarkets } from '@somnia-chain/markets-sdk';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';
import { SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';

const exchange = new SomniaMarkets({
  chain: somniaShannon,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  indexerUrl: 'https://dev.smk.somnia.host/v1/graphql',
  wsRpcUrl: 'wss://dream-rpc.somnia.network/ws',
  privateKey: '0x89f545254ca9cdfa2241d2ef7d6cfa9cbee2c7f4cbfaacc81222666bbe8ba313',
});

async function run() {
  const venueId = '0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c';
  await exchange.loadMarkets(true);
  const allMarkets = await exchange.fetchMarkets();
  console.log('allMarkets total', allMarkets.length);
  console.log('binary count', allMarkets.filter(m=>m.type==='binary').length);
  const binary = allMarkets.filter(m=>m.type==='binary');
  for (const m of binary.slice(0,3)) {
    console.log('market', m.id, 'venueId', (m.info as any)?.venueId, 'status', (m.info as any)?.status, 'active', m.active, 'type', m.type);
  }
  // Try our filter
  const filtered = allMarkets.filter((m) => {
    if (m.type !== 'binary') return false;
    const info = m.info as any;
    const mVenueId = info.venueId || info.venue?.venueId;
    if (mVenueId && mVenueId.toLowerCase() !== venueId.toLowerCase()) return false;
    const status = info.status;
    if (status && status !== 'Trading') return false;
    if (!m.active) return false;
    return true;
  });
  console.log('filtered count', filtered.length);
  console.log('filtered ids', filtered.map(m=>m.id).slice(0,5));

  // Try listLiveBinaryMarkets
  const live = await exchange.client.listLiveBinaryMarkets({ venueId, limit: 5 });
  console.log('listLive count', live.length);
  console.log(live.map(m=>({id: m.marketId, status: m.status, venueId: m.venueId})).slice(0,5));
}
run().catch(console.error);
