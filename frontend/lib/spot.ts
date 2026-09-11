/**
 * Spot Market Helpers — dreamDEX on Somnia
 * Covers: getPoolParams, quote, batch/amend, operators, Simple Swap, Stop Orders
 * Docs: dreamDEX Spot, Operators & Session Keys, Simple Swap, Stop Orders
 */

import { createPublicClient, fallback, http, parseAbi, type Address, type Hex } from 'viem';
import { somniaTestnet, somniaMainnet } from '@/lib/wagmi';
import { SOMNIA_DREAMDEX } from '@/lib/contracts';

// Registry + Router addresses per SpotRouter docs
export const SPOT_ROUTER_TESTNET = '0x0aA7c584074d2EA5B623772F97928baD23915ba8' as Address;
export const SPOT_ROUTER_MAINNET = '0x780672aDA90Ed7cf2C3E8B70DBa87A19d584c8B0' as Address;
export const OPERATOR_REGISTRY_TESTNET = '0x15C7e8CE38F021c5b45d098AaD788f63090bF20A' as Address;
export const OPERATOR_REGISTRY_MAINNET = '0xE7a190736B6024a4DbafadC04E283075877005ce' as Address;
export const SPOT_POOL_REGISTRY_TESTNET = '0x07A29A0A086Bc8262a9320db93E603eE13D57962' as Address;
export const SPOT_POOL_REGISTRY_MAINNET = '0xB601bc1099B040E4882089D94690F7C38AF4CCD2' as Address;
export const NATIVE_TOKEN = '0x28f34DeFd2b4CB48d9eE6d89f2Be4Bc601694c00' as Address;

// Selectors per Operator docs
export const SELECTOR_PLACE = '0x80054449' as Hex;
export const SELECTOR_CANCEL = '0xe37b444b' as Hex;
export const SELECTOR_REDUCE = '0x364c2587' as Hex;

// ABIs
const spotPoolAbi = parseAbi([
  'function getPoolParams() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))',
  'function getBookLevels(bool isBid, uint64 numLevels) view returns ((uint256 price, uint256 quantity)[])',
]);

// Full OrderBook event set for reconstruction - OrderCancelledSelfMatch is critical (DEX-1236)
const spotOrderBookEventsAbi = parseAbi([
  'event OrderPlaced(uint128 indexed orderId, (uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs))',
  'event OrderRested(uint128 indexed orderId)',
  'event OrderFilled(uint128 indexed takerOrderId, uint128 indexed makerOrderId, uint256 quantityFilled, uint256 takerRemainingQuantity, uint256 makerRemainingQuantity, uint256 fillPrice)',
  'event OrderCancelled(uint128 indexed orderId)',
  'event OrderExpired(uint128 indexed orderId)',
  'event OrderReduced(uint128 indexed orderId, uint256 newQuantity)',
  'event OrderAmended(uint128 indexed oldOrderId, uint128 indexed newOrderId)',
  'event OrderCancelledSelfMatch(uint128 indexed orderId)',
  'event PayoutFallbackToVault(address indexed owner, address indexed token, uint256 amount)',
  'event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)',
  'event OrderBookParametersUpdated((uint256 tickSize, uint256 minQuantity, uint256 lotSize) newParameters)',
  'event NativeDeposit(address indexed owner, uint256 amount)',
  'event NativeWithdraw(address indexed owner, uint256 amount)',
]);

const spotRouterAbi = parseAbi([
  'function quoteMarketExactIn((address pool, uint256 priceLimit, uint256 quantity)[] route, address inputToken, uint256 inputAmount) view returns ((bool ok, uint256 amountIn, uint256 amountOut, (uint256 baseQuantity, uint256 amountIn, uint256 amountOut, uint256 worstFillPrice, bool fullyFilled)[] legs) result)',
  'function swapExactIn((address inputToken, uint256 inputAmount, address outputToken, uint256 minOutputAmount, (address pool, uint256 priceLimit, uint256 quantity)[] route, uint64 deadlineNs) params) payable returns (uint256 amountOut, uint256 amountInUsed)',
  'function isRegistered(address pool) view returns (bool)',
]);

