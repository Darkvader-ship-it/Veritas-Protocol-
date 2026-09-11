/**
 * Deploy CopyTradingVault contract to Somnia Testnet
 *
 * Prerequisites:
 * 1. Install dependencies: npm install --save-dev @nomiclabs/hardhat-ethers ethers
 * 2. Configure hardhat.config.ts with Somnia testnet
 * 3. Get testnet STT from https://testnet.somnia.org/faucet-smart
 * 4. Set PRIVATE_KEY in .env
 *
 * Usage:
 *   npx hardhat run scripts/deploy-copy-trading.ts --network somniaTestnet
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Deploying CopyTradingVault contract...\n');

  const [deployer] = await ethers.getSigners();
  console.log('📝 Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'STT\n');

  if (balance < ethers.parseEther('0.1')) {
    console.warn('⚠️  Low balance! Get testnet STT from https://testnet.somnia.org/faucet-smart\n');
  }

  // Deploy CopyTradingVault
  console.log('📦 Deploying CopyTradingVault...');
  const CopyTradingVault = await ethers.getContractFactory('CopyTradingVault');
  const vault = await CopyTradingVault.deploy();
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log('✅ CopyTradingVault deployed to:', vaultAddress);

  // Approve DreamDEX Event Contracts contract
  const DREAMDEXSWAP_PREDICTION = '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9';
  console.log('\n🔧 Approving DreamDEX Event Contracts platform...');
  const approveTx = await vault.setPlatformApproval(DREAMDEXSWAP_PREDICTION, true);
  await approveTx.wait();
  console.log('✅ DreamDEX Event Contracts approved');

  // Summary
  console.log('\n📋 Deployment Summary:');
  console.log('==========================================');
  console.log('CopyTradingVault:', vaultAddress);
  console.log('Network:', 'Somnia Testnet');
  console.log('Deployer:', deployer.address);
  console.log('==========================================\n');

  console.log('📝 Next steps:');
  console.log('1. Verify contract on SomniaScan:');
  console.log(`   npx hardhat verify --network somniaTestnet ${vaultAddress}`);
  console.log('\n2. Update frontend/.env.local with:');
  console.log(`   NEXT_PUBLIC_COPY_TRADING_VAULT=${vaultAddress}`);
  console.log('\n3. Test deposit:');
  console.log(`   Visit https://testnet.somniascan.com/address/${vaultAddress}`);
  console.log('   Call deposit() with 0.01 STT');
  console.log('\n4. Configure bet watcher service to use this contract');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
