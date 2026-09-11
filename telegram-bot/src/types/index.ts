export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  volumeNum: number;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  marketSlug: string;
  endDate: string | null;
  tags?: string[];
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  markets: PolymarketMarket[];
  active: boolean;
  closed: boolean;
  volume: string;
  liquidity: string;
}

export interface DreamDEXRound {
  epoch: number;
  startTimestamp: number;
  lockTimestamp: number;
  closeTimestamp: number;
  lockPrice: bigint;
  closePrice: bigint;
  totalAmount: bigint;
  bullAmount: bigint;
  bearAmount: bigint;
  rewardAmount: bigint;
  oracleCalled: boolean;
}

export interface UserAlert {
  userId: number;
  platform: 'polymarket' | 'dreamdex';
  type: 'price' | 'volume' | 'new_market' | 'round_start' | 'round_end';
  targetId: string;
  threshold?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface UserProfile {
  telegramUserId: number;
  walletAddress?: string;
  veritasScore?: number;
  tier?: string;
  totalPredictions?: number;
  winRate?: number;
  alerts: UserAlert[];
  lastUpdate: Date;
}

export interface MarketAlert {
  marketId: string;
  marketName: string;
  platform: 'polymarket' | 'dreamdex';
  type: 'price_change' | 'high_volume' | 'new_market' | 'closing_soon';
  message: string;
  data: any;
  timestamp: Date;
}

export interface VeritasScoreData {
  address: string;
  score: number;
  tier: number;
  totalPredictions: number;
  correctPredictions: number;
  winRate: number;
  totalVolume: string;
  platforms: string[];
}