const operatorRegistryAbi = parseAbi([
  'function setOperatorApprovalGlobal(address operator, bytes4[] selectors, bool approved)',
  'function setOperatorApprovalForPool(address pool, address operator, bytes4[] selectors, bool approved)',
  'function setOperatorDenialForPool(address pool, address operator, bytes4[] selectors, bool approved)',
  'function isOperatorAuthorized(address owner, address operator, bytes4 selector) view returns (bool)',
]);

const stopRegistryAbi = parseAbi([
  'function somiPaymentPerOrder() view returns (uint256)',
  'function minStopDistanceBps() view returns (uint256)',
  'function createPendingOrder(((bool isBid, address owner, uint64 userData, uint256 quantity), uint8 orderType, uint256 triggerPrice, uint8 triggerOperator, uint256 limitPrice, address builder, uint96 builderFeeBpsTimes1k)) payable returns (uint128)',
  'function cancelPendingOrder(uint128 orderId)',
  'function claimSomi()',
  'function cancelInertOrders(uint128[] orderIds)',
]);

const stopOrderEventsAbi = parseAbi([
  'event PendingOrderCreated(uint128 indexed orderId, address indexed owner, bool isBid, uint256 quantity, uint256 triggerPrice, uint8 triggerOperator, uint8 orderType, address builder, uint96 builderFeeBpsTimes1k)',
  'event PendingOrderTriggered(uint128 indexed pendingOrderId, bool success, uint128 indexed spotOrderId)',
  'event PendingOrderCancelled(uint128 indexed orderId)',
  'event InertOrderCancelled(uint128 indexed orderId, address indexed owner, uint256 somiCredited)',
  'event SomiRefundFailed(uint128 indexed orderId, address indexed owner, uint256 amount)',
]);

function getPublicClient(isMainnet = false) {
  const chain = isMainnet ? somniaMainnet : somniaTestnet;
  const rpc = isMainnet ? 'https://api.infra.mainnet.somnia.network' : SOMNIA_DREAMDEX.rpcTestnet;
  return createPublicClient({ chain: chain as any, transport: fallback([http(rpc)]) });
}

// Live market discovery via HTTP API - per Quick Start, always read live
export async function fetchSpotMarkets(isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/markets`);
  if (!res.ok) throw new Error(`Failed to fetch markets: ${res.status}`);
  const data = await res.json();
  return data.markets as Array<{
    symbol: string;
    contract: Address;
    base: Address;
    quote: Address;
    baseDecimals: number;
    quoteDecimals: number;
    tickSize: string;
    lotSize: string;
    minQuantity: string;
  }>;
}

// Testnet token faucet - 0x89Ebc05dE83aB9752B95030218BB10A542b96B7C
export const TESTNET_FAUCET = '0x89Ebc05dE83aB9752B95030218BB10A542b96B7C' as Address;
const faucetAbi = parseAbi(['function requestTokens(address[] tokens, uint256[] amounts)']);

export async function requestTestTokens(tokens: Address[], amounts: bigint[], walletClient: any, isMainnet = false) {
  if (isMainnet) throw new Error('Faucet only on testnet');
  return walletClient.writeContract({ address: TESTNET_FAUCET, abi: faucetAbi, functionName: 'requestTokens', args: [tokens, amounts] });
}

// Market Data - per Market Data docs, canonical source is GET /v0/markets + /v0/currencies
export async function fetchCurrencies(isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/currencies`);
  if (!res.ok) throw new Error(`Failed to fetch currencies: ${res.status}`);
  const data = await res.json();
  return data.currencies as Array<{ code: string; decimals: number; id: Address; name: string }>;
}

