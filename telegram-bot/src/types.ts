import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
  userAddress?: string;
  alerts: any[];
  preferences: {
    notificationsEnabled: boolean;
  };
}

export type MyContext = Context & SessionFlavor<SessionData>;

// Polymarket Types
export interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  endDate: string;
  volume: string;
  volumeNum: number;
  outcomes: string[];
  outcomePrices: string[];
  active: boolean;
  closed: boolean;
  marketSlug: string;
  groupItemTitle?: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  markets: PolymarketMarket[];
}
