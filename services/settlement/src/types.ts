import { UUID, AtomicAmount } from '@exchange/shared-types';

export interface BalanceDelta {
  userAddress: string;
  assetAddress: string;
  delta: bigint; // Positive = credit, Negative = debit
}

export interface AccountBalance {
  userAddress: string;
  assetAddress: string;
  balance: bigint;
}

export interface MerkleProof {
  userAddress: string;
  assetAddress: string;
  balance: string;
  leaf: string;
  siblings: string[];
  root: string;
}

export interface SettlementBatch {
  batchId: number;
  timestamp: number;
  deltas: BalanceDelta[];
  merkleRoot: string;
  operatorSignature: string;
  status: 'pending' | 'submitted' | 'confirmed';
  txHash?: string;
}

export interface ProofOfReservesReport {
  timestamp: string;
  merkleRoot: string;
  totalLiabilities: Record<string, string>;
  totalReserves: Record<string, string>;
  reserveRatios: Record<string, number>; // e.g. 100.5 means 100.5%
  isSolvent: boolean;
  leafCount: number;
}

export interface MatchedTradeInput {
  tradeId: UUID;
  buyerAddress: string;
  sellerAddress: string;
  baseAssetAddress: string;
  quoteAssetAddress: string;
  price: AtomicAmount;
  quantity: AtomicAmount;
  buyerFee: AtomicAmount;
  sellerFee: AtomicAmount;
}
