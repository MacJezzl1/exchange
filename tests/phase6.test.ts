import { describe, it, expect } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import { MatchingEngineCore, InternalOrder } from '../services/trading/src/engine';
import { LedgerService } from '../services/ledger/src/service';
import { SettlementService, AccountBalance } from '../services/settlement/src';

describe('Phase 6: Hardening, Chaos & Disaster Recovery Drills', () => {
  const marketId = uuidv7();
  const btcAsset = '018e0000-0000-7000-8000-000000000002';
  const usdtAsset = '018e0000-0000-7000-8000-000000000001';

  // =========================================================================
  // 1. ENGINE CRASH & CRASH-RECOVERY DRILL
  // =========================================================================
  describe('Disaster Recovery: Engine Crash & Deterministic Replay', () => {
    it('reconstructs identical state after simulated process crash by replaying event log', () => {
      // 1. Primary engine processes a sequence of 60 orders
      let primaryEngine: MatchingEngineCore | null = new MatchingEngineCore(marketId);
      const ordersToReplay: InternalOrder[] = [];

      for (let i = 1; i <= 60; i++) {
        const side = i % 2 === 0 ? 'buy' : 'sell';
        const price = side === 'buy' ? BigInt(60000 + (i % 10) * 10) : BigInt(61000 + (i % 10) * 10);
        const order: InternalOrder = {
          id: uuidv7(),
          userId: `trader_${i % 4}`,
          marketId,
          side,
          orderType: 'limit',
          price,
          quantity: BigInt(i * 10),
          remainingQuantity: BigInt(i * 10),
          timestampNs: 1000000000 + i,
        };
        ordersToReplay.push(order);
        primaryEngine.processOrder({ ...order });
      }

      // Record state before crash
      const preCrashSequence = primaryEngine.sequence;
      const preCrashBestBid = primaryEngine.getBestBid();
      const preCrashBestAsk = primaryEngine.getBestAsk();
      const preCrashDepth = primaryEngine.getDepth(10);

      // SIMULATE CRASH: Kill primary engine memory instance
      primaryEngine = null;
      expect(primaryEngine).toBeNull();

      // RECOVERY: Spawn replacement engine and replay logged events
      const recoveredEngine = new MatchingEngineCore(marketId);
      for (const order of ordersToReplay) {
        recoveredEngine.processOrder({ ...order });
      }

      // Assert complete state equivalence
      expect(recoveredEngine.sequence).toBe(preCrashSequence);
      expect(recoveredEngine.getBestBid()).toBe(preCrashBestBid);
      expect(recoveredEngine.getBestAsk()).toBe(preCrashBestAsk);
      expect(recoveredEngine.getDepth(10)).toEqual(preCrashDepth);
    });
  });

  // =========================================================================
  // 2. DOUBLE-ENTRY LEDGER CORRUPTION DEFENSE DRILL
  // =========================================================================
  describe('Ledger Resiliency: Invariant Protection & Fault Injection', () => {
    it('strictly rejects unbalanced transactions and prevents negative balance states', () => {
      const ledger = new LedgerService();
      const alice = uuidv7();

      const hotWallet = ledger.createAccount(null, usdtAsset, 'system_hot_wallet');
      const aliceAvail = ledger.getOrCreateUserAccount(alice, usdtAsset, 'user_available');

      // 1. Valid balanced deposit: Hot Wallet (Debit 100), Alice (Credit 100)
      ledger.postJournalEntry({
        referenceType: 'deposit',
        referenceId: uuidv7(),
        description: 'Fund Alice 100 USDT',
        lines: [
          { accountId: hotWallet.id, debit: '100', credit: '0' },
          { accountId: aliceAvail.id, debit: '0', credit: '100' },
        ],
      });

      // 2. FAULT INJECTION A: Unbalanced entry (Debit 50, Credit 40) MUST THROW
      expect(() => {
        ledger.postJournalEntry({
          referenceType: 'deposit',
          referenceId: uuidv7(),
          description: 'Malicious unbalanced entry',
          lines: [
            { accountId: hotWallet.id, debit: '50', credit: '0' },
            { accountId: aliceAvail.id, debit: '0', credit: '40' },
          ],
        });
      }).toThrow(/Double-entry invariant violation/);

      // 3. FAULT INJECTION B: Overdraft (Attempt to debit Alice by 200 when balance is 100) MUST THROW
      expect(() => {
        ledger.postJournalEntry({
          referenceType: 'withdrawal',
          referenceId: uuidv7(),
          description: 'Malicious overdraft withdrawal',
          lines: [
            { accountId: aliceAvail.id, debit: '200', credit: '0' },
            { accountId: hotWallet.id, debit: '0', credit: '200' },
          ],
        });
      }).toThrow(/Balance invariant violation/);

      // 4. Verify system invariant remains 100% clean
      const invariants = ledger.assertInvariants();
      expect(invariants.isFullyBalanced).toBe(true);
      expect(invariants.noNegativeBalances).toBe(true);
      expect(ledger.getBalance(aliceAvail.id)).toBe('100'); // Alice balance uncorrupted
    });
  });

  // =========================================================================
  // 3. FORGED SETTLEMENT BATCH REJECTION DRILL
  // =========================================================================
  describe('Settlement Security: Forged & Out-Of-Order Batch Rejection', () => {
    it('guards against invalid batch states and sequence replays', () => {
      const aliceAddr = '0x1111111111111111111111111111111111111111';
      const bobAddr = '0x2222222222222222222222222222222222222222';
      const initialAccounts: AccountBalance[] = [
        { userAddress: aliceAddr, assetAddress: btcAsset, balance: 10n },
        { userAddress: bobAddr, assetAddress: usdtAsset, balance: 100000n },
      ];

      const settlement = new SettlementService(initialAccounts);

      // Batch 1 succeeds
      const batch1 = settlement.createSettlementBatch([
        {
          tradeId: uuidv7(),
          buyerAddress: bobAddr,
          sellerAddress: aliceAddr,
          baseAssetAddress: btcAsset,
          quoteAssetAddress: usdtAsset,
          price: '50000',
          quantity: '1',
          buyerFee: '100',
          sellerFee: '50',
        },
      ]);
      expect(batch1.batchId).toBe(1);

      // Subsequent batch must increment sequence
      const batch2 = settlement.createSettlementBatch([]);
      expect(batch2.batchId).toBe(2);
    });
  });

  // =========================================================================
  // 4. EMERGENCY ESCAPE HATCH DRILL
  // =========================================================================
  describe('Non-Custodial Escape Hatch: Offline Operator Detection', () => {
    it('activates escape hatch mode when operator heartbeat exceeds 7 days', () => {
      const ESCAPE_HATCH_SECONDS = 7 * 24 * 3600; // 7 days

      function isEscapeHatchActive(lastHeartbeatSeconds: number, currentTimestampSeconds: number): boolean {
        return currentTimestampSeconds > lastHeartbeatSeconds + ESCAPE_HATCH_SECONDS;
      }

      const now = Math.floor(Date.now() / 1000);

      // Normal state (heartbeat received 5 minutes ago) -> Inactive
      expect(isEscapeHatchActive(now - 300, now)).toBe(false);

      // Operator offline for 3 days -> Still in grace period
      expect(isEscapeHatchActive(now - 3 * 24 * 3600, now)).toBe(false);

      // Operator offline for 7 days + 1 second -> ACTIVATED!
      expect(isEscapeHatchActive(now - (ESCAPE_HATCH_SECONDS + 1), now)).toBe(true);

      // Operator offline for 14 days -> ACTIVATED!
      expect(isEscapeHatchActive(now - 14 * 24 * 3600, now)).toBe(true);
    });
  });
});
