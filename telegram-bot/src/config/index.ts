import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  blockchain: {
    somniaRpcUrl: process.env.Somnia_RPC_URL || 'https://somnia-dataseed1.somnia.org',
    somniaTestnetRpcUrl: process.env.Somnia_TESTNET_RPC_URL || 'https://data-seed-presomnia-1-s1.somnia.org:8545',
    network: process.env.NETWORK || 'testnet',
  },
  contracts: {
    veritasCore: process.env.VERITAS_CORE_ADDRESS || '',
    reputationNFT: process.env.REPUTATION_NFT_ADDRESS || '',
    scoreCalculator: process.env.SCORE_CALCULATOR_ADDRESS || '',
    dreamDEX: process.env.DREAMDEX_PREDICTION_ADDRESS || '0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9',
  },
  polymarket: {
    apiUrl: process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  alerts: {
    checkInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '60000'),
    priceChangeThreshold: parseFloat(process.env.PRICE_CHANGE_THRESHOLD || '5'),
    volumeChangeThreshold: parseFloat(process.env.VOLUME_CHANGE_THRESHOLD || '10'),
  },
  features: {
    enablePolymarket: process.env.ENABLE_POLYMARKET === 'true',
    enableDreamDEX: process.env.ENABLE_DREAMDEXSWAP === 'true',
    enableVeritasScore: process.env.ENABLE_VERITASSCORE === 'true',
  },
  admin: {
    userIds: (process.env.ADMIN_USER_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export function validateConfig(): void {
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  console.log('✅ Configuration validated');
  console.log(`📡 Network: ${config.blockchain.network}`);
  console.log(`🔧 Features: Polymarket=${config.features.enablePolymarket}, DreamDEX=${config.features.enableDreamDEX}, VeritasScore=${config.features.enableVeritasScore}`);
}
