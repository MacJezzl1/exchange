import { UUID, HexString, OrderSide, OrderType, AtomicAmount } from '@exchange/shared-types';

export interface PlaceOrderInput {
  userId: UUID;
  userAddress: HexString;
  marketId: UUID;
  side: OrderSide;
  orderType: OrderType;
  price: AtomicAmount;
  quantity: AtomicAmount;
  nonce: number;
  expiry: number;
  signature: HexString;
}

export interface MarketConfig {
  id: UUID;
  symbol: string;
  baseAssetId: UUID;
  quoteAssetId: UUID;
  tickSize: bigint;
  lotSize: bigint;
  minOrderSize: bigint;
  maxOrderSize: bigint;
  makerFeeBps: number;
  takerFeeBps: number;
  priceBandPct: number;
  isHalted: boolean;
}
