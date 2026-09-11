# Veritas Deployment Scripts

Foundry deployment scripts for Veritas protocol.

## 📁 Structure

```
script/
├── Deploy.s.sol           # Main deployment script
├── helpers/
│   └── HelperConfig.s.sol # Network configurations
└── README.md              # This file
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy example and edit
cp .env.example .env

# Add your keys
PRIVATE_KEY=your_private_key_here
SomniaSCAN_API_KEY=your_api_key_here
```

### 2. Deploy to Testnet

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_TESTNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### 3. Save Addresses

Copy the JSON output and save to `deployments/stt-testnet.json`

---

## 📜 Deploy.s.sol

Main deployment script that deploys all contracts in correct order.

### Deployment Sequence

1. **ReputationNFT** - Soulbound NFT contract
2. **ScoreCalculator** - VeritasScore calculation logic
3. **PlatformRegistry** - Platform adapter registry
4. **VeritasCore** - Main protocol orchestrator
5. **DreamDEXPredictionAdapter** - DreamDEXPrediction integration
6. **Platform Registration** - Registers DreamDEXPrediction in registry
7. **Configuration** - Sets VeritasCore as NFT minter

### Functions

#### `run()`
Main deployment function. Deploys all contracts, configures relationships, and outputs summary.

**Returns**:
- `address` ReputationNFT
- `address` ScoreCalculator
- `address` PlatformRegistry
- `address` VeritasCore
- `address` DreamDEXPredictionAdapter

#### `deployForTesting()`
Simplified deployment for testing. Uses mock addresses where needed.

**Usage in tests**:
```solidity
Deploy deployer = new Deploy();
(
    ReputationNFT nft,
    ScoreCalculator calc,
    PlatformRegistry registry,
    VeritasCore core,
    DreamDEXPredictionAdapter adapter
) = deployer.deployForTesting();
```

---

## 🛠️ HelperConfig.s.sol

Network-specific configurations.

### NetworkConfig Struct

```solidity
struct NetworkConfig {
    address dreamDEXV2;  // DreamDEXPrediction contract address
    string networkName;            // "Somnia Testnet"
    uint256 chainId;               // 97
    string rpcUrl;                 // RPC endpoint
    string explorerUrl;            // "https://testnet.somniascan.com"
    string explorerApiUrl;         // "https://api-testnet.somniascan.com/api"
}
```

### Supported Networks

| Network | Chain ID | DreamDEXPrediction Address |
|---------|----------|---------------------------|
| STT Mainnet | 56 | 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9 |
| STT Testnet | 97 | 0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9 |
| Local (Anvil) | 31337 | address(0) - deploy mock |

### Functions

#### `getActiveNetworkConfig()`
Returns config for current chain (auto-detected from `block.chainid`)

#### `getSttTestnetConfig()`
Returns STT testnet configuration

#### `getSttMainnetConfig()`
Returns STT mainnet configuration

#### `getAnvilConfig()`
Returns local development configuration

#### `isLiveNetwork()`
Returns `true` if on mainnet or testnet (not local)

---

## 🎯 Usage Examples

### Deploy Locally (Testing)

```bash
# Start local node
anvil

# Deploy (no verification needed)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://localhost:8545 \
  --broadcast \
  -vvvv
```

### Deploy to Testnet

```bash
# Dry run first
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_TESTNET_RPC \
  -vvvv

# Deploy and verify
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_TESTNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### Deploy to Mainnet

```bash
# ⚠️ USE WITH CAUTION ⚠️
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_MAINNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

---

## 📊 Output

The script outputs:

### 1. Deployment Progress
```
1/7 Deploying ReputationNFT...
   ReputationNFT deployed at: 0x...
2/7 Deploying ScoreCalculator...
   ScoreCalculator deployed at: 0x...
...
```

### 2. Summary Table
```
==============================================
DEPLOYMENT SUMMARY
==============================================
Network: Somnia Testnet
Chain ID: 97
Deployer: 0x...
----------------------------------------------
Core Contracts:
  ReputationNFT:      0x...
  ScoreCalculator:    0x...
  PlatformRegistry:   0x...
  VeritasCore:    0x...
----------------------------------------------
Adapters:
  DreamDEXAdapter:     0x...
----------------------------------------------
External Contracts:
  DreamDEXPrediction:  0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9
==============================================
```

### 3. JSON Output
```json
{
  "network": "Somnia Testnet",
  "chainId": 97,
  "timestamp": 1234567890,
  "deployer": "0x...",
  "contracts": {
    "ReputationNFT": "0x...",
    "ScoreCalculator": "0x...",
    "PlatformRegistry": "0x...",
    "VeritasCore": "0x...",
    "DreamDEXPredictionAdapter": "0x..."
  },
  "external": {
    "DreamDEXPredictionV2": "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9"
  }
}
```

---

## 🔍 Verification

### Automatic Verification

The `--verify` flag automatically verifies contracts on SomniaScan:

```bash
--verify --etherscan-api-key $SomniaSCAN_API_KEY
```

Note: `foundry.toml` already configures SomniaScan settings.

### Manual Verification

If automatic verification fails:

```bash
forge verify-contract <ADDRESS> \
  src/core/VeritasCore.sol:VeritasCore \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" \
    "<NFT_ADDR>" "<CALC_ADDR>" "<REGISTRY_ADDR>")
```

---

## 📋 Pre-Deployment Checklist

- [ ] `.env` file configured
- [ ] Private key has sufficient STT (~0.2 STT)
- [ ] SomniaScan API key obtained
- [ ] RPC URL is accessible
- [ ] Contracts compile: `forge build`
- [ ] Tests pass: `forge test`
- [ ] Dry run successful: `forge script ... -vvvv` (no --broadcast)

---

## 🔐 Security Notes

### Private Keys
- **NEVER** commit `.env` to git
- Use `.env.example` as template only
- For mainnet, use hardware wallet or multisig

### Deployment Safety
1. Always test on testnet first
2. Verify all addresses in output
3. Save deployment JSON immediately
4. Transfer ownership to multisig after deployment

### Post-Deployment
```bash
# Transfer ownership (recommended for production)
cast send <VERITAS_CORE> \
  "transferOwnership(address)" <MULTISIG> \
  --rpc-url $RPC \
  --private-key $PRIVATE_KEY
```

---

## 🐛 Troubleshooting

### "Insufficient funds for gas"
```bash
# Check balance
cast balance <YOUR_ADDRESS> --rpc-url $STT_TESTNET_RPC

# Get testnet STT
# https://testnet.somnia.org/faucet-smart
```

### "Verification failed"
```bash
# Wait 30 seconds
sleep 30

# Retry verification
forge verify-contract <ADDRESS> <PATH>:<CONTRACT> \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY
```

### "Nonce too low"
```bash
# Check current nonce
cast nonce <YOUR_ADDRESS> --rpc-url $STT_TESTNET_RPC

# Wait and retry
```

---

## 📚 Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Somnia Docs](https://docs.sttchain.org/)
- [SomniaScan API Docs](https://docs.somniascan.com/)
- [Main Deployment Guide](../../DEPLOYMENT.md)

---

**Generated for Veritas MVP - Seedify Hackathon**
