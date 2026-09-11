# Somnia × DreamDEX Event Contracts Hackathon — Implementation Plan

**Project:** Veritas Protocol (Veritas) + DreamDEX Event Contracts
**Hackathon:** https://dorahacks.io/hackathon/event-contracts/detail
**Deadline:** 8 Sep 2026 18:00 UTC | Prize: 5000 USDso
**Chains:** Somnia Shannon Testnet **50312** (STT / tUSDC) + Mainnet 5031 (SOMI / USDso)
**Repo Root:** `Veritas-Protocol/`
**Prototype Requirement:** **REAL on Shannon Testnet** — no virtual simulation. Every DreamDEX trade is an on-chain `OutcomeToken6909` transaction verifiable on `shannon-explorer.somnia.network`. Other 12 platforms remain paper-trading; DreamDEX is the first live execution platform.

---

## 1. Executive Summary & Strategy

Veritas aggregates 12 prediction platforms into a portable VeritasScore (`frontend/lib/platforms.ts:59`, `veritasscore.ts:193`, `CopyTradingVault.sol:26`). All 12 are currently **simulated** (virtual DB) — see §4 audit. The hackathon edge is to ship the **first REAL execution**: DreamDEX Event Contracts on Somnia.

**Build `Veritas DreamDEX Terminal` — Real Testnet Trading + Reputation:**

1.  **Real CLOB Execution (Core 25% Technical):** Live 15m/1h Up/Down markets via `@somnia-chain/markets-sdk >=0.29.0` with client-side `walletClient` signing. Flows: `faucet tUSDC → approve → mintCompleteSet (1 tUSDC ⇄ 1 Up + 1 Down) → place Up limit IOC (quantized) → cancel → settle → redeem`. Every step returns a Shannon tx hash shown in UI.
2.  **Reputation-Native Trading:** First VeritasScore for high-frequency binary CLOB. Classify `dreamdex` as `BINARY` (`veritasscore.ts:111` Wilson `scoreBinaryTrader:376`) with `CONFIDENCE_SCALE` tuned for 15m frequency. Leaderboard aggregates real DreamDEX PnL.
3.  **Real Copy Trading Vault on Somnia:** Parameterized `DreamDEXCopyVault.sol` (not simulator) — follower `deposit(tUSDC)` → `follow(leader, allocationBps, maxBet)` → executor `batchExecuteCopyTrades` calls `mintCompleteSet` + `placeOrder` on `OutcomeToken6909`. Uses same `CopyTradingVault.sol:26` pattern but with Somnia collateral address.
4.  **Live Orderbook + AI Scout:** Stream `fetchOrderBook(symbol,5)` via SDK `wsRpcUrl`, surface `spread` / `imbalance=(bidVol-askVol)/(bidVol+askVol)` and explain edge. No mock.

This satisfies all 5 DoraHacks gates (working prototype, integration, meaningful SDK use, intuitive UX, adoption impact) with **evidence = explorer txs**, not screenshots.

**Why not simulation:** Judges weight `Technical 25%` on effective SDK use and `Impact 20%` on trading activity. Simulation (26 existing `*/simulate` routes) scores zero for both. Real testnet proves validator clearing, `ERC-6909`, tick grid, and `6-decimal tUSDC` handling.

---

## 2. Key Technical Constraints — Real Testnet

DreamDEX Event Contracts has **no HTTP API** — SDK only. Real execution introduces custody, gas, and precision constraints.

| Constraint | Real Testnet Detail | Implementation |
|---|---|---|
| **SDK Only** | `@somnia-chain/markets-sdk` sole surface; HTTP = spot only | `npm install @somnia-chain/markets-sdk@^0.29.0 viem`. **Reads** server-side `SomniaMarkets({indexerUrl, chain, wsRpcUrl, addresses})`. **Writes** client-side via `walletClient` from `wagmi` (user signs, no server key) |
| **Single Book, ERC-6909** | `1 tUSDC ⇄ 1 Up + 1 Down` (`OutcomeToken6909:0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9`), Up price = `p`, Down = `1-p`, quoted in Up | Use SDK `mintCompleteSet(amount)` / `mergeCompleteSet` / `balanceOf6909`. Never ERC-20 `transfer` |
| **Venue Scoping** | Shannon Testnet `0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c`, Mainnet `0x458b30c...5432d` — changed 3× in week 1 | Filter `m.info.venueId===VENUE_ID && m.active && isBinaryMarket(m.info)` + **on-chain gate** `getMarketOnchain(marketId).status===1` (Trading). Log first market `venueId` on load; banner `Venue mismatch` if zero |
| **Tick Grid** | `InvalidPrice` if price not quantized; `<0.28.0` floats fail | `quantize(price, tickSize)` via `@dreamdex-bot-kit/ec-core` before `createOrder(symbol, "limit", side, size, price, {timeInForce:"IOC"})`. Never raw float |
| **Decimals — Critical** | Shannon tUSDC `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` **6 dec**, Mainnet USDso `0x00000022dA...008A` **18 dec** (×1e12) | Call `collateral.decimals()` dynamically; `parseUnits(amount, decimals)`; display `formatUnits`. Hardcoding `1e18` loses funds |
| **Explicit Redemption** | Winnings not auto-credited; void = `0.5` each side; `Finalized` hidden from `loadMarkets()` | Poll `listBinaryMarkets({venueId, status:"Finalized"})` + `exchange.redeem(marketId)` (user-signed). Toast `Claim 12.5 tUSDC` with tx link. Auto-scan every `600s` inside trading loop to avoid nonce race |
| **Gas** | Shannon STT required for every `mint/place/cancel/redeem` | Faucet `STT` via `testnet.somnia.network` or `t.me/+XHq0F0JXMyhmMzM0`. Show `STT balance` and `Get STT` button if `<0.01` |
| **Somnia Chains** | Shannon `50312` `dream-rpc.somnia.network` `shannon-explorer.somnia.network`, Mainnet `5031` `api.infra.mainnet.somnia.network` | `defineChain` in `frontend/lib/wagmi.ts:11` + `transports` fallbacks `dream-rpc` + `api.infra.testnet` + `thirdweb 50312` |

