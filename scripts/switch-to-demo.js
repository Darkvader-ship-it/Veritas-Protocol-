const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../frontend/.env.mode');

// Update .env.mode file
fs.writeFileSync(envPath, '# Data Mode: "demo" or "mainnet"\nNEXT_PUBLIC_DATA_MODE=demo\n');

console.log('✅ Switched to DEMO MODE');
console.log('');
console.log('📊 Demo mode uses sample data from:');
console.log('   frontend/public/data/sample-users.json');
console.log('');
console.log('🎯 What to do next:');
console.log('   1. Restart your frontend: npm run dev');
console.log('   2. Open http://localhost:3000/leaderboard');
console.log('   3. No backend services needed!');
console.log('');
console.log('💡 To switch back: npm run use:mainnet');
