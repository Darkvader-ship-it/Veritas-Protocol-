const https = require('https');

// Get a bettor's full history
const bettor = '0xf59e93290383ed15f73ee923ebbf29f79e37b6d8';

https.get(`https://api.sx.bet/trades?bettor=${bettor}&pageSize=100`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const j = JSON.parse(data);
    const trades = j.data.trades;

    console.log('Total trades for bettor:', trades.length);
    console.log('Count from API:', j.data.count);

    // Count by settleValue (rounded for display)
    const settleValues = {};
    trades.forEach(t => {
      const sv = Math.round(t.settleValue * 100) / 100;
      if (!settleValues[sv]) settleValues[sv] = 0;
      settleValues[sv]++;
    });

    console.log('\nSettleValue distribution:');
    Object.entries(settleValues)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${k}: ${v} trades`));

    // Check actual wins vs losses based on bettingOutcomeOne and outcome
    let wins = 0, losses = 0, voids = 0;
    trades.forEach(t => {
      // If outcome matches bettingOutcomeOne, bettor won
      if (t.outcome === 0) {
        voids++;
      } else if (t.bettingOutcomeOne && t.outcome === 1) {
        wins++;
      } else if (!t.bettingOutcomeOne && t.outcome === 2) {
        wins++;
      } else {
        losses++;
      }
    });

    console.log('\nActual results (based on outcome vs bettingOutcomeOne):');
    console.log(`  Wins: ${wins}`);
    console.log(`  Losses: ${losses}`);
    console.log(`  Voids: ${voids}`);
    console.log(`  Win rate: ${((wins / (wins + losses)) * 100).toFixed(1)}%`);

    // Compare to what we're currently showing
    console.log('\nCompare to settleValue=1 count:', settleValues[1] || 0);
  });
}).on('error', e => console.error(e));