**CREATE3 (testnet=mainnet):** `BinaryMarketsModule 0x3ecC694Cef705358864a646142ac17A90E29e388`, `MarketsCore 0x2802504314685D89bF6C992CA5a8e7cC78bc0294`, `BinarySettlement 0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23`, `OutcomeToken6909 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9`, `OracleHub 0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b`, `CollateralRouter 0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C`. Per-market `pool` via `markets(marketId)` — never hardcode.

Docs: `docs.dreamdex.io/developers/event-contracts` + `gotchas.md` + `market-structure.md` + `contracts-and-addresses.md` | Bot Kit `github.com/somnia-chain/dreamdex-bot-kit` | Starter `github.com/IronicDeGawd/ec-dreamdex-hackathon-template`

---

## 3. Product Concepts Trade-off

| Concept | Innovation | Tech | UX | Impact | Effort |
|---|---|---|---|---|---|
| **A. Real Terminal (Recommended)** | High (first real execution) | Deep SDK + vault | 2-tap → on-chain | Volume + retention | Medium |
| B. Social Leagues | High | Medium | High | Viral niche | Medium |
| C. Analytics-Only | Medium | Medium | Medium | Low (no trades) | Low |

**A is chosen** because it is the only concept that swaps simulation for verifiable trades — the explicit hackathon impact lever.

---

## 4. Current Frontend Audit — What Is Simulated Today

Full scan: `frontend/app/**/page.tsx` (17), `frontend/app/api/**/route.ts` (50+), `frontend/lib/*.ts` (12 fetchers), `frontend/components/**/*Simulate*`.

**Finding: Veritas is intentionally a paper-trading layer on real market data.** 26 `*/simulate|resolve` routes are virtual by design (`simulated_trades` family, no `eth_sendTransaction`). They are **disclosed** (`Simulation mode`, `virtual USD`, `Simulate trade`). Three market sources silently fall back to curated mock with `isMock:true`; DreamDEX **must not** replicate this — return empty error instead.

### 4.1 Pages

| Page | Status Today | Evidence |
|---|---|---|
| `app/page.tsx:143,637` | Static preview only | `heroScore=847` `page.tsx:143` hardcoded, preview cards `Theo4 95%` `page.tsx:637` static. Real via `useHomePlatformStats()` `page.tsx:66` |
| `app/dashboard/page.tsx:30,293` | **SIMULATED** + demo fixtures | `DEMO_DATA` 5 tiers `page.tsx:30-225` behind `?demo=gold` `page.tsx:293` → bypasses `useAllPlatformStats`. Non-demo = virtual `/api/copy-trading/simulation` |
| `app/markets/page.tsx:52,206` | **MIXED real + `isMock` + always-virtual bets** | 12 tabs `usePlatformMarketsWithFetcher` `page.tsx:52-84` with `isMock` flags. All `GenericSimulateBetModal` → virtual. Banner `Showing simulated data` `page.tsx:206` |
| `app/leaderboard/page.tsx:103,123` | Real default + opt-in simulated toggle | `live` → `/api/unified-leaderboard` (real Wilson). `simulated` → `/api/simulated-leaderboard?platform=` |
| `app/copy-trading/page.tsx:204,541` | **MIXED real vault + simulated copy** | Vault `useReadContract(COPY_VAULT_ADDRESS)` `page.tsx:204` + `deposit` = **real Somnia Testnet**. Guard `0x00→coming soon` `page.tsx:541`. Tabs `SimulationTab` `page.tsx:45-185` → virtual `simulated_trades` |
| `app/profile/[address]/page.tsx:35,315` | Real + `?demo=` | `DEMO_PROFILES` + `DEMO_ADDRESS 0x7a3f...` `page.tsx:35`, trigger `?demo=` `page.tsx:315` → `setProfile(DEMO_PROFILES)` |
| `app/traders/page.tsx:79` | Real | `useDiscoveryTraders(8)` cache, no mock |
| `app/analytics/page.tsx:45` | Real | `fetch('/api/analytics')` DB aggregation |
| `app/monitor/page.tsx:71,120` | Real monitor of simulated trades | Polls `/api/copy-trading/monitor` 10s `page.tsx:71`, header `Real-time simulation monitoring` |
| `app/speed-markets/page.tsx:65,279` | **SIMULATED** | All `/api/speedmarkets/simulate` `page.tsx:65` virtual, static `BTC/ETH` `page.tsx:279` |