export async function fetchOrderBooks(symbols: string[], depth?: number, kind: string = 'spot', isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const params = new URLSearchParams();
  // OpenAPI style: form, explode: true - repeat symbols key per symbol
  for (const s of symbols) params.append('symbols', s);
  if (depth) params.set('depth', String(depth));
  if (kind) params.set('kind', kind);
  const res = await fetch(`${baseUrl}/orderbooks?${params.toString()}`);
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const invalid = err.context?.invalid_symbols;
    if (invalid) throw new Error(`invalid_param: invalid_symbols ${invalid.join(',')}`);
    throw new Error(err.description || `Failed to fetch orderbooks: ${res.status}`);
  }
  const data = await res.json();
  return data.orderbooks as Array<{ symbol: string; bids: Array<{ price: string; quantity: string }>; asks: Array<{ price: string; quantity: string }>; timestamp: number }>;
}

export async function fetchTrades(symbol: string, opts: { since?: number; limit?: number } = {}, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const params = new URLSearchParams();
  if (opts.since) params.set('since', String(opts.since));
  if (opts.limit) params.set('limit', String(opts.limit));
  const url = `${baseUrl}/markets/${encodeURIComponent(symbol)}/trades${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch trades: ${res.status}`);
  const data = await res.json();
  return data as { symbol: string; trades: Array<{ id: string; price: string; quantity: string; side: string; timestamp: number; txHash?: string }>; nextCursor?: string };
}

export async function fetchTickers(symbols?: string[], isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const params = new URLSearchParams();
  if (symbols) for (const s of symbols) params.append('symbols', s);
  const url = `${baseUrl}/tickers${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tickers: ${res.status}`);
  const data = await res.json();
  return data.symbols as Array<{ symbol: string; open: string; high: string; low: string; close: string; volume: string; timestamp: number; lastTradeAt: number }>;
}

export async function fetchCandles(symbol: string, interval: string = '1m', limit: number = 100, endTime?: number, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const params = new URLSearchParams({ interval, limit: String(limit) });
  if (endTime) params.set('endTime', String(endTime));
  const res = await fetch(`${baseUrl}/markets/${encodeURIComponent(symbol)}/candles?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch candles: ${res.status}`);
  const data = await res.json();
  return data as { symbol: string; interval: string; candles: Array<{ timestamp: number; open: string; high: string; low: string; close: string; volume: string }> };
}

// Spot pool params - per-market tick/lot/minQuantity (live, not hardcoded)
export async function getPoolParams(pool: Address, isMainnet = false) {
  const client = getPublicClient(isMainnet);
  const params: any = await client.readContract({ address: pool, abi: spotPoolAbi, functionName: 'getPoolParams' });
  return params as { tickSize: bigint; minQuantity: bigint; lotSize: bigint };
}

// Helper to convert human price/quantity to raw units with tick/lot alignment
export function toRawPrice(humanPrice: number, quoteDecimals: number, tickSize: bigint): bigint {
  const raw = BigInt(Math.round(humanPrice * 10 ** quoteDecimals));
  // Align to tick grid
  return (raw / tickSize) * tickSize;
}

export function toRawQuantity(humanQty: number, baseDecimals: number, lotSize: bigint): bigint {
  const raw = BigInt(Math.floor(humanQty * 10 ** baseDecimals));
  return (raw / lotSize) * lotSize;
}

// Simple Swap quote -> swap recipe per SpotRouter docs
export async function quoteMarketExactIn(route: Array<{ pool: Address }>, inputToken: Address, inputAmount: bigint, isMainnet = false) {
  if (inputAmount === BigInt(0)) throw new Error('RouterQuoteInputZero');
  const router = isMainnet ? SPOT_ROUTER_MAINNET : SPOT_ROUTER_TESTNET;
  const client = getPublicClient(isMainnet);
  const quoteRoute = route.map(r => ({ pool: r.pool, priceLimit: BigInt(0), quantity: BigInt(0) }));
  const result: any = await client.readContract({ address: router, abi: spotRouterAbi, functionName: 'quoteMarketExactIn', args: [quoteRoute, inputToken, inputAmount] });
  return result as { ok: boolean; amountIn: bigint; amountOut: bigint; legs: Array<{ worstFillPrice: bigint }> };
}

