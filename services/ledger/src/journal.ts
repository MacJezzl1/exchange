import { PostJournalLine } from './types';

export class DoubleEntryValidator {
  /**
   * Verifies that the sum of debits strictly equals the sum of credits.
   * Uses BigInt to ensure zero floating-point loss across 38-digit integers.
   */
  public static validateBalanced(lines: PostJournalLine[]): {
    isBalanced: boolean;
    totalDebit: bigint;
    totalCredit: bigint;
  } {
    if (lines.length < 2) {
      return { isBalanced: false, totalDebit: 0n, totalCredit: 0n };
    }

    let totalDebit = 0n;
    let totalCredit = 0n;

    for (const line of lines) {
      const debit = BigInt(line.debit || '0');
      const credit = BigInt(line.credit || '0');

      if (debit < 0n || credit < 0n) {
        throw new Error('Debit and credit amounts must be non-negative');
      }

      if ((debit > 0n && credit > 0n) || (debit === 0n && credit === 0n)) {
        throw new Error('Each journal line must specify either a debit OR a credit, not both or neither');
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    return {
      isBalanced: totalDebit === totalCredit,
      totalDebit,
      totalCredit,
    };
  }
}