### 4.2 API & Lib

| Layer | Simulated | Real | Risk |
|---|---|---|---|
| `*/simulate/route.ts` (12) + `simulate-bet` + `simulated-leaderboard` = **26 routes** | Inserts `polymarket_simulated_trades` etc `status:'pending'` no chain | — | Disclosed — keep for 12 platforms, **do not create for DreamDEX** |
| `*/resolve/route.ts` (12) + `resolve-bets` + `resolve-all` | Real oracle price (`currentEpoch()+rounds()` `dreamdex/resolve:52`) → virtual DB `outcome:'win'/'loss'` | — | — |
| Market data `dreamdex:221 gnosis:183 drift:172` | — | Primary: 5 Somnia RPCs / `api.seer.pm` / `dlob.drift.trade` → `isMock:false` | **Fallback mock:** `generateMockRounds()` 10 rounds `dreamdex:126`, 49 curated `gnosis:76`, 41 price targets `drift:53` with `isMock:true` + banner `markets/page.tsx:206` — easy to miss |
| Other 9 market routes `sxbet/overtime/speedmarkets/limitless/azuro/...` | — | Return empty error `isMock:false` on failure (`overtime:231 speedmarkets:81`) | Safe pattern — **DreamDEX must follow this** |
| `lib/dreamdex.ts:430` | — | Claims `Return empty, want 100% real` `dreamdex.ts:432` but API generates mock | Divergence — align to empty |
| `lib/queries.ts:591,957` | Static `Theo4` fallback `queries.ts:591-599` `veritasScore:1000` if Gamma fails | TanStack hooks, `isMock:boolean` `queries.ts:957` | Gate with `isMock` flag |
| `components/*Simulate*Modal` | All virtual: `SimulateBetModal:113` `No real money`, `GenericSimulateBetModal:434` `No real funds` | — | Correctly named — **DreamDEX will use `DreamDEXTradeModal` with real signing** |

**Rule for DreamDEX:** No `dreamdex/simulate`, no `generateMockMarkets`, no curated fallback. Fail loudly with `isMock:false, markets:[], error:"Shannon RPC unavailable, retry + faucet"` and disable trade buttons.

---

## 5. Detailed Implementation Plan — Real on Shannon

### Phase 0 — Foundations (4-6h, blocks all)

1.  **Chains & Env:** `frontend/lib/wagmi.ts:11` add `defineChain({id:50312, name:'Somnia Shannon', nativeCurrency:{name:'STT', symbol:'STT', decimals:18}, rpcUrls:{default:{http:['https://dream-rpc.somnia.network','https://api.infra.testnet.somnia.network','https://50312.rpc.thirdweb.com']}}, blockExplorers:{default:{name:'Shannon', url:'https://shannon-explorer.somnia.network'}}})` and `5031` mainnet. `transports` with fallbacks. `frontend/.env.example:1` add `NEXT_PUBLIC_SOMNIA_RPC_TESTNET`, `NEXT_PUBLIC_SOMNIA_WS_RPC`, `NEXT_PUBLIC_SOMNIA_VENUE_ID_TESTNET=0x6797...28c`, `NEXT_PUBLIC_COLLATERAL_TUSDC=0x70a86D...25d8E`, `NEXT_PUBLIC_SOMNIA_INDEXER_URL`, `NEXT_PUBLIC_SOMNIA_EXPLORER=https://shannon-explorer.somnia.network`. No `SOMNIA_PRIVATE_KEY` — client signs.
2.  **SDK:** `npm install @somnia-chain/markets-sdk@^0.29.0 viem` (root + `frontend/`). Verify `npx tsc --noEmit`.
3.  **Faucets:** Fund 2 test wallets: `STT` via `testnet.somnia.network` + `t.me/+XHq0F0JXMyhmMzM0`, `tUSDC` via `exchange.trader.faucet()` (10k cap `FaucetCapExceeded`). Log `STT` + `tUSDC` balances for video.

### Phase 1 — Platform Registry (2h, parallel)

