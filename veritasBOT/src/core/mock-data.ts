/**
 * Mock Data for Development/Testing
 *
 * Provides realistic mock traders, signals, and alerts when database is unavailable
 */

import type { Trader, SmartMoneySignal, Tier } from '../types/index.js';

// ===========================================
// Mock Traders (Top DreamDEX Predictors)
// ===========================================

export const MOCK_TRADERS: Trader[] = [
  {
    address: '0x7a16fF8270133F063aAb6C9977183D9e72835428',
    veritasScore: 847,
    tier: 'DIAMOND' as Tier,
    totalBets: 1247,
    wins: 892,
    losses: 355,
    winRate: 71.5,
    totalVolume: '156780000000000000000', // 156.78 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    veritasScore: 812,
    tier: 'DIAMOND' as Tier,
    totalBets: 983,
    wins: 687,
    losses: 296,
    winRate: 69.9,
    totalVolume: '234560000000000000000', // 234.56 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x8B3f5393bA08c24cc7ff5A66a832562aAE8b9D4C',
    veritasScore: 789,
    tier: 'PLATINUM' as Tier,
    totalBets: 756,
    wins: 512,
    losses: 244,
    winRate: 67.7,
    totalVolume: '89340000000000000000', // 89.34 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    veritasScore: 756,
    tier: 'PLATINUM' as Tier,
    totalBets: 534,
    wins: 358,
    losses: 176,
    winRate: 67.0,
    totalVolume: '67890000000000000000', // 67.89 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    veritasScore: 723,
    tier: 'PLATINUM' as Tier,
    totalBets: 421,
    wins: 278,
    losses: 143,
    winRate: 66.0,
    totalVolume: '45670000000000000000', // 45.67 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    veritasScore: 698,
    tier: 'GOLD' as Tier,
    totalBets: 312,
    wins: 203,
    losses: 109,
    winRate: 65.1,
    totalVolume: '34560000000000000000', // 34.56 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    veritasScore: 671,
    tier: 'GOLD' as Tier,
    totalBets: 287,
    wins: 184,
    losses: 103,
    winRate: 64.1,
    totalVolume: '28900000000000000000', // 28.9 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x2C3c5f9F1Fb8E4c0A0B2F5D0E3C4B5A6d7e8f9a0',
    veritasScore: 645,
    tier: 'GOLD' as Tier,
    totalBets: 198,
    wins: 125,
    losses: 73,
    winRate: 63.1,
    totalVolume: '19450000000000000000', // 19.45 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x4A5B6C7D8E9F0a1b2C3d4E5F6a7B8c9D0e1F2a3B',
    veritasScore: 612,
    tier: 'SILVER' as Tier,
    totalBets: 156,
    wins: 97,
    losses: 59,
    winRate: 62.2,
    totalVolume: '12340000000000000000', // 12.34 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
  {
    address: '0x5B6C7D8E9F0A1b2c3D4e5F6A7b8C9d0E1f2A3b4C',
    veritasScore: 589,
    tier: 'SILVER' as Tier,
    totalBets: 134,
    wins: 82,
    losses: 52,
    winRate: 61.2,
    totalVolume: '9870000000000000000', // 9.87 STT
    registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastActiveAt: new Date(),
  },
];

// ===========================================
// Generate Mock Signal for Current Epoch
// ===========================================

export function generateMockSignal(epoch: number): SmartMoneySignal {
  // Simulate realistic signal data
  const isBullish = Math.random() > 0.45; // Slight bull bias
  const confidence = 55 + Math.random() * 35; // 55-90%
  const participatingTraders = 4 + Math.floor(Math.random() * 5); // 4-8 traders
  const diamondCount = Math.floor(Math.random() * 3); // 0-2 diamond
  const platinumCount = 1 + Math.floor(Math.random() * 3); // 1-3 platinum

  const bullPercent = isBullish ? 55 + Math.random() * 30 : 15 + Math.random() * 30;

  let consensus: 'BULL' | 'BEAR' | 'NEUTRAL';
  if (bullPercent > 60) consensus = 'BULL';
  else if (bullPercent < 40) consensus = 'BEAR';
  else consensus = 'NEUTRAL';

  let signalStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  if (confidence >= 70 && participatingTraders >= 5 && (diamondCount >= 2 || platinumCount >= 3)) {
    signalStrength = 'STRONG';
  } else if (confidence >= 50 && participatingTraders >= 3) {
    signalStrength = 'MODERATE';
  } else {
    signalStrength = 'WEAK';
  }

  const totalVolume = (5 + Math.random() * 20) * 1e18; // 5-25 STT

  return {
    epoch,
    platform: 'dreamdex',
    consensus,
    confidence,
    weightedBullPercent: bullPercent,
    participatingTraders,
    diamondTraderCount: diamondCount,
    platinumTraderCount: platinumCount,
    totalVolumeWei: Math.floor(totalVolume).toString(),
    signalStrength,
    topTraderAgreement: 60 + Math.random() * 35,
    timestamp: new Date(),
    bets: [],
  };
}

// ===========================================
// Generate Mock Signal History
// ===========================================

export function generateMockSignalHistory(count: number, currentEpoch: number): SmartMoneySignal[] {
  const signals: SmartMoneySignal[] = [];

  for (let i = 0; i < count; i++) {
    const epoch = currentEpoch - i;
    const signal = generateMockSignal(epoch);
    signal.timestamp = new Date(Date.now() - i * 5 * 60 * 1000); // 5 min apart
    signals.push(signal);
  }

  return signals;
}

// ===========================================
// Mock Gaming Alerts
// ===========================================

export interface MockAlert {
  id: number;
  type: 'WASH_TRADING' | 'SYBIL_ATTACK' | 'COLLUSION' | 'ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  wallets: string[];
  status: 'pending' | 'dismissed' | 'confirmed';
  createdAt: Date;
  details: string;
}

export const MOCK_ALERTS: MockAlert[] = [
  {
    id: 1,
    type: 'WASH_TRADING',
    severity: 'HIGH',
    wallets: ['0x1234...abcd', '0x5678...efgh'],
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    details: 'Detected 47 round-trip trades between wallets in 24h',
  },
  {
    id: 2,
    type: 'SYBIL_ATTACK',
    severity: 'CRITICAL',
    wallets: ['0xaaaa...1111', '0xbbbb...2222', '0xcccc...3333'],
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    details: 'Cluster of 3 wallets with identical betting patterns, funded from same source',
  },
  {
    id: 3,
    type: 'ANOMALY',
    severity: 'MEDIUM',
    wallets: ['0xdead...beef'],
    status: 'pending',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    details: 'Sudden 400% increase in bet size, unusual timing patterns',
  },
];

// ===========================================
// Mock Wallet Analysis
// ===========================================

export interface MockWalletAnalysis {
  address: string;
  riskScore: number;
  patterns: {
    washTradingScore: number;
    sybilScore: number;
    anomalyScore: number;
    collusionScore: number;
  };
  transactionCount: number;
  uniqueCounterparties: number;
  avgTimeBetweenTrades: number;
}

export function generateMockWalletAnalysis(address: string): MockWalletAnalysis {
  // Generate semi-random but consistent scores based on address
  const seed = parseInt(address.slice(2, 10), 16);
  const random = (offset: number) => ((seed + offset) % 100);

  return {
    address,
    riskScore: Math.min(100, random(0) * 0.7 + random(50) * 0.3),
    patterns: {
      washTradingScore: random(10),
      sybilScore: random(20),
      anomalyScore: random(30),
      collusionScore: random(40),
    },
    transactionCount: 50 + random(100) * 10,
    uniqueCounterparties: 10 + random(200),
    avgTimeBetweenTrades: 300 + random(300) * 10, // seconds
  };
}
