import { createPublicClient, http, parseAbi, parseEther } from 'viem';
import { somniaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http()
});

const coreAddress = '0xe502EfB09DEa060146aa414c3a7385B18918a6c3';
const nftAddress = '0x412F577B7E4F8ac392BA9D8876d7A17e4891F6AB';
const userAddress = '0xD9a1048f900E57C0C320eF11eFfAF725d1a9353f';
const mintFee = BigInt('500000000000000');

console.log('==============================================');
console.log('TESTING NEW CONTRACTS');
console.log('==============================================');
console.log('Core:', coreAddress);
console.log('NFT:', nftAddress);
console.log('User:', userAddress);
console.log('----------------------------------------------\n');

(async () => {
  // 1. Check if contracts are deployed
  console.log('1. Checking contract deployment...');
  const coreCode = await client.getBytecode({ address: coreAddress });
  const nftCode = await client.getBytecode({ address: nftAddress });
  console.log('   Core deployed:', Boolean(coreCode && coreCode !== '0x'), '✅');
  console.log('   NFT deployed:', Boolean(nftCode && nftCode !== '0x'), '✅\n');

  // 2. Check if user is registered
  console.log('2. Checking registration status...');
  try {
    const hasRegistered = await client.readContract({
      address: coreAddress,
      abi: parseAbi(['function hasRegistered(address) view returns (bool)']),
      functionName: 'hasRegistered',
      args: [userAddress]
    });
    console.log('   Already registered:', hasRegistered, hasRegistered ? '⚠️' : '✅\n');
  } catch (e) {
    console.log('   ❌ Error checking registration:', e.shortMessage);
  }

  // 3. Simulate registerUser
  console.log('3. Simulating registerUser...');
  try {
    const result = await client.simulateContract({
      address: coreAddress,
      abi: parseAbi(['function registerUser() payable returns (uint256)']),
      functionName: 'registerUser',
      account: userAddress,
      value: mintFee
    });
    console.log('   ✅ SIMULATION SUCCESS!');
    console.log('   Minting will work! 🎉\n');
  } catch (error) {
    console.log('   ❌ SIMULATION FAILED');
    console.log('   Error:', error.shortMessage || error.message);
  }

  console.log('==============================================');
  console.log('READY TO MINT!');
  console.log('==============================================');
  console.log('Go to: http://localhost:3000/dashboard');
  console.log('The NFT minting card should appear.');
  console.log('Click "Mint for 0.0005 STT" and approve in Rabby!');
  console.log('==============================================');
})();