4.  **`frontend/lib/platforms.ts:60`** add `dreamdex:{id:'dreamdex', name:'DreamDEX Event Contracts', displayName:'DreamDEX', chain:'Somnia', category:'evm', icon:'💭', gradient:'from-fuchsia-500 to-purple-600', bgGradient:'from-fuchsia-500/20 to-purple-600/20', textColor:'text-fuchsia-400', borderColor:'border-fuchsia-500/50', leaderboardEndpoint:'/api/dreamdex-leaderboard', marketsEndpoint:'/api/dreamdex', website:'https://app.dreamdex.io/event-contracts', marketType:'crypto', currency:'tUSDC', isRealMoney:true, supportsSimulation:false, supportsCopyTrading:true, status:'active'}`. Note: `supportsSimulation:false` — signals real.
5.  **`frontend/lib/veritasscore.ts:111`** add `'dreamdex'` to `BINARY_PLATFORMS` (`BINARY_PLATFORMS` = `dreamdex,speedmarkets,thales,dreamdex`). Wilson `scoreBinaryTrader:376` path. Document high-freq tuning: keep `MIN_BETS_BINARY:30`, propose `CONFIDENCE_SCALE 200→150` for 15m in deck.
6.  **`frontend/lib/queries.ts:1257`** add `dreamdex:'/api/dreamdex'` to `PLATFORM_ENDPOINTS`/`MARKET_ENDPOINTS`.

### Phase 2 — Data Layer — Real Reads (8-10h, core 25%)

7.  **`frontend/lib/dreamdex.ts` NEW (~220L)** clone `limitless.ts` but **real**: `DreamDEXService` wrapping `@somnia-chain/markets-sdk`:
    - `getActiveMarkets(): Promise<{markets: DreamDEXMarket[], venueId, decimals}>` → `exchange.loadMarkets(true)` + filter `isBinaryMarket` + `venueId` + `getMarketOnchain(marketId).status===1`, map to `DreamDEXMarket{symbol, marketId, question, outcomes:[{symbol:Up, price:p},{symbol:Down, price:1-p}], expiresAt:lockTime, venueId, pool}`. Call `decimals()` for collateral. 15s `MemoryCache`.
    - `fetchOrderBook(symbol, depth=5)` → `exchange.fetchOrderBook(symbol, depth)` streamed via `wsRpcUrl`.
    - **Real writes (client-signed):** `mintCompleteSet(amount, walletClient)` → `exchange.mintCompleteSet`, `placeOrder(symbol, side, price, size, walletClient)` via `quantize` + `createOrder(..., {timeInForce:"IOC"})`, `cancelOrder(orderId, walletClient)`, `redeem(marketId, walletClient)` → `binarySettlement.redeem`. Export `fetchDreamDEXMarkets(): Promise<{markets, isMock:false, error?}>` calling `/api/dreamdex?limit=100`. On RPC failure return `{markets:[], isMock:false, error}` — **no mock**.
8.  **`frontend/lib/fetchers/dreamdex-fetcher.ts` NEW (~120L)** `class DreamDEXFetcher extends BasePlatformFetcher` (`market-fetcher.ts:539`): `fetchPage(cursor,limit)` → `loadMarkets(true)` filtered as above → `transformMarket` to `UnifiedMarket{platform:'dreamdex', outcomes:[{id:'UP',probability:p},{id:'DOWN',probability:1-p}], yesPrice:p, noPrice:1-p, volume, liquidity, expiresAt, status:'active', chain:'Somnia', currency:'tUSDC', marketId, symbol, venueId, isMock:false}`. No curated fallback. Register in `frontend/lib/fetchers/index.ts`.
9.  **`frontend/app/api/dreamdex/route.ts` NEW** — **Read-only real proxy** (no private key). `GET ?limit&cursor&search` instantiates `SomniaMarkets({indexerUrl, chain:'shannon', rpcUrl})` read-only, returns `{markets, venueId, decimals, lastLoadMs, isMock:false}` with `RateLimiter` 60/min + `MemoryCache` 15s + optional `unified_markets` upsert for leaderboard. On error `catch → {markets:[], venueId, error:"Shannon RPC unavailable", isMock:false}` + `500`.
10. **`frontend/app/api/dreamdex/health/route.ts` NEW** `GET → {venueId, expectedVenueId, marketCount, tradingCount, lastLoadMs, collateral:{address, decimals}, rpcOk, indexerOk}` for judges' health check.
11. **`frontend/app/api/dreamdex-leaderboard/route.ts` NEW** — aggregates **real** `user_platform_stats` + `bets` where `platform='dreamdex'` (populated by `dreamdex-indexer`). Compute VeritasScore via `calculateVeritasScore` `veritasscore.ts:376`. No `simulated-leaderboard` pattern.
12. **No `dreamdex/simulate` route** — explicit decision. Docs comment `// Real execution: use client walletClient + DreamDEXService.placeOrder — no DB simulation`.

### Phase 3 — On-Chain — Real Indexing & Vault (6-8h)

