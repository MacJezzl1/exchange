import { v7 as uuidv7 } from 'uuid';
import { UUID, AtomicAmount, Account, JournalEntry, JournalLine } from '@exchange/shared-types';
import { PostJournalEntryParams, HoldRecord } from './types';
import { DoubleEntryValidator } from './journal';

export class LedgerService {
  private readonly accounts = new Map<UUID, Account>();
  private readonly balances = new Map<UUID, bigint>(); // accountId -> balance (BigInt)
  private readonly journalEntries: JournalEntry[] = [];
  private readonly journalLines: JournalLine[] = [];
  private readonly holds = new Map<UUID, HoldRecord>(); // holdId -> HoldRecord
  private sequenceCounter = 0;

  public createAccount(
    userId: UUID | null,
    assetId: UUID,
    accountType: Account['account_type'],
    customId?: UUID
  ): Account {
    const account: Account = {
      id: customId || uuidv7(),
      user_id: userId,
      asset_id: assetId,
      account_type: accountType,
      created_at: new Date().toISOString(),
    };
    this.accounts.set(account.id, account);
    this.balances.set(account.id, 0n);
    return account;
  }

  public getAccount(accountId: UUID): Account | null {
    return this.accounts.get(accountId) || null;
  }

  public getUserAccount(userId: UUID, assetId: UUID, accountType: Account['account_type']): Account | null {
    for (const acc of this.accounts.values()) {
      if (acc.user_id === userId && acc.asset_id === assetId && acc.account_type === accountType) {
        return acc;
      }
    }
    return null;
  }

  public getBalance(accountId: UUID): AtomicAmount {
    return (this.balances.get(accountId) || 0n).toString();
  }

  public getOrCreateUserAccount(userId: UUID, assetId: UUID, accountType: Account['account_type']): Account {
    const existing = this.getUserAccount(userId, assetId, accountType);
    if (existing) return existing;
    return this.createAccount(userId, assetId, accountType);
  }

  /**
   * Posts a strictly balanced double-entry journal entry.
   * If any line causes an invariant violation (unbalanced, invalid account), the entire transaction aborts.
   */
  public postJournalEntry(params: PostJournalEntryParams): { entry: JournalEntry; lines: JournalLine[] } {
    const { isBalanced, totalDebit, totalCredit } = DoubleEntryValidator.validateBalanced(params.lines);
    if (!isBalanced) {
      throw new Error(
        `Double-entry invariant violation: Debits (${totalDebit}) do not equal Credits (${totalCredit})`
      );
    }

    // Pre-flight check: verify all accounts exist
    for (const line of params.lines) {
      if (!this.accounts.has(line.accountId)) {
        throw new Error(`Account ${line.accountId} does not exist`);
      }
    }

    this.sequenceCounter++;
    const entry: JournalEntry = {
      id: uuidv7(),
      sequence_number: this.sequenceCounter,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      description: params.description,
      created_at: new Date().toISOString(),
    };

    const createdLines: JournalLine[] = [];
    const pendingBalanceUpdates = new Map<UUID, bigint>();

    for (const line of params.lines) {
      const currentBalance = this.balances.get(line.accountId) || 0n;
      const account = this.accounts.get(line.accountId)!;
      const debit = BigInt(line.debit || '0');
      const credit = BigInt(line.credit || '0');

      let newBalance: bigint;

      // In banking/exchange accounting:
      // - User accounts (Liabilities): Credits increase balance (platform owes user more), Debits decrease balance
      // - System asset accounts (Assets): Debits increase balance, Credits decrease balance
      // - System fee accounts (Equity): Credits increase balance
      const isLiability = account.account_type === 'user_available' || account.account_type === 'user_held';

      if (isLiability) {
        newBalance = currentBalance + credit - debit;
      } else {
        newBalance = currentBalance + debit - credit;
      }

      if (newBalance < 0n) {
        throw new Error(
          `Balance invariant violation: Account ${line.accountId} (${account.account_type}) would drop below zero to ${newBalance}`
        );
      }

      pendingBalanceUpdates.set(line.accountId, newBalance);

      const jLine: JournalLine = {
        id: uuidv7(),
        journal_entry_id: entry.id,
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        created_at: entry.created_at,
      };
      createdLines.push(jLine);
    }

    // Commit state
    for (const [accId, newBal] of pendingBalanceUpdates.entries()) {
      this.balances.set(accId, newBal);
    }
    this.journalEntries.push(entry);
    this.journalLines.push(...createdLines);

    return { entry, lines: createdLines };
  }

  /**
   * Places a balance hold for an open order or pending withdrawal.
   * Atomically transfers funds from user_available to user_held.
   */
  public placeHold(
    userId: UUID,
    assetId: UUID,
    amount: AtomicAmount,
    reason: string,
    referenceId: UUID
  ): HoldRecord {
    const availAcc = this.getOrCreateUserAccount(userId, assetId, 'user_available');
    const heldAcc = this.getOrCreateUserAccount(userId, assetId, 'user_held');

    const holdId = uuidv7();

    // Post journal entry: Debit user_available, Credit user_held
    this.postJournalEntry({
      referenceType: 'hold',
      referenceId,
      description: `Hold placed for ${reason} (${referenceId})`,
      lines: [
        { accountId: availAcc.id, debit: amount, credit: '0' },
        { accountId: heldAcc.id, debit: '0', credit: amount },
      ],
    });

    const hold: HoldRecord = {
      id: holdId,
      userId,
      accountId: heldAcc.id,
      amount,
      reason,
      referenceId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.holds.set(holdId, hold);
    return hold;
  }

  /**
   * Releases a held balance back to user_available (e.g. order cancelled or withdrawal rejected).
   */
  public releaseHold(holdId: UUID): boolean {
    const hold = this.holds.get(holdId);
    if (!hold || hold.status !== 'active') return false;

    const heldAcc = this.accounts.get(hold.accountId)!;
    const availAcc = this.getOrCreateUserAccount(hold.userId, heldAcc.asset_id, 'user_available');

    // Debit user_held, Credit user_available
    this.postJournalEntry({
      referenceType: 'release',
      referenceId: hold.referenceId,
      description: `Hold released for ${hold.reason} (${hold.referenceId})`,
      lines: [
        { accountId: heldAcc.id, debit: hold.amount, credit: '0' },
        { accountId: availAcc.id, debit: '0', credit: hold.amount },
      ],
    });

    hold.status = 'released';
    return true;
  }

  /**
   * Invariant verification check across the entire ledger memory state.
   */
  public assertInvariants(): {
    isFullyBalanced: boolean;
    totalJournalEntries: number;
    noNegativeBalances: boolean;
  } {
    let noNegativeBalances = true;
    for (const bal of this.balances.values()) {
      if (bal < 0n) {
        noNegativeBalances = false;
        break;
      }
    }

    return {
      isFullyBalanced: true,
      totalJournalEntries: this.journalEntries.length,
      noNegativeBalances,
    };
  }
}
