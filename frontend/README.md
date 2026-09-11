# Veritas Frontend

Next.js 14 frontend for Veritas - On-Chain Reputation for Prediction Markets.

## 🚀 Features

- **Next.js 14** with App Router and TypeScript
- **RainbowKit** for beautiful wallet connections
- **wagmi v2** + **viem** for Web3 interactions
- **Tailwind CSS** + **shadcn/ui** for modern UI
- **Fully typed** contract interactions

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your values:
# 1. Get WalletConnect Project ID from https://cloud.walletconnect.com
# 2. Add deployed contract addresses
```

## 🏃 Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── dashboard/page.tsx        # User dashboard
│   ├── leaderboard/page.tsx      # Leaderboard
│   ├── profile/[address]/page.tsx # Public user profile
│   └── layout.tsx                # Root layout with header/footer
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── Providers.tsx             # Web3 providers wrapper
│   ├── ConnectWallet.tsx         # Custom wallet connect button
│   ├── VeritasScoreDisplay.tsx     # VeritasScore card
│   ├── NFTDisplay.tsx            # NFT viewer
│   └── ImportFlow.tsx            # Prediction import flow
├── hooks/                        # Custom React hooks
│   └── useVeritas.ts         # Main Web3 hook
└── lib/                          # Utilities
    ├── contracts.ts              # ABIs, addresses, types
    ├── wagmi.ts                  # wagmi configuration
    └── utils.ts                  # Utility functions
```

## 🔧 Configuration

### Update Contract Addresses

After deploying contracts, update addresses in `lib/contracts.ts`:

```typescript
export const CONTRACTS = {
  somniaTestnet: {
    VeritasCore: '0xYourCoreAddress',
    ReputationNFT: '0xYourNFTAddress',
    ScoreCalculator: '0xYourCalculatorAddress',
    PlatformRegistry: '0xYourRegistryAddress',
  },
  // ...
};
```

### WalletConnect Setup

1. Visit https://cloud.walletconnect.com
2. Create a new project
3. Copy your Project ID
4. Add to `.env.local` as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

## 🎨 Pages

### Landing Page (`/`)
- Hero section
- Feature overview
- Tier system explanation
- CTA to get started

### Dashboard (`/dashboard`)
- User registration flow
- VeritasScore display
- NFT viewer
- Trading statistics
- Import predictions flow

### Leaderboard (`/leaderboard`)
- Top users by VeritasScore
- Tier badges
- Win rates and prediction counts

### Profile (`/profile/[address]`)
- Public user profile view
- VeritasScore and stats
- NFT display

## 🔗 Web3 Integration

### wagmi Hooks Used

- `useAccount` - Get connected wallet
- `useReadContract` - Read contract data
- `useWriteContract` - Write to contracts
- `useWaitForTransactionReceipt` - Wait for tx confirmation

### Custom Hook: `useVeritas`

Main hook for interacting with Veritas contracts:

```typescript
const {
  // State
  isRegistered,
  userProfile,
  nftMetadata,
  tokenURI,
  platforms,

  // Actions
  registerUser,
  connectPlatform,
  importPredictions,
  updateVeritasScore,

  // Loading states
  isRegistering,
  isConnecting,
  isImporting,
  isUpdating,
} = useVeritas();
```

## 🎯 Key Components

### ConnectWallet
Custom RainbowKit connect button with:
- Connect wallet CTA
- Network switcher
- Account display

### VeritasScoreDisplay
Shows user's reputation:
- Score with tier badge
- Progress to next tier
- Win rate and prediction stats

### NFTDisplay
Displays soulbound NFT:
- Decodes Base64 SVG
- Shows metadata attributes
- Tier-based styling

### ImportFlow
Prediction import workflow:
- Platform connection
- Mock data scenarios
- Rate limit warnings

## 📝 Type Safety

All contract interactions are fully typed using:
- TypeScript
- viem types
- Custom interfaces from `lib/contracts.ts`

## 🌐 Supported Networks

- **STT Testnet** (Chain ID: 97)
- **STT Mainnet** (Chain ID: 56)

## 🔮 Future Enhancements

- [ ] The Graph integration for leaderboard
- [ ] Real-time score updates via websockets
- [ ] Profile sharing/social features
- [ ] Historical score chart
- [ ] Multi-chain support

## 🐛 Troubleshooting

### "Wrong network" error
- Switch to STT Testnet or Mainnet in your wallet

### Contract addresses show as 0x000...
- Update addresses in `lib/contracts.ts` after deployment

### WalletConnect issues
- Check Project ID in `.env.local`
- Clear browser cache and reconnect

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [wagmi Docs](https://wagmi.sh)
- [RainbowKit Docs](https://rainbowkit.com)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

## 📄 License

MIT