13. **`contracts/src/interfaces/IDreamDEX.sol` NEW** `struct Market{bytes32 marketId; address pool; uint8 status; uint64 lockTime; uint64 expiry; bytes32 venueId;}` + `BinaryMarketsModule` `getMarketOnchain`, `OutcomeToken6909` `balanceOf / Redeemed`, `BinarySettlement` `redeem`, `CollateralRouter`.
14. **`contracts/src/adapters/DreamDEXAdapter.sol` NEW (~200L)** clone `DreamDEXPredictionAdapter.sol:323` → `IPlatformAdapter` for real reputation: read `OutcomeToken6909` `Transfer` (mint) + `Redeemed` logs via `IPlatformAdapter.PredictionData`, `_isWinningBet` checks `BinarySettlement.winningOutcome == bet.outcome`, `getUserStats` counts `redeemed` wins. Include `decimals()` handling. `platformName()="DreamDEX"`.
15. **Deploy Adapter:** `forge script contracts/script/DeployDreamDEXAdapter.s.sol --rpc-url $SOMNIA_TESTNET_RPC --broadcast` → `cast send $PLATFORM_REGISTRY addPlatform("DreamDEX Event Contracts",$ADAPTER,"https://docs.dreamdex.io",1)` (type `BINARY_PREDICTION`). Record in `deployments/somnia-testnet.json`.
16. **`contracts/src/core/DreamDEXCopyVault.sol` NEW (~300L)** Parameterized from `CopyTradingVault.sol:26` but for Somnia + ERC-6909: `mapping(address→uint256) tUsdcBalances`, `mapping(address→mapping(address→CopySettings)) copySettings`, `COLLATERAL=0x70a86...`, `OUTCOME_6909=0xB52c...`, `BINARY_MODULE=0x3ecC...`, `executor` pattern, `deposit(uint amount)` via `tUSDC.approve`, `follow(leader, allocationBps, maxBet)`, `executeCopyTrade(follower, leader, marketId, isUp, leaderBetAmount) onlyExecutor` computes `copyAmount=min(leaderBetAmount*alloc/10000, maxBet, tUsdcBalances[follower])` → `mintCompleteSet` + `placeOrder` or `batchExecuteCopyTrades`. `withdraw` + `Paused` + `receive()`. Deploy `DeployDreamDEXCopyVault.s.sol --rpc-url $SOMNIA_TESTNET_RPC --broadcast`, `cast send $VAULT setExecutor(executor)`.
17. **`packages/reputation-sdk/src/adapters/dreamdex.ts` NEW** clone `dreamdex.ts` → `DreamDEXAdapter extends BaseAdapter` `platformId='dreamdex' chainId=50312` topics `Minted/Redeemed`, `processInChunks(500,50ms)` for backfill.

### Phase 4 — Product Experience — Real Trading (10-12h)

18. **`frontend/app/dreamdex/page.tsx` NEW** Real Terminal — clone `speed-markets/page.tsx` but wired to Shannon:
    - Header: `Somnia Shannon • Venue ...28c • STT {balance} • tUSDC {balance}` + `Get STT` / `Faucet tUSDC` buttons (calls `exchange.trader.faucet()`).
    - Market list: `useMarkets('dreamdex')` live `Trading` only, search, `expiresAt` countdown, `Up 54¢ / Down 46¢`.
    - Detail: `fetchOrderBook` ladder (bids/asks, spread, depth 5) streamed via `wsRpcUrl`, auto-refresh 2s.
    - **Trade panel (real):** `Buy Up` / `Buy Down` tabs, `Stake (tUSDC)` slider 1-1000, live preview `You pay 50 → payout 92 (max loss 50) if Up wins, 0 if Down`, `Price {p} (quantized {q})`, `Size`, `Place Order` → `walletClient.writeContract` via `DreamDEXService.placeOrder` → toast with `shannon-explorer` tx link + `isMock:false` guard disables button if `market.status!==Trading`.
    - **Positions:** Table `My OutcomeToken6909 balances` + `Open orders` (from `OutcomeToken6909.balanceOf` + `exchange.getOpenOrders`), `Cancel` button (real tx), `Redeem` button when `Finalized` (from `listBinaryMarkets Finalized` poll 60s) → `redeem` tx.
    - Guard: if `venueId mismatch` or `rpcOk===false` show `Live feed unavailable — retry` (no mock markets).
