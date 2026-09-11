import { createPublicClient, http, parseAbi } from 'viem';
import { somniaTestnet } from 'viem/chains';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http()
});

const coreAddress = '0x1aF9B68D3d1cF3e1A27ea33e44afb839a14012b6';
const nftAddress = '0xa79805FAf84BCFb296b6C0fbA2BB222fDc319460';

(async () => {
  console.log('Checking contract state...\n');

  // Check if paused
  try {
    const paused = await client.readContract({
      address: coreAddress,
      abi: parseAbi(['function paused() view returns (bool)']),
      functionName: 'paused'
    });
    console.log('Contract paused:', paused);
  } catch (e) {
    console.log('No paused() function');
  }

  // Check NFT address in Core contract
  try {
    const nftAddr = await client.readContract({
      address: coreAddress,
      abi: parseAbi(['function reputationNFT() view returns (address)']),
      functionName: 'reputationNFT'
    });
    console.log('NFT address in contract:', nftAddr);
    console.log('Expected NFT address:', nftAddress);
    console.log('Match:', nftAddr.toLowerCase() === nftAddress.toLowerCase());
  } catch (e) {
    console.log('Could not read reputationNFT address:', e.shortMessage);
  }

  // Check if NFT minting is enabled
  try {
    const enabled = await client.readContract({
      address: nftAddress,
      abi: parseAbi(['function mintingEnabled() view returns (bool)']),
      functionName: 'mintingEnabled'
    });
    console.log('NFT minting enabled:', enabled);
  } catch (e) {
    console.log('No mintingEnabled() function');
  }
})();
