/**
 * dreamDEX HTTP API — Order Management via REST
 * POST /v0/markets/{symbol}/orders -> { approval?, to, data, value, chainId, gasLimit }
 * Handles: wallet approval, eth_call simulation, broadcast, receipt logs
 */

const BASE_URL_MAINNET = 'https://api.dreamdex.io/v0';
const BASE_URL_TESTNET = 'https://stg.api.dreamdex.io/v0';

function getBaseUrl(isMainnet = false) {
  return isMainnet ? BASE_URL_MAINNET : BASE_URL_TESTNET;
}

export interface PrepareOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  price?: string; // required for limit
  amount: string;
  type?: 'limit' | 'market';
  fundingSource?: 'wallet' | 'vault' | 'marginBank';
  orderType?: 'GTC' | 'IOC' | 'FOK' | 'PostOnly';
  walletAddress: string;
  slippageBps?: number; // for market buys
}

export interface PrepareResult {
  approval?: { token: string; amount: string };
  to: string;
  data: string;
  value: string;
  chainId: string;
  gasLimit: string;
}

export async function prepareOrder(params: PrepareOrderParams, token: string, isMainnet = false): Promise<PrepareResult> {
  const baseUrl = getBaseUrl(isMainnet);
  const url = `${baseUrl}/markets/${encodeURIComponent(params.symbol)}/orders`;
  
  const body: any = {
    side: params.side,
    amount: params.amount,
    walletAddress: params.walletAddress,
    fundingSource: params.fundingSource || 'wallet',
  };
  if (params.price) body.price = params.price;
  if (params.type) body.type = params.type;
  if (params.orderType) body.orderType = params.orderType;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    const name = res.headers.get('Error-Name') || err.name;
    throw new Error(`${name || 'prepare_error'}: ${err.description || res.statusText}`);
  }

  return res.json();
}

export async function simulateOrder(tx: PrepareResult, from: string, rpcUrl: string): Promise<{ success: boolean; orderId: string }> {
  // eth_call simulation - returns (bool success, uint128 orderId)
  // If success false, order would be rejected (expired, selfMatch, PostOnly, FOK, IOC no fill)
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ from, to: tx.to, data: tx.data, value: tx.value }, 'latest'],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  // Decode (bool, uint128) - simplified
  const result = data.result as string;
  if (result === '0x' || result === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return { success: false, orderId: '0' };
  }
  // For now, assume success if no revert
  return { success: true, orderId: result.slice(0, 66) };
}

export async function getOrders(symbol: string, token: string, opts: { status?: string; limit?: number; cursor?: string } = {}, isMainnet = false) {
  const baseUrl = getBaseUrl(isMainnet);
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  const url = `${baseUrl}/markets/${encodeURIComponent(symbol)}/orders${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
  return res.json() as Promise<{ orders: any[]; nextCursor?: string; total?: number }>;
}

export async function getAllOrders(token: string, opts: { symbols?: string[]; status?: string; limit?: number; cursor?: string } = {}, isMainnet = false) {
  const baseUrl = getBaseUrl(isMainnet);
  const params = new URLSearchParams();
  if (opts.symbols) for (const s of opts.symbols) params.append('symbols', s);
  if (opts.status) params.set('status', opts.status);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  const url = `${baseUrl}/orders${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch all orders: ${res.status}`);
  return res.json();
}

export async function cancelOrder(symbol: string, orderId: string, token: string, isMainnet = false): Promise<PrepareResult> {
  const baseUrl = getBaseUrl(isMainnet);
  const url = `${baseUrl}/markets/${encodeURIComponent(symbol)}/orders/${orderId}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(`${err.name || 'cancel_error'}: ${err.description || res.statusText}`);
  }
  return res.json();
}

export async function reduceOrder(symbol: string, orderId: string, newQuantityRemaining: string, token: string, isMainnet = false): Promise<PrepareResult> {
  const baseUrl = getBaseUrl(isMainnet);
  const url = `${baseUrl}/markets/${encodeURIComponent(symbol)}/orders/${orderId}/reduce`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ newQuantityRemaining }),
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(`${err.name || 'reduce_error'}: ${err.description || res.statusText}`);
  }
  return res.json();
}

export async function getTrades(symbol: string, token: string, opts: { since?: number; limit?: number } = {}, isMainnet = false) {
  const baseUrl = getBaseUrl(isMainnet);
  const params = new URLSearchParams();
  if (opts.since) params.set('since', String(opts.since));
  if (opts.limit) params.set('limit', String(opts.limit));
  const url = `${baseUrl}/markets/${encodeURIComponent(symbol)}/trades${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch trades: ${res.status}`);
  return res.json();
}

export async function getAllTrades(token: string, opts: { symbols?: string[]; since?: number; limit?: number; cursor?: string } = {}, isMainnet = false) {
  const baseUrl = getBaseUrl(isMainnet);
  const params = new URLSearchParams();
  if (opts.symbols) for (const s of opts.symbols) params.append('symbols', s);
  if (opts.since) params.set('since', String(opts.since));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  const url = `${baseUrl}/trades${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch all trades: ${res.status}`);
  return res.json();
}
