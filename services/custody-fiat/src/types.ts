import { UUID, AtomicAmount } from '@exchange/shared-types';

export type SupportedFiatCurrency = 'ZAR' | 'NGN' | 'KES' | 'USD';
export type PaymentRailType = 'stitch_eft' | 'paystack_nip' | 'mpesa_c2b';

export interface BankAccountDetails {
  accountHolder: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface FiatDepositRequest {
  id: UUID;
  userId: UUID;
  currency: SupportedFiatCurrency;
  amount: AtomicAmount; // In atomic fiat cents/kobo/cents (e.g. 10000 = 100.00 ZAR)
  rail: PaymentRailType;
  providerReference: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
}

export interface FiatWithdrawalRequest {
  id: UUID;
  userId: UUID;
  currency: SupportedFiatCurrency;
  amount: AtomicAmount;
  rail: PaymentRailType;
  bankAccount: BankAccountDetails;
  requiresFourEyes: boolean;
  status: 'pending_approval' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
}