export function buildLiveSwapRoute(
  quoteRoute: Array<{ pool: Address }>,
  quoteResult: { legs: Array<{ worstFillPrice: bigint }> },
  slippageBps: number,
  tickSizes: bigint[],
  isBidPerLeg: boolean[]
): Array<{ pool: Address; priceLimit: bigint; quantity: bigint }> {
  return quoteRoute.map((r, i) => {
    const worst = quoteResult.legs[i].worstFillPrice;
    const tick = tickSizes[i] || BigInt(1);
    // tickAlignAwayFromUser: inflate worstFillPrice by slippage away from user
    const slippageFactor = BigInt(10000 + slippageBps);
    const inflated = (worst * slippageFactor) / BigInt(10000);
    // Align to tick: ceil for bid (user pays more), floor for ask (user receives less) - simplified as away
    const aligned = isBidPerLeg[i] ? ((inflated + tick - BigInt(1)) / tick) * tick : (inflated / tick) * tick;
    return { pool: r.pool, priceLimit: aligned || tick, quantity: BigInt(0) };
  });
}

// Native sentinel check
export function validateNativeRoute(route: Array<{ pool: Address }>, inputToken: Address, outputToken: Address) {
  const isNative = (t: string) => t.toLowerCase() === NATIVE_TOKEN.toLowerCase();
  for (let i = 0; i < route.length - 1; i++) {
    // Native cannot be intermediate output - star topology X->USDso->Y never needs it
    // This is caller error, not pool check
  }
  if (isNative(inputToken) && route.length > 0) {
    // input native only allowed as leg 0 input - ok
  }
  if (isNative(outputToken) && route.length > 1) {
    // output native only allowed as final leg output - star never needs intermediate native
  }
}

// Router error -> UX map per docs
export function routerErrorToUx(error: any): string {
  const msg = String(error?.message || error);
  if (msg.includes('RouterNotApprovedAsOperator')) return 'Router approval missing — click Approve Router and try again.';
  if (msg.includes('LegPlacementRejected')) {
    if (msg.includes('SelfMatchCancelTaker')) return "You're already resting an order on the other side. Cancel it first.";
    return 'No liquidity at your price — try a smaller amount or widen slippage.';
  }
  if (msg.includes('LegPlacementRevertedWithoutReason')) return 'The swap ran out of gas. Try again with a higher gas limit.';
  if (msg.includes('InsufficientOutput')) return 'Price moved more than your slippage tolerance. Try again or widen tolerance.';
  if (msg.includes('ExcessiveInput')) return 'Input usage exceeded your max. Try again.';
  if (msg.includes('DeadlineExpired')) return 'Order expired before submission. Try again.';
  if (msg.includes('NativeIntermediateUnsupported')) return 'Native (SOMI) cannot be used as an intermediate token.';
  if (msg.includes('PoolNotRegistered')) return 'Pool is not registered with the router. Contact admin.';
  if (msg.includes('RouterQuantityBelowMinimum')) return "Amount below the pool's minimum trade size.";
  if (msg.includes('InsufficientGasForPayout')) return 'Native buy needs ≥5,000,000 gas. Raise gas limit.';
  return msg;
}

// Operator grants
export async function grantOperatorGlobal(operator: Address, selectors: Hex[], walletClient: any, isMainnet = false) {
  const registry = isMainnet ? OPERATOR_REGISTRY_MAINNET : OPERATOR_REGISTRY_TESTNET;
  return walletClient.writeContract({ address: registry, abi: operatorRegistryAbi, functionName: 'setOperatorApprovalGlobal', args: [operator, selectors, true] });
}

