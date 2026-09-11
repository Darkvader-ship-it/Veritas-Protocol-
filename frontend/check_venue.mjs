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
  const client = exchange.client;
  console.log('Checking venue 0x6797...');
  try {
    const live = await client.listLiveBinaryMarkets({ venueId: '0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c', limit: 5 });
    console.log('live for venue:', live.length);
    console.log(JSON.stringify(live.slice(0,1), null, 2).slice(0,3000));
  } catch (e) { console.log('live failed', e.message.slice(0,1000)); }

  try {
    const allLive = await client.listLiveBinaryMarkets({ limit: 5 });
    console.log('all live markets:', allLive.length);
    console.log(JSON.stringify(allLive.slice(0,2).map(m=>({venueId: m.venueId, symbol: m.symbol, marketId: m.marketId.slice(0,10)})), null, 2));
  } catch (e) { console.log('all live failed', e.message.slice(0,1000)); }

  try {
    const creators = await client.listMarketCreators?.();
    console.log('creators:', creators?.length);
    console.log(JSON.stringify(creators?.slice(0,1), null, 2).slice(0,3000));
  } catch (e) { console.log('creators failed', e.message.slice(0,1000)); }
}
run().catch(console.error);
