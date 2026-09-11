const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../frontend/.env.mode');

// Update .env.mode file
fs.writeFileSync(envPath, '# Data Mode: "demo" or "mainnet"\nNEXT_PUBLIC_DATA_MODE=mainnet\n');

console.log('✅ Switched to MAINNET MODE');
console.log('');
console.log('🌐 Mainnet mode uses real blockchain data from:');
console.log('   - Somnia Mainnet via DreamDEX Event Contracts V2');
console.log('   - Stored in Supabase database');
console.log('');
console.log('🎯 What to do next:');
console.log('   1. Start backend services: cd services && npm run start:all');
console.log('   2. Start frontend: npm run dev');
console.log('   3. Open http://localhost:3000/leaderboard');
console.log('');
console.log('⚡ Backend services required:');
console.log('   - Indexer: Fetches bets from Somnia blockchain');
console.log('   - Bet Watcher: Monitors for copy trading opportunities');
console.log('');
console.log('💡 To switch back: npm run use:demo');