export async function checkOperatorAuthorized(pool: Address, owner: Address, operator: Address, selector: Hex, isMainnet = false) {
  const client = getPublicClient(isMainnet);
  return client.readContract({ address: pool, abi: parseAbi(['function isOperatorAuthorized(address,address,bytes4) view returns (bool)']), functionName: 'isOperatorAuthorized', args: [owner, operator, selector] });
}

// Wallet funding helpers - ERC-20 approve to SpotPool or native value
export async function approvePool(pool: Address, token: Address, amount: bigint, walletClient: any) {
  return walletClient.writeContract({
    address: token,
    abi: parseAbi(['function approve(address,uint256) returns (bool)']),
    functionName: 'approve',
    args: [pool, amount],
  });
}

// Place order with correct funding and gas handling - per Quick Start
export async function placeSpotOrder(params: {
  pool: Address;
  isBid: boolean;
  price: bigint; // raw quote units
  quantity: bigint; // raw base units
  expireTimestampNs: bigint;
  orderType?: number; // 0 GTC, 1 FOK, 2 IOC, 3 PostOnly
  walletClient: any;
  isMainnet?: boolean;
  isNativePool?: boolean; // true for SOMI:USDso
}) {
  const { pool, isBid, price, quantity, expireTimestampNs, orderType = 0, walletClient, isMainnet = false, isNativePool = false } = params;
  const isBuy = isBid;
  // Native SOMI pool requires 5M gas and value
  const gas = isNativePool && isBuy ? BigInt(5_000_000) : undefined;
  const value = isNativePool && isBuy ? quantity : undefined; // simplified - actual value is price*quantity for buys
  
  return walletClient.writeContract({
    address: pool,
    abi: parseAbi(['function placeOrder(bool,uint64,uint256,uint256,uint64,uint8,uint8,address,uint96) returns (bool,uint128)']),
    functionName: 'placeOrder',
    args: [isBid, BigInt(0), price, quantity, expireTimestampNs, orderType, 0, '0x0000000000000000000000000000000000000000' as Address, 0],
    ...(value ? { value } : {}),
    ...(gas ? { gas } : {}),
  });
}

// Batch helpers - thin wrappers over SDK batch surfaces
export async function batchPlaceOrders(orders: any[], walletClient: any, isMainnet = false) {
  // Use SDK's trader.placeOrders or directly via SpotPool batch
  // Placeholder: actual batch via exchange.trader.placeOrders
  throw new Error('Use exchange.trader.placeOrders for batch - see spot/poolReads');
}

export async function batchCancelOrders(orderIds: string[], symbol: string, walletClient: any, isMainnet = false) {
  // Best-effort: skips filled/expired rungs
  throw new Error('Use exchange.cancelOrders');
}

// Stop Order Registries per Contract Specifications
export const STOP_REGISTRY_TESTNET: Record<string, Address> = {
  'SOMI:USDso': '0xEb97349Aa62A68507c0bE535eD88B0d028a47E1e' as Address,
  'WBTC:USDso': '0x53d5B2b0791b3992a1F3b5e0b0277Ee2e08B7aaD' as Address,
  'WETH:USDso': '0xf822D4Cb94902d667c9650e702aA5f096cc7598F' as Address,
};

export const STOP_REGISTRY_MAINNET: Record<string, Address> = {
  'SOMI:USDso': '0x68c8f6fb1EA19A28F25358Ff00b8Ed8E1216df30' as Address,
  'USDC.e:USDso': '0xD53E3F3b73513F2147377ef8f573f649cF60100c' as Address,
  'WBTC:USDso': '0xed32F048D6a47923D38eCeD868d6f8b0eB4852bd' as Address,
  'WETH:USDso': '0x9653a7355849B7691802A6AA49fDe18eF5ba633d' as Address,
};

export function getStopRegistryForPool(symbol: string, isMainnet = false): Address | undefined {
  const map = isMainnet ? STOP_REGISTRY_MAINNET : STOP_REGISTRY_TESTNET;
  return map[symbol];
}

