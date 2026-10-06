import { v7 as uuidv7 } from 'uuid';
import { UUID, AtomicAmount } from '@exchange/shared-types';
import {
  SupportedFiatCurrency,
  PaymentRailType,
  FiatDepositRequest,
  FiatWithdrawalRequest,
  BankAccountDetails,
} from './types';

export class AfricanRailsManager {
  private readonly deposits = new Map<UUID, FiatDepositRequest>();
  private readonly withdrawals = new Map<UUID, FiatWithdrawalRequest>();

  // Thresholds requiring Maker-Checker four-eyes review (in minor currency units)
  private readonly fourEyesThresholds: Record<SupportedFiatCurrency, bigint> = {
    ZAR: 5000000n, // R 50,000.00
    NGN: 1000000000n, // ₦ 10,000,000.00
    KES: 50000000n, // KES 500,000.00
    USD: 1000000n, // $ 10,000.00
  };

  /**
   * Processes an incoming fiat deposit from Stitch, Paystack, or M-Pesa.
   */
  public processDeposit(
    userId: UUID,
    currency: SupportedFiatCurrency,
    amount: AtomicAmount,
    rail: PaymentRailType,
    providerReference: string
  ): FiatDepositRequest {
    const deposit: FiatDepositRequest = {
      id: uuidv7(),
      userId,
      currency,
      amount,
      rail,
      providerReference,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    this.deposits.set(deposit.id, deposit);
    return deposit;
  }

  /**
   * Initiates a localized fiat withdrawal.
   * If above the safety threshold, routes to maker-checker approval.
   */
  public requestWithdrawal(
    userId: UUID,
    currency: SupportedFiatCurrency,
    amount: AtomicAmount,
    rail: PaymentRailType,
    bankAccount: BankAccountDetails
  ): FiatWithdrawalRequest {
    const amountBig = BigInt(amount);
    const threshold = this.fourEyesThresholds[currency] || 0n;
    const requiresFourEyes = amountBig >= threshold;

    const withdrawal: FiatWithdrawalRequest = {
      id: uuidv7(),
      userId,
      currency,
      amount,
      rail,
      bankAccount,
      requiresFourEyes,
      status: requiresFourEyes ? 'pending_approval' : 'completed',
      createdAt: new Date().toISOString(),
    };

    this.withdrawals.set(withdrawal.id, withdrawal);
    return withdrawal;
  }

  public getDeposit(id: UUID): FiatDepositRequest | null {
    return this.deposits.get(id) || null;
  }

  public getWithdrawal(id: UUID): FiatWithdrawalRequest | null {
    return this.withdrawals.get(id) || null;
  }

  public approveFourEyesWithdrawal(id: UUID): FiatWithdrawalRequest {
    const w = this.withdrawals.get(id);
    if (!w) throw new Error(`Withdrawal ${id} not found`);
    if (w.status !== 'pending_approval') {
      throw new Error(`Withdrawal is not pending approval (status: ${w.status})`);
    }

    w.status = 'completed';
    return w;
  }
}
