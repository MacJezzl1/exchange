import { UUID, AtomicAmount, TimestampISO } from '@exchange/shared-types';

export interface Candle {
  openTime: number; // Unix timestamp ms
  closeTime: number;
  open: AtomicAmount;
  high: AtomicAmount;
  low: AtomicAmount;
  close: AtomicAmount;
  volume: AtomicAmount;
}

export interface Ticker {
  marketId: UUID;
  symbol: string;
  lastPrice: AtomicAmount;
  high24h: AtomicAmount;
  low24h: AtomicAmount;
  volume24h: AtomicAmount;
  updatedAt: TimestampISO;
}

export interface DepthSnapshot {
  bids: [string, string][];
  asks: [string, string][];
  sequence: number;
}
