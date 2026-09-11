import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  trustWallet,
  injectedWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { fallback } from 'viem';

// Somnia Chains — Shannon Testnet 50312 + Mainnet 5031
// Per implementation.md §2: dream-rpc + infra fallback + thirdweb
export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://dream-rpc.somnia.network',
        'https://api.infra.testnet.somnia.network',
        'https://50312.rpc.thirdweb.com',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
  testnet: true,
});

export const somniaMainnet = defineChain({
  id: 5031,
  name: 'Somnia Mainnet',
  nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://api.infra.mainnet.somnia.network',
        'https://5031.rpc.thirdweb.com',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' },
  },
});

// Custom RPC endpoints for better reliability — Somnia only
const transports = {
  [somniaTestnet.id]: fallback([
    http('https://dream-rpc.somnia.network'),
    http('https://api.infra.testnet.somnia.network'),
    http('https://50312.rpc.thirdweb.com'),
  ]),
  [somniaMainnet.id]: http('https://api.infra.mainnet.somnia.network'),
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Configure wallet connectors with extended support
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        rabbyWallet,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
      ],
    },
    {
      groupName: 'More',
      wallets: [
        trustWallet,
        injectedWallet, // This will detect Backpack and other injected wallets
      ],
    },
  ],
  {
    appName: 'Veritas',
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [somniaTestnet, somniaMainnet],
  transports,
  ssr: true,
});

// Somnia chain IDs for easy checks
export const SOMNIA_CHAIN_IDS = [somniaTestnet.id, somniaMainnet.id] as const;
