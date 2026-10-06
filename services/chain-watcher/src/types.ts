import { UUID, HexString, AtomicAmount, TimestampISO } from '@exchange/shared-types';

export interface OnchainDepositLog {
  txHash: HexString;
  logIndex: number;
  blockNumber: number;
  userAddress: HexString;
  assetAddress: HexString;
  amount: AtomicAmount;
  nonce: number;
  timestamp: TimestampISO;
}

export interface TrackedDeposit {
  id: UUID;
  userId: UUID;
  chainId: number;
  txHash: HexString;
  logIndex: number;
  blockNumber: number;
  amount: AtomicAmount;
  assetId: UUID;
  status: 'pending' | 'confirming' | 'credited';
  confirmations: number;
  creditedAt?: TimestampISO;
}