19. **`components/dreamdex/DreamDEXMarketCard.tsx` NEW** + **`components/dreamdex/DreamDEXTradeModal.tsx` NEW** — **Not** `GenericSimulateBetModal` clone for virtual. `DreamDEXTradeModal` props `{market, side, walletAddress}` does `useAccount` + `useWalletClient` + `usePublicClient`, calls `DreamDEXService.placeOrder` with `quantize`, shows `Estimated gas ~0.0001 STT`, `Approve tUSDC` step if `allowance < amount`, success `View on Shannon Explorer https://shannon-explorer.somnia.network/tx/{hash}`. Failure shows `Insufficient STT`, `InvalidPrice — quantized to {q}`, `Insufficient tUSDC`.
20. **`components/dreamdex/DreamDEXOrderBook.tsx` NEW** Ladder `asks` (red) / `bids` (green), `Mid {p}`, `Spread {bps}`, `Imbalance {±%}`.
21. **Copy Trading Real Page `frontend/app/copy-trading/page.tsx` MODIFY** — Add Shannon tab (alongside Somnia vault `page.tsx:204`): `DreamDEX Copy Vault` card reads `DreamDEXCopyVault` `balances[msg.sender]`, `getUserFollows`, `getLeaderFollowers`. Actions: `Deposit tUSDC` (approve flow), `Follow leader` (address + allocation 1-100% + maxBet), `Unfollow`. Display `followedLeaders` from real vault, not `simulated_trades`. Keep Somnia vault unchanged; DreamDEX vault is Somnia `50312`.
22. **AI Scout Panel:** Heuristic `spread`, `imbalance`, `edge=provenWinRate-0.5` `veritasscore.ts:193`, `Top 3 sharpest DreamDEX traders` from `/api/dreamdex-leaderboard`. Stretch LLM narrates orderbook if time.
23. **Leaderboard/Profile:** `frontend/app/leaderboard/page.tsx` + `frontend/app/trader/[address]/page.tsx` filter `platform=dreamdex`, show `tUSDC` volume via `getCurrencySymbol:494`, tier colors `getScoreTierColor:662`.

### Phase 5 — Indexing, Polish & Submission (6-8h)

24. **`services/indexer/dreamdex-indexer.ts` NEW** Real log indexer — mirror `services/indexer/dreamdex-indexer.ts` (10k batch, 10s poll) for `OutcomeToken6909` `Transfer` (mint/merge) + `BinarySettlement.Redeemed` on Shannon `50312`. Upsert `bets{user_address, market_id, outcome, amount, timestamp, status, tx_hash, block_number, platform:'dreamdex'}` + `user_platform_stats`. Trigger `recalc-scores`. Add `services/package.json` `index:dreamdex` `index:dreamdex:shannon`.
25. **No populate-mock script** — Do not create `services/scripts/populate-dreamdex-data.ts` with fake bets. Instead `services/scripts/seed-dreamdex-real.ts` documents faucet + mint + placeOrder steps for demo wallets. If testnet sparse, place 3-5 real trades manually and show tx hashes.
26. **Update Docs:** `README.md:228` add row `DreamDEX Event Contracts | Somnia Shannon 50312 | tUSDC | REAL (CLOB, ERC-6909)`, `DEPLOY.md` Somnia env, `frontend/app/page.tsx:312` marquee →13, note `supportsSimulation:false` for DreamDEX.
27. **QA — Real Testnet Checklist:**
    - Connect wallet → auto-switch to Shannon `50312` → `STT 0.5` + `tUSDC 1000` via faucets → `approve tUSDC` → `mintCompleteSet 10 tUSDC` → verify `OutcomeToken6909 balanceOf` 10 Up + 10 Down on explorer
    - Place `Buy Up 5 tUSDC @0.54` IOC → tx `0x...` on `shannon-explorer` → `Open orders` shows order → `Cancel` → tx
    - Place both sides `Buy Up 0.54 + Buy Down 0.46` with zero inventory → both fill
    - Wait expiry → `Locked` → `Finalized` → `Redeem` → `tUSDC` credited, toast with tx
    - Nonce: place 2 orders quickly → no nonce race (client wallet queues)
    - Decimals: `5 tUSDC` = `5000000` (6 dec) not `5000000000000000000`
    - VeritasScore: `importPredictions` aggregates real `bets` → `leaderboard` updates
    - Copy vault: `deposit 100 tUSDC` → `follow leader 50% max 20` → executor `batchExecuteCopyTrades` → follower balance changes on explorer
28. **Submission Artifacts (DoraHacks):**
    - Working prototype URL (Vercel, Shannon `50312` default, not Somnia)
    - Public GitHub with README Shannon quickstart `Faucet STT → Faucet tUSDC → Approve → Mint → Trade`
    - 2-3min demo video: `Hero (13 platforms, DreamDEX REAL badge) → Orderbook streaming → Place Up (real tx + explorer) → Cancel → Positions → Redeem (real claim) → Copy vault deposit+follow → Leaderboard VeritasScore update`
    - Deck: problem → Veritas x DreamDEX architecture → Real CLOB diagram → Wilson math → Tx hashes → Impact (copy drives volume, reputation imports 12-platform users)
    - SDK feedback report: `venueId drift`, `tick quantization`, `6 vs 18 decimals`, `Finalized` fetch gotcha

---

## 6. File Checklist — Real Execution

