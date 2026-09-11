const { ethers } = require('ethers');
require('dotenv').config();

const DREAMDEX_PREDICTION_ABI = [
  'event BetBull(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'event BetBear(address indexed sender, uint256 indexed epoch, uint256 amount)',
  'function currentEpoch() view returns (uint256)',
];

async function checkLive() {
  // Use publicnode which has better rate limits
  const provider = new ethers.JsonRpcProvider('https://somnia.publicnode.com');
  const contract = new ethers.Contract(
    '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
    DREAMDEX_PREDICTION_ABI,
    provider
  );

  console.log('=== DREAMDEXSWAP PREDICTION LIVE STATUS ===');
  console.log('');

  // Get current epoch
  const currentEpoch = await contract.currentEpoch();
  console.log('Current Epoch:', currentEpoch.toString());

  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log('Current Block:', currentBlock);

  // Check last 20 blocks only (~1 minute)
  const fromBlock = currentBlock - 20;
  console.log('');
  console.log(`Checking blocks ${fromBlock} to ${currentBlock} for bets...`);

  try {
    const bullFilter = contract.filters.BetBull();
    const bearFilter = contract.filters.BetBear();

    const [bullEvents, bearEvents] = await Promise.all([
      contract.queryFilter(bullFilter, fromBlock, currentBlock),
      contract.queryFilter(bearFilter, fromBlock, currentBlock),
    ]);

    console.log('');
    console.log('BULL bets in last ~1 min:', bullEvents.length);
    console.log('BEAR bets in last ~1 min:', bearEvents.length);

    const allEvents = [...bullEvents, ...bearEvents];
    if (allEvents.length > 0) {
      console.log('');
      console.log('=== RECENT BETS ===');
      for (const event of allEvents.slice(0, 10)) {
        const isBull = event.topics[0] === ethers.id('BetBull(address,uint256,uint256)');
        const sender = '0x' + event.topics[1].slice(26);
        const epoch = parseInt(event.topics[2], 16);
        const amount = ethers.formatEther(BigInt(event.data.slice(0, 66)));
        console.log(`${isBull ? '🐂 BULL' : '🐻 BEAR'} | ${sender.slice(0, 10)}... | Epoch ${epoch} | ${amount} STT`);
      }
    } else {
      console.log('No bets in the last minute');
    }
  } catch (err) {
    console.log('Error querying events:', err.message);
  }

  console.log('');
  console.log('=== CONCLUSION ===');
  console.log('DreamDEX Event Contracts IS LIVE (Epoch', currentEpoch.toString() + ')');
  console.log('The simulator is monitoring for bets from your followed leaders.');
  console.log('When they bet, you will see it in the terminal and Simulation tab.');
}

checkLive().catch(console.error);
