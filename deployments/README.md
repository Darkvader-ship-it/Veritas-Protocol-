# Veritas Deployments

This directory contains deployment information for Veritas contracts across different networks.

## Structure

Each network has its own JSON file:
- `stt-testnet.json` - Somnia Testnet (Chain ID: 97)
- `stt-mainnet.json` - Somnia Mainnet (Chain ID: 56)
- `*.json.example` - Example templates

## Deployment Process

### Prerequisites

1. **Get STT for gas**:
   - **Testnet**: https://testnet.somnia.org/faucet-smart
   - **Mainnet**: Purchase STT on an exchange

2. **Get SomniaScan API Key**:
   - Visit: https://somniascan.com/myapikey
   - Create account and generate API key
   - Add to `.env` file

3. **Set up environment**:
   ```bash
   cd contracts
   cp .env.example .env
   # Edit .env with your private key and API key
   ```

### Deploy to STT Testnet

```bash
# Make sure you're in contracts directory
cd contracts

# Load environment variables
source .env

# Deploy and verify
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_TESTNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### Deploy to STT Mainnet

```bash
# ⚠️ MAINNET DEPLOYMENT - USE WITH CAUTION ⚠️

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $STT_MAINNET_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### Deployment Output

The script will:
1. Deploy all 5 contracts in order
2. Configure relationships (NFT minter, platform registration)
3. Print deployment summary
4. Generate JSON with all addresses
5. Verify contracts on SomniaScan (if `--verify` flag used)

### Save Deployment Addresses

Copy the JSON output from the script and save to:
- `deployments/stt-testnet.json` (for testnet)
- `deployments/stt-mainnet.json` (for mainnet)

## Contract Verification

### Automatic Verification

The `--verify` flag will automatically verify contracts during deployment.

### Manual Verification

If automatic verification fails:

```bash
# Verify ReputationNFT
forge verify-contract <ADDRESS> \
  src/core/ReputationNFT.sol:ReputationNFT \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" "<OWNER_ADDRESS>")

# Verify ScoreCalculator
forge verify-contract <ADDRESS> \
  src/core/ScoreCalculator.sol:ScoreCalculator \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY

# Verify PlatformRegistry
forge verify-contract <ADDRESS> \
  src/core/PlatformRegistry.sol:PlatformRegistry \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY

# Verify VeritasCore
forge verify-contract <ADDRESS> \
  src/core/VeritasCore.sol:VeritasCore \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" "<NFT>" "<CALC>" "<REGISTRY>")

# Verify DreamDEXPredictionAdapter
forge verify-contract <ADDRESS> \
  src/adapters/DreamDEXPredictionAdapter.sol:DreamDEXPredictionAdapter \
  --chain-id 97 \
  --etherscan-api-key $SomniaSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" "<DREAMDEX_PREDICTION>")
```

## Post-Deployment Checklist

After deployment, verify:

- [ ] All contracts deployed successfully
- [ ] All contracts verified on SomniaScan
- [ ] VeritasCore set as NFT minter
- [ ] DreamDEXPrediction platform registered in registry
- [ ] Platform is active in registry
- [ ] Deployer address is owner of all contracts
- [ ] Deployment addresses saved to JSON file
- [ ] Frontend updated with new contract addresses

## Interacting with Deployed Contracts

### Using Cast

```bash
# Register a user
cast send <VERITAS_CORE> "registerUser()" \
  --rpc-url $STT_TESTNET_RPC \
  --private-key $PRIVATE_KEY

# Connect platform
cast send <VERITAS_CORE> "connectPlatform(uint256)" 1 \
  --rpc-url $STT_TESTNET_RPC \
  --private-key $PRIVATE_KEY

# Check user profile
cast call <VERITAS_CORE> "getUserProfile(address)" <USER_ADDRESS> \
  --rpc-url $STT_TESTNET_RPC
```

### Using Frontend

Update your frontend configuration with deployed addresses:

```typescript
// config/contracts.ts
export const CONTRACTS = {
  VERITAS_CORE: '0x...',
  REPUTATION_NFT: '0x...',
  PLATFORM_REGISTRY: '0x...',
  // ... etc
}
```

## Gas Costs (Approximate)

| Contract | Gas Used | STT (30 gwei) |
|----------|----------|---------------|
| ReputationNFT | 2,500,000 | ~0.075 STT |
| ScoreCalculator | 500,000 | ~0.015 STT |
| PlatformRegistry | 1,000,000 | ~0.030 STT |
| VeritasCore | 1,500,000 | ~0.045 STT |
| DreamDEXAdapter | 800,000 | ~0.024 STT |
| **Total** | **~6,300,000** | **~0.189 STT** |

*Prices vary with gas price. Add 20-30% buffer for configuration transactions.*

## Troubleshooting

### Error: "Insufficient funds for gas"
- Get more STT from faucet (testnet) or exchange (mainnet)
- Current balance: `cast balance <YOUR_ADDRESS> --rpc-url $STT_TESTNET_RPC`

### Error: "Contract verification failed"
- Wait 30 seconds and try manual verification
- Check that contract is deployed: `cast code <ADDRESS> --rpc-url $STT_TESTNET_RPC`
- Verify API key is correct: `echo $SomniaSCAN_API_KEY`

### Error: "Nonce too low"
- Clear transaction queue: `cast nonce <YOUR_ADDRESS> --rpc-url $STT_TESTNET_RPC`
- Wait a few minutes and retry

### Error: "Transaction underpriced"
- Increase gas price in foundry.toml
- Or use legacy transactions: Add `--legacy` flag

## Security Notes

⚠️ **IMPORTANT**:
- NEVER commit `.env` file with real private keys
- Use hardware wallet for mainnet deployments
- Test thoroughly on testnet first
- Verify all contract addresses after deployment
- Transfer ownership to multisig for production

## Support

For deployment issues:
- Check Foundry docs: https://book.getfoundry.sh/
- SomniaScan docs: https://docs.somniascan.com/
- GitHub Issues: https://github.com/veritas/issues
