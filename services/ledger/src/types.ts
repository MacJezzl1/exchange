import { UUID, AtomicAmount, TimestampISO } from '@exchange/shared-types';

export interface PostJournalLine {
  accountId: UUID;
  debit: AtomicAmount; // '0' if credit
  credit: AtomicAmount; // '0' if debit
}

export interface PostJournalEntryParams {
  referenceType: 'trade' | 'deposit' | 'withdrawal' | 'hold' | 'release' | 'fee' | 'reconciliation';
  referenceId: UUID;
  description: string;
  lines: PostJournalLine[];
}

export interface HoldRecord {
  id: UUID;
  userId: UUID;
  accountId: UUID;
  amount: AtomicAmount;
  reason: string;
  referenceId: UUID;
  status: 'active' | 'captured' | 'released';
  createdAt: TimestampISO;
}