```
frontend/lib/wagmi.ts                      MODIFY  add Somnia 50312/5031 + transports
frontend/lib/contracts.ts                  MODIFY  CONTRACTS.somniaTestnet + venueId + collateral 6dec + ABIs
frontend/lib/platforms.ts                  MODIFY  dreamdex id, supportsSimulation:false, currency:tUSDC
frontend/lib/veritasscore.ts                 MODIFY  BINARY_PLATFORMS += dreamdex
frontend/lib/queries.ts                    MODIFY  PLATFORM_ENDPOINTS dreamdex
frontend/lib/dreamdex.ts                   NEW     DreamDEXService (real reads+writes, quantize, decimals)
frontend/lib/fetchers/dreamdex-fetcher.ts  NEW     BasePlatformFetcher, isMock:false only, no curated
frontend/lib/fetchers/index.ts             MODIFY  register DreamDEXFetcher
frontend/app/api/dreamdex/route.ts         NEW     Real read proxy (no key), isMock:false, empty on fail
frontend/app/api/dreamdex/health/route.ts  NEW     venueId, marketCount, decimals, rpcOk
frontend/app/api/dreamdex-leaderboard/route.ts NEW Real leaderboard (bets, not simulated_trades)
contracts/src/interfaces/IDreamDEX.sol     NEW
contracts/src/adapters/DreamDEXAdapter.sol NEW     IPlatformAdapter real logs
contracts/src/core/DreamDEXCopyVault.sol   NEW     Real vault on Somnia (tUSDC + 6909)
contracts/script/DeployDreamDEXAdapter.s.sol NEW
contracts/script/DeployDreamDEXCopyVault.s.sol NEW
packages/reputation-sdk/src/adapters/dreamdex.ts NEW
frontend/app/dreamdex/page.tsx             NEW     Real Terminal (faucet, ladder, trade, positions, redeem)
components/dreamdex/DreamDEXMarketCard.tsx NEW
components/dreamdex/DreamDEXTradeModal.tsx NEW     Real walletClient signing + explorer links
components/dreamdex/DreamDEXOrderBook.tsx  NEW
frontend/app/copy-trading/page.tsx         MODIFY  Add DreamDEX vault tab (real)
services/indexer/dreamdex-indexer.ts       NEW     Real 6909 log indexer (10k/10s)
services/package.json                      MODIFY  index:dreamdex
frontend/.env.example                      MODIFY  SOMNIA RPC/venue/collateral/explorer
DEPLOY.md / README.md                      MODIFY  13 platforms, REAL badge, Shannon quickstart
# Explicitly NOT created:
# frontend/app/api/dreamdex/simulate/route.ts   — no simulation
# services/scripts/populate-dreamdex-data.ts    — no mock data
```

---

## 7. Risks & Mitigations — Real

| Risk | Mitigation |
|---|---|
| VenueId drift → zero markets | Log first market `venueId`, banner `Venue mismatch — check docs`, health `venueId vs expected` |
| Indexer lag vs on-chain `status` | Gate trades on `status===1` only; show `Locked` disabled |
| `InvalidPrice` float | `quantize(price, tickSize)` via `ec-core` before every `createOrder` |
| `6 vs 18` decimals ×1e12 loss | `collateral.decimals()` → `parseUnits(amount, decimals)`; test `5 tUSDC → 5000000` |
| Insufficient `STT` gas | Show `STT 0.002 — Get STT` faucet button if `<0.01`, disable `Place Order` |
| Insufficient `tUSDC` + allowance | Two-step `approve → mint/place`; read `allowance` + `balanceOf` before enable |
| Nonce race on rapid orders | Client `walletClient` queues; auto-claim loop interval `600s` not inside order loop |
| Redemption forgotten (no auto-credit) | Poll `Finalized` 60s, banner `You have 12.5 tUSDC to redeem`, `Redeem` tx |
| RPC instability | `transports` fallbacks `dream-rpc` + `api.infra.testnet` + `thirdweb` |
| Score tier gap `ScoreCalculator 0/500/1000/2000/5000` vs `veritasscore 0/200/400/650/900` | Use off-chain VeritasScore only for hackathon; note alignment in deck |

---

## 8. Timeline

| Day | Focus | Exit — Verifiable on Shannon Explorer |
|---|---|---|
| D1 | Phase 0+1 | Wallet switches to `50312`, `loadMarkets(true)` venue-filtered `>0` on `dream-rpc`, `DreamDEXService` reads `decimals=6` |
| D2 | Phase 2 | `GET /api/dreamdex` live `{isMock:false, markets:[...], venueId}`, `health` green, `fetcher` in `unified_markets` |
| D3 | Phase 4a | `app/dreamdex` ladder streams, `DreamDEXTradeModal` places `Buy Up 5 tUSDC` → tx `0x...` on explorer, `positions` updates |
| D4 | Phase 3+4b | `DreamDEXCopyVault` deployed `0x...` on Shannon, `deposit+follow` → executor copy trade → explorer, `redeem` claim |
| D5 | Phase 5 | `dreamdex-indexer` logs bets → `leaderboard` VeritasScore updates, Vercel Shannon default, video with 3 tx hashes, DoraHacks submit |