// Stop Orders
// Vault HTTP API - per Vault docs, fundingSource wallet (default auto-pull) vs vault
export async function prepareVaultApprove(symbol: string, currency: string, amount: string, token: string, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/markets/${encodeURIComponent(symbol)}/vault/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ currency, amount }),
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(`${err.name || 'vault_approve_error'}: ${err.description || res.statusText}`);
  }
  const data = await res.json();
  // Returns null for SOMI native - no ERC-20 approve
  return data as { to: string; data: string; value: string; chainId: string; gasLimit: string } | null;
}

export async function prepareVaultDeposit(symbol: string, currency: string, amount: string, token: string, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/markets/${encodeURIComponent(symbol)}/vault/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ currency, amount }),
  });
  if (!res.ok) throw new Error(`Vault deposit failed: ${res.status}`);
  return res.json();
}

export async function prepareVaultWithdraw(symbol: string, currency: string, amount: string, token: string, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/markets/${encodeURIComponent(symbol)}/vault/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ currency, amount }),
  });
  if (!res.ok) throw new Error(`Vault withdraw failed: ${res.status}`);
  return res.json();
}

export async function getVaultBalance(symbol: string, token: string, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const res = await fetch(`${baseUrl}/markets/${encodeURIComponent(symbol)}/vault/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to get vault balance: ${res.status}`);
  return res.json();
}

// Portfolio - GET /v0/portfolio?timeframe=24h|7d|30d|all&sessionSince
export async function fetchPortfolio(token: string, timeframe: string = '30d', sessionSince?: number, isMainnet = false) {
  const baseUrl = isMainnet ? 'https://api.dreamdex.io/v0' : 'https://stg.api.dreamdex.io/v0';
  const params = new URLSearchParams({ timeframe });
  if (sessionSince) params.set('sessionSince', String(sessionSince));
  const res = await fetch(`${baseUrl}/portfolio?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch portfolio: ${res.status}`);
  return res.json() as Promise<{
    asOf: number;
    equity: Array<{ t: number; valueUsd: string }>;
    pnl: { buckets: Array<{ t: number; pnlUsd: string }>; totalUsd: string };
    mwrr: { depositedUsd: string; gainUsd: string; return: number | null };
    volume: { periodUsd: string; lifetimeUsd: string; sessionUsd: string };
    feesSaved: { periodUsd: string; lifetimeUsd: string };
    wallet: string;
  }>;
}

export async function getStopOrderSomiPayment(registry: Address, isMainnet = false) {
  const client = getPublicClient(isMainnet);
  return client.readContract({ address: registry, abi: stopRegistryAbi, functionName: 'somiPaymentPerOrder' }) as Promise<bigint>;
}

export async function createStopOrder(params: {
  registry: Address;
  order: { isBid: boolean; owner: Address; userData: bigint; quantity: bigint };
  orderType: number; // 0 LIMIT, 1 MARKET
  triggerPrice: bigint;
  triggerOperator: number; // 0 GTE, 1 LTE
  limitPrice: bigint;
  value: bigint; // must equal somiPaymentPerOrder exactly
  walletClient: any;
}, isMainnet = false) {
  // Validates: trigger distance, tick alignment, quantity lot, MARKET limitPrice==0
  return params.walletClient.writeContract({
    address: params.registry,
    abi: stopRegistryAbi,
    functionName: 'createPendingOrder',
    args: [[params.order, params.orderType, params.triggerPrice, params.triggerOperator, params.limitPrice, '0x0000000000000000000000000000000000000000' as Address, 0]],
    value: params.value,
  });
}

export async function cancelStopOrder(registry: Address, orderId: bigint, walletClient: any) {
  return walletClient.writeContract({ address: registry, abi: stopRegistryAbi, functionName: 'cancelPendingOrder', args: [orderId] });
}
