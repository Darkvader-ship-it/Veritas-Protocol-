/**
 * dreamDEX HTTP API Auth — SIWE (ERC-4361)
 * - GET /v0/auth/nonce (5m single-use)
 * - POST /v0/auth/login { message, signature } -> { token, expiresAt }
 * - JWT valid 1h, no refresh, re-login 1-2m before expiry with fresh nonce
 * - ChainId must match env: 5031 mainnet, 50312 testnet
 */

const BASE_URL_MAINNET = 'https://api.dreamdex.io/v0';
const BASE_URL_TESTNET = 'https://stg.api.dreamdex.io/v0';

function getBaseUrl(isMainnet = false) {
  return isMainnet ? BASE_URL_MAINNET : BASE_URL_TESTNET;
}

function getChainId(isMainnet = false) {
  return isMainnet ? 5031 : 50312;
}

interface AuthState {
  token: string;
  expiresAt: number;
  address: string;
}

let authState: AuthState | null = null;
let refreshTimer: any = null;

export function getAuthToken(): string | null {
  if (!authState) return null;
  if (Date.now() >= authState.expiresAt - 60_000) return null; // consider expired 1m before
  return authState.token;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export async function getNonce(isMainnet = false): Promise<string> {
  const baseUrl = getBaseUrl(isMainnet);
  const res = await fetch(`${baseUrl}/auth/nonce`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.description || `Failed to get nonce: ${res.status}`);
  }
  const data = await res.json();
  return data.nonce as string;
}

export async function loginWithSiwe(params: {
  address: string;
  chainId: number;
  nonce: string;
  walletClient: any;
  isMainnet: boolean;
}): Promise<AuthState> {
  const { address, chainId, nonce, walletClient, isMainnet } = params;
  const baseUrl = getBaseUrl(isMainnet);
  const domain = isMainnet ? 'api.dreamdex.io' : 'stg.api.dreamdex.io';
  const uri = `https://${domain}`;
  const issuedAt = new Date().toISOString();
  
  // SIWE message per ERC-4361
  const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to dreamDEX\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

  const signature = await walletClient.signMessage({ message, account: address as any });

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const name = res.headers.get('Error-Name') || err.name;
    throw new Error(`${name || 'auth_failed'}: ${err.description || res.statusText}`);
  }

  const data = await res.json();
  authState = { token: data.token, expiresAt: data.expiresAt, address };

  // Schedule proactive refresh 1-2m before expiry
  scheduleRefresh(isMainnet, walletClient);

  return authState;
}

function scheduleRefresh(isMainnet: boolean, walletClient: any) {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!authState) return;
  
  const refreshAt = authState.expiresAt - 90_000; // 1.5m before
  const delay = refreshAt - Date.now();
  if (delay <= 0) return;

  refreshTimer = setTimeout(async () => {
    try {
      const nonce = await getNonce(isMainnet);
      await loginWithSiwe({
        address: authState!.address,
        chainId: getChainId(isMainnet),
        nonce,
        walletClient,
        isMainnet,
      });
    } catch (e) {
      console.error('[dreamdexAuth] proactive refresh failed', e);
    }
  }, delay);
}

export async function withAuthRetry<T>(
  fn: (token: string) => Promise<T>,
  walletClient: any,
  isMainnet = false
): Promise<T> {
  let token = getAuthToken();
  if (!token) {
    const nonce = await getNonce(isMainnet);
    const address = walletClient.account?.address;
    if (!address) throw new Error('No wallet address');
    const auth = await loginWithSiwe({ address, chainId: getChainId(isMainnet), nonce, walletClient, isMainnet });
    token = auth.token;
  }

  try {
    return await fn(token);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('unauthorized') || msg.includes('invalid_nonce') || msg.includes('invalid_signature') || msg.includes('chain_id_mismatch')) {
      // Re-auth with fresh nonce
      const nonce = await getNonce(isMainnet);
      const address = walletClient.account?.address;
      const auth = await loginWithSiwe({ address, chainId: getChainId(isMainnet), nonce, walletClient, isMainnet });
      return fn(auth.token);
    }
    throw err;
  }
}

// Error name -> UX map per Error Handling doc
export function apiErrorToUx(error: any): string {
  const name = error?.name || error?.errorName || String(error?.message || '').split(':')[0];
  const map: Record<string, string> = {
    invalid_amount: 'Invalid amount: check lot size and decimals',
    invalid_price: 'Invalid price: check tick size',
    invalid_currency: 'Invalid currency for this pair',
    invalid_order: 'Order could not be parsed',
    invalid_order_type: 'Order type not permitted for funding source (GTC/PostOnly via vault, IOC/FOK via wallet)',
    invalid_fund_source: 'Funding source incompatible with order type',
    market_not_found: 'Market does not exist',
    order_not_found: 'Order not found',
    unauthorized: 'Not authenticated — please sign in again',
    wallet_not_allowed: 'Wallet not authorized',
    rpc_unavailable: 'Chain node unavailable, retrying...',
    internal_error: 'Server error, retrying...',
  };
  return map[name] || error?.description || error?.message || 'Unknown error';
}

export function getErrorNameFromResponse(res: Response, body: any): string | null {
  return res.headers.get('Error-Name') || body?.name || null;
}