<3 days: cut vault deploy + AI LLM, keep Real Terminal + health + leaderboard. Vault shown as `Deploy Script Ready` in deck.

---

## 9. Judging Map — Real Evidence

| Criterion | How Proposal Wins | Evidence |
|---|---|---|
| **Technical 25%** | Deep SDK: `loadMarkets` + `isBinaryMarket` + `getMarketOnchain(status===1)` + `fetchOrderBook(ws)` + quantized `createOrder IOC` + `mintCompleteSet`/`mergeCompleteSet` + `list Finalized` + `redeem` + `decimals()` | Code + explorer txs for each call, `^0.29.0` pinned |
| **Innovation 20%** | First real execution in Veritas (12 remain simulated), Wilson VeritasScore for 15m CLOB, mint-a-pair copy vault | `platforms.ts supportsSimulation:false` + tier `isMock:false` uniqueness |
| **UX 20%** | 2-tap mobile `Pay 50 → payout 92 (max loss 50)`, pro ladder desktop, faucet CTA, approve→trade flow, explorer links | Video 3s tap→tx, `shadcn` + GSAP `page.tsx:78` |
| **Impact 20%** | Real copy vault drives Shannon volume; reputation bridge imports 12-platform users to DreamDEX | Follower `deposit 100tUSDC` → copy `50%` → volume on `BinaryMarketsModule 0x3ecC...` |
| **Presentation 15%** | Live Shannon prototype, not screenshots; health check; SDK feedback | Vercel `50312` + `shannon-explorer/tx/0x...` ×3 + Wilson slide |

---

## 10. Open Questions

1.  Copy vault custody: user-signed `walletClient` only, or add server `executor` for demo automation (needs `setExecutor` + `STT` funding)?
2.  Scope if solo: Terminal + health + leaderboard (D3) vs full vault deploy (D4)?
3.  Supabase: reuse `rrmtzqq...` or isolate Shannon `bets` table?
4.  Branding: new `/dreamdex` route vs filter in `/markets`?

---

## 11. Verification — Real on Shannon

```bash
# Env
npm install @somnia-chain/markets-sdk@^0.29.0 viem
npx tsc --noEmit
forge test --match-contract DreamDEX

# Manual on shannon-explorer.somnia.network
# 1. Connect 0xYourAddr → switch to 50312 → faucet STT 0.5 + tUSDC 1000 → approve tUSDC
# 2. mintCompleteSet 10 tUSDC → 10 Up + 10 Down (tx 0x...)
# 3. placeOrder Up 5 @0.54 IOC → quantized 0.54 → tx 0x... → OrderBook updates
# 4. cancel → tx 0x...
# 5. Wait expiry → Finalized → redeem → tUSDC +10 if Up won, 0 if loss, 5 if void → tx 0x...
# 6. Copy: deposit 100 tUSDC to DreamDEXCopyVault → follow 0xLeader 50% → leader places 10 → executor batch → explorer
# 7. Leaderboard: /api/dreamdex-leaderboard shows veritasScore update, /api/dreamdex/health shows tradingCount
```

---

## 12. References

- Docs: `docs.dreamdex.io/developers/event-contracts?ask=`
- NPM: `npmjs.com/package/@somnia-chain/markets-sdk`
- Bot Kit: `github.com/somnia-chain/dreamdex-bot-kit/docs/event-contracts.md`
- Starter: `github.com/IronicDeGawd/ec-dreamdex-hackathon-template/SKILL.md`
- DoraHacks: `dorahacks.io/hackathon/event-contracts/detail`
- Somnia: `docs.somnia.network/developer/network-info`
- Telegram Faucet: `t.me/+XHq0F0JXMyhmMzM0`
- Explorers: `shannon-explorer.somnia.network` (Shannon 50312), `explorer.somnia.network` (Mainnet 5031)

---

## 13. Appendix — Frontend Simulation vs Real Matrix (for reviewers)

| Area | DreamDEX (This Proposal) | Other 12 Platforms (Unchanged) |
|---|---|---|
| Execution | **REAL** client `walletClient` → `OutcomeToken6909` on Shannon | Simulated DB `simulated_trades` + virtual `Simulate*Modal` |
| API | `GET /api/dreamdex` real SDK read, `isMock:false` empty on fail | `GET /api/<platform>` + `*/simulate` virtual inserts |
| Settlement | Real `OracleHub` → `BinarySettlement` → `redeem` tx | Real oracle price → virtual DB `outcome win/loss` |
| Fallback | **None — fail loudly** | 3 curated mocks `dreamdex:126 gnosis:76 drift:53` with `isMock:true` (keep banner) |
| Copy | **Real** `DreamDEXCopyVault` on `50312` | `copy-trading/simulator.ts` virtual PnL (Somnia) |
| Scoring | Real `bets` → VeritasScore Wilson | Simulated bets → VeritasScore (same math, different source) |
| Evidence | `shannon-explorer` tx hashes in UI | `isMock` badges, `virtual USD` labels |
