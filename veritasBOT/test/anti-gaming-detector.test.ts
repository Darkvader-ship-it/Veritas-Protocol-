/**
 * Anti-Gaming Detector Tests
 *
 * Tests for wash trading, Sybil cluster, statistical anomaly,
 * and collusion detection algorithms.
 *
 * Run with: npm test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AntiGamingDetector } from '../src/bots/anti-gaming-detector.js';
import type { Bet, Platform } from '../src/types/index.js';

// ===========================================
// Test Helpers
// ===========================================

function createBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: `bet-${Math.random().toString(36).slice(2)}`,
    trader: '0x1234567890abcdef1234567890abcdef12345678',
    platform: 'dreamdex' as Platform,
    epoch: 12345,
    amount: '100000000000000000', // 0.1 STT
    isBull: true,
    timestamp: new Date(),
    ...overrides,
  };
}

function createBetsForWallet(
  wallet: string,
  epochs: Array<{ epoch: number; sides: ('bull' | 'bear')[] }>
): Bet[] {
  const bets: Bet[] = [];
  for (const { epoch, sides } of epochs) {
    for (const side of sides) {
      bets.push(
        createBet({
          trader: wallet,
          epoch,
          isBull: side === 'bull',
        })
      );
    }
  }
  return bets;
}

// ===========================================
// Wash Trading Detection Tests
// ===========================================

describe('Wash Trading Detection', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  it('should detect wash trading when betting both sides in 3+ epochs', () => {
    const wallet = '0xwashtrader';
    const bets = createBetsForWallet(wallet, [
      { epoch: 100, sides: ['bull', 'bear'] },
      { epoch: 101, sides: ['bull', 'bear'] },
      { epoch: 102, sides: ['bull', 'bear'] },
    ]);

    const alert = detector.detectWashTrading(wallet, bets);

    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('WASH_TRADING');
    expect(alert?.severity).toBe('CRITICAL');
    expect(alert?.wallets).toContain(wallet);
    expect(alert?.evidence.dataPoints.washEpochCount).toBe(3);
    expect(alert?.evidence.epochs).toHaveLength(3);
  });

  it('should detect wash trading with many wash epochs', () => {
    const wallet = '0xseriouswasher';
    const bets = createBetsForWallet(wallet, [
      { epoch: 100, sides: ['bull', 'bear'] },
      { epoch: 101, sides: ['bull', 'bear'] },
      { epoch: 102, sides: ['bull', 'bear'] },
      { epoch: 103, sides: ['bull', 'bear'] },
      { epoch: 104, sides: ['bull', 'bear'] },
      { epoch: 105, sides: ['bull', 'bear'] },
      { epoch: 106, sides: ['bull', 'bear'] },
      { epoch: 107, sides: ['bull', 'bear'] },
      { epoch: 108, sides: ['bull', 'bear'] },
      { epoch: 109, sides: ['bull', 'bear'] },
      { epoch: 110, sides: ['bull', 'bear'] },
      { epoch: 111, sides: ['bull', 'bear'] },
    ]);

    const alert = detector.detectWashTrading(wallet, bets);

    expect(alert).not.toBeNull();
    expect(alert?.evidence.dataPoints.washEpochCount).toBe(12);
    // Should only include first 10 epochs in evidence
    expect(alert?.evidence.epochs).toHaveLength(10);
  });

  it('should NOT flag normal trading (one side per epoch)', () => {
    const wallet = '0xnormaltrader';
    const bets = createBetsForWallet(wallet, [
      { epoch: 100, sides: ['bull'] },
      { epoch: 101, sides: ['bear'] },
      { epoch: 102, sides: ['bull'] },
      { epoch: 103, sides: ['bear'] },
      { epoch: 104, sides: ['bull'] },
    ]);

    const alert = detector.detectWashTrading(wallet, bets);

    expect(alert).toBeNull();
  });

  it('should NOT flag if below threshold (< 3 wash epochs)', () => {
    const wallet = '0xoccasional';
    const bets = createBetsForWallet(wallet, [
      { epoch: 100, sides: ['bull', 'bear'] }, // Wash 1
      { epoch: 101, sides: ['bull', 'bear'] }, // Wash 2
      { epoch: 102, sides: ['bull'] },         // Normal
      { epoch: 103, sides: ['bear'] },         // Normal
    ]);

    const alert = detector.detectWashTrading(wallet, bets);

    expect(alert).toBeNull();
  });

  it('should NOT flag mixed normal and wash trading below threshold', () => {
    const wallet = '0xmixed';
    const bets = createBetsForWallet(wallet, [
      { epoch: 100, sides: ['bull'] },
      { epoch: 101, sides: ['bear'] },
      { epoch: 102, sides: ['bull', 'bear'] }, // Only 1 wash
      { epoch: 103, sides: ['bull'] },
      { epoch: 104, sides: ['bear'] },
    ]);

    const alert = detector.detectWashTrading(wallet, bets);

    expect(alert).toBeNull();
  });

  it('should handle empty bet array', () => {
    const alert = detector.detectWashTrading('0xempty', []);
    expect(alert).toBeNull();
  });
});

// ===========================================
// Sybil Cluster Detection Tests
// ===========================================

describe('Sybil Cluster Detection', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  it('should detect 3+ wallets betting identically within 5 seconds', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    const bets: Bet[] = [
      createBet({
        trader: '0xsybil1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000', // 0.1 STT bucket
        timestamp: new Date(baseTime.getTime() + 0),
      }),
      createBet({
        trader: '0xsybil2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: new Date(baseTime.getTime() + 1000), // +1 sec
      }),
      createBet({
        trader: '0xsybil3cccccccccccccccccccccccccccccccccc',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: new Date(baseTime.getTime() + 2000), // +2 sec
      }),
    ];

    const alert = await detector.detectSybilCluster(bets);

    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('SYBIL_CLUSTER');
    expect(alert?.severity).toBe('WARNING');
    expect(alert?.wallets.length).toBeGreaterThanOrEqual(3);
    expect(alert?.recommendedAction).toBe('INVESTIGATE');
  });

  it('should detect larger Sybil clusters', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    const bets: Bet[] = [];
    for (let i = 0; i < 10; i++) {
      bets.push(
        createBet({
          trader: `0xsybil${i}${'a'.repeat(34)}`,
          epoch: 100,
          isBull: true,
          amount: '100000000000000000',
          timestamp: new Date(baseTime.getTime() + i * 500), // All within 5 sec
        })
      );
    }

    const alert = await detector.detectSybilCluster(bets);

    expect(alert).not.toBeNull();
    expect(alert?.wallets.length).toBe(10);
  });

  it('should NOT flag if wallets bet at different times (>5 sec apart)', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    const bets: Bet[] = [
      createBet({
        trader: '0xtrader1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: new Date(baseTime.getTime() + 0),
      }),
      createBet({
        trader: '0xtrader2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: new Date(baseTime.getTime() + 10000), // +10 sec (different bucket)
      }),
      createBet({
        trader: '0xtrader3ccccccccccccccccccccccccccccccccccc',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: new Date(baseTime.getTime() + 20000), // +20 sec
      }),
    ];

    const alert = await detector.detectSybilCluster(bets);

    expect(alert).toBeNull();
  });

  it('should NOT flag if only 2 wallets match', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    const bets: Bet[] = [
      createBet({
        trader: '0xpair1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: baseTime,
      }),
      createBet({
        trader: '0xpair2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: baseTime,
      }),
    ];

    const alert = await detector.detectSybilCluster(bets);

    expect(alert).toBeNull();
  });

  it('should NOT flag if bet amounts differ significantly', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    // Same time but very different amounts (different buckets)
    const bets: Bet[] = [
      createBet({
        trader: '0xwhaleaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        epoch: 100,
        isBull: true,
        amount: '5000000000000000000', // 5 STT (bucket 50)
        timestamp: baseTime,
      }),
      createBet({
        trader: '0xshrimp1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        epoch: 100,
        isBull: true,
        amount: '10000000000000000', // 0.01 STT (bucket 0)
        timestamp: baseTime,
      }),
      createBet({
        trader: '0xshrimp2ccccccccccccccccccccccccccccccccc',
        epoch: 100,
        isBull: true,
        amount: '20000000000000000', // 0.02 STT (bucket 0)
        timestamp: baseTime,
      }),
    ];

    const alert = await detector.detectSybilCluster(bets);

    // shrimp1 and shrimp2 are in same bucket, but whale is not
    // Only 2 in same bucket, so no alert
    expect(alert).toBeNull();
  });

  it('should NOT flag wallets betting different directions', async () => {
    const baseTime = new Date('2024-01-01T12:00:00Z');

    const bets: Bet[] = [
      createBet({
        trader: '0xbull1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        epoch: 100,
        isBull: true,
        amount: '100000000000000000',
        timestamp: baseTime,
      }),
      createBet({
        trader: '0xbear1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        epoch: 100,
        isBull: false, // Different direction
        amount: '100000000000000000',
        timestamp: baseTime,
      }),
      createBet({
        trader: '0xbear2cccccccccccccccccccccccccccccccccccc',
        epoch: 100,
        isBull: false,
        amount: '100000000000000000',
        timestamp: baseTime,
      }),
    ];

    const alert = await detector.detectSybilCluster(bets);

    expect(alert).toBeNull();
  });

  it('should handle empty bet array', async () => {
    const alert = await detector.detectSybilCluster([]);
    expect(alert).toBeNull();
  });
});

// ===========================================
// Statistical Anomaly Detection Tests
// ===========================================

describe('Statistical Anomaly Detection', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  it('should detect impossibly high win rates (80% over 100 bets)', () => {
    const alert = detector.detectStatisticalAnomaly('0xsuspicious', 80, 100);

    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('STATISTICAL_ANOMALY');
    expect(alert?.severity).toBe('INFO');
    expect(alert?.evidence.dataPoints.winRate).toBe(0.8);
    expect(alert?.evidence.dataPoints.zScore).toBeGreaterThan(3.29);
  });

  it('should detect extreme win rates (90% over 200 bets)', () => {
    const alert = detector.detectStatisticalAnomaly('0xextreme', 180, 200);

    expect(alert).not.toBeNull();
    expect(alert?.evidence.dataPoints.zScore).toBeGreaterThan(10);
  });

  it('should NOT flag realistic win rates (55%)', () => {
    const alert = detector.detectStatisticalAnomaly('0xnormal', 55, 100);

    expect(alert).toBeNull();
  });

  it('should NOT flag edge-case win rates (60%)', () => {
    // 60% over 100 bets gives z-score of 2.0, below threshold
    const alert = detector.detectStatisticalAnomaly('0xgood', 60, 100);

    expect(alert).toBeNull();
  });

  it('should NOT flag with insufficient sample size (<50 bets)', () => {
    // Even 100% wins with only 10 bets
    const alert = detector.detectStatisticalAnomaly('0xlucky', 10, 10);

    expect(alert).toBeNull();
  });

  it('should NOT flag exactly at threshold (50 bets)', () => {
    // 50% win rate should never trigger
    const alert = detector.detectStatisticalAnomaly('0xaverage', 25, 50);

    expect(alert).toBeNull();
  });

  it('should calculate correct z-scores', () => {
    // Known calculation: 70% over 100 bets
    // stdDev = sqrt(0.5 * 0.5 / 100) = 0.05
    // z = (0.70 - 0.50) / 0.05 = 4.0
    const alert = detector.detectStatisticalAnomaly('0xtest', 70, 100);

    expect(alert).not.toBeNull();
    expect(alert?.evidence.dataPoints.zScore).toBeCloseTo(4.0, 1);
  });

  it('should handle edge case of 0 wins', () => {
    // 0% win rate over 100 bets is also suspicious
    const alert = detector.detectStatisticalAnomaly('0xloser', 0, 100);

    // z-score for 0% = (0 - 0.5) / 0.05 = -10
    // But current implementation only checks high win rates (positive z)
    // This is a potential gap in the algorithm
    expect(alert).toBeNull(); // Current behavior
  });

  it('should handle 0 total bets gracefully', () => {
    const alert = detector.detectStatisticalAnomaly('0xnewbie', 0, 0);

    expect(alert).toBeNull();
  });
});

// ===========================================
// Collusion Detection Tests
// ===========================================

describe('Collusion Detection', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  it('should detect wallets that bet together >80% of the time', async () => {
    const bets: Bet[] = [];

    // Two wallets bet together in 25 out of 30 epochs (83%)
    for (let epoch = 1; epoch <= 30; epoch++) {
      bets.push(createBet({ trader: '0xcolluder1', epoch }));

      if (epoch <= 25) {
        bets.push(createBet({ trader: '0xcolluder2', epoch }));
      }
    }

    const alert = await detector.detectCollusion(bets);

    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('COLLUSION');
    expect(alert?.severity).toBe('WARNING');
    expect(alert?.wallets).toContain('0xcolluder1');
    expect(alert?.wallets).toContain('0xcolluder2');
  });

  it('should detect perfect collusion (100% overlap)', async () => {
    const bets: Bet[] = [];

    for (let epoch = 1; epoch <= 50; epoch++) {
      bets.push(createBet({ trader: '0xperfect1', epoch }));
      bets.push(createBet({ trader: '0xperfect2', epoch }));
    }

    const alert = await detector.detectCollusion(bets);

    expect(alert).not.toBeNull();
    expect(alert?.evidence.dataPoints.coOccurrenceRate).toBeCloseTo(1.0, 2);
  });

  it('should NOT flag occasional overlap (<80%)', async () => {
    const bets: Bet[] = [];

    // Two wallets only overlap in 10 out of 30 epochs (33%)
    for (let epoch = 1; epoch <= 30; epoch++) {
      bets.push(createBet({ trader: '0xtrader1', epoch }));

      if (epoch <= 10) {
        bets.push(createBet({ trader: '0xtrader2', epoch }));
      }
    }

    const alert = await detector.detectCollusion(bets);

    expect(alert).toBeNull();
  });

  it('should NOT flag high overlap with insufficient shared epochs (<20)', async () => {
    const bets: Bet[] = [];

    // 90% overlap but only 10 shared epochs
    for (let epoch = 1; epoch <= 11; epoch++) {
      bets.push(createBet({ trader: '0xshort1', epoch }));

      if (epoch <= 10) {
        bets.push(createBet({ trader: '0xshort2', epoch }));
      }
    }

    const alert = await detector.detectCollusion(bets);

    expect(alert).toBeNull();
  });

  it('should handle single trader (no pairs)', async () => {
    const bets: Bet[] = [];

    for (let epoch = 1; epoch <= 30; epoch++) {
      bets.push(createBet({ trader: '0xsolo', epoch }));
    }

    const alert = await detector.detectCollusion(bets);

    expect(alert).toBeNull();
  });

  it('should handle empty bet array', async () => {
    const alert = await detector.detectCollusion([]);

    expect(alert).toBeNull();
  });

  it('should handle multiple potential colluding pairs', async () => {
    const bets: Bet[] = [];

    // Create scenario where multiple pairs could be flagged
    for (let epoch = 1; epoch <= 30; epoch++) {
      bets.push(createBet({ trader: '0xgroup1a', epoch }));
      bets.push(createBet({ trader: '0xgroup1b', epoch }));
      // Note: current implementation returns first match only
    }

    const alert = await detector.detectCollusion(bets);

    // Should detect at least one pair
    expect(alert).not.toBeNull();
    expect(alert?.wallets.length).toBe(2);
  });
});

// ===========================================
// Integration Tests
// ===========================================

describe('Full Wallet Analysis', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  // Note: analyzeWallet requires database access
  // These tests would need mocking or a test database

  it.skip('should calculate risk score correctly', async () => {
    // Would need to mock db.getTraderBets and db.getTrader
    const analysis = await detector.analyzeWallet('0xtest');

    expect(analysis).toHaveProperty('riskScore');
    expect(analysis).toHaveProperty('patterns');
    expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
    expect(analysis.riskScore).toBeLessThanOrEqual(100);
  });
});

// ===========================================
// Edge Cases & Boundary Tests
// ===========================================

describe('Edge Cases', () => {
  let detector: AntiGamingDetector;

  beforeEach(() => {
    detector = new AntiGamingDetector();
  });

  it('should handle malformed addresses gracefully', () => {
    const bets = [createBet({ trader: '' })];
    const alert = detector.detectWashTrading('', bets);
    // Should not throw
    expect(alert).toBeNull();
  });

  it('should handle very large epoch numbers', () => {
    const bets = createBetsForWallet('0xtest', [
      { epoch: 999999999, sides: ['bull', 'bear'] },
      { epoch: 999999998, sides: ['bull', 'bear'] },
      { epoch: 999999997, sides: ['bull', 'bear'] },
    ]);

    const alert = detector.detectWashTrading('0xtest', bets);

    expect(alert).not.toBeNull();
  });

  it('should handle negative amounts gracefully', () => {
    const bet = createBet({ amount: '-100' });
    // Should not throw - let the algorithm handle it
    expect(() => detector.detectWashTrading('0xtest', [bet])).not.toThrow();
  });

  it('should handle future timestamps', () => {
    const futureDate = new Date('2030-01-01');
    const bets = [
      createBet({ timestamp: futureDate }),
      createBet({ timestamp: futureDate }),
    ];

    // Should not throw
    expect(() => detector.detectWashTrading('0xtest', bets)).not.toThrow();
  });
});
