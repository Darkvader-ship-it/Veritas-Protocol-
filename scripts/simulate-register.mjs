import { createPublicClient, http, parseAbi } from 'viem';
import { somniaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http()
});

const coreAddress = '0x1aF9B68D3d1cF3e1A27ea33e44afb839a14012b6';
const userAddress = '0xD9a1048f900E57C0C320eF11eFfAF725d1a9353f';
const mintFee = BigInt('500000000000000');

(async () => {
  try {
    // Simulate the registerUser call
    const result = await client.simulateContract({
      address: coreAddress,
      abi: parseAbi(['function registerUser() payable']),
      functionName: 'registerUser',
      account: userAddress,
      value: mintFee
    });
    console.log('Simulation SUCCESS - this should work!');
    console.log('Result:', result);
  } catch (error) {
    console.log('Simulation FAILED');
    console.log('Error:', error.message);
    console.log('Short message:', error.shortMessage);
    
    if (error.cause) {
      console.log('\nRevert reason:', error.cause.reason);
      console.log('Cause details:', error.cause);
    }
    
    if (error.details) {
      console.log('\nDetails:', error.details);
    }
  }
})();
