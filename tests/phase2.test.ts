import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService } from '../services/identity/src/service';
import { LedgerService } from '../services/ledger/src/service';
import { AdminApiService } from '../services/admin-api/src/service';
import { KycService } from '../services/kyc/src/service';
import { ChainWatcherIndexer } from '../services/chain-watcher/src/indexer';
import { MockChainRpcAdapter } from '../services/chain-watcher/src/provider';
import { WithdrawalSafetyEngine } from '../services/risk/src/withdrawal-safety';

describe('Phase 2: Compliance and Money In/Out (End-to-End Verification)', () => {
  let identity: IdentityService;
  let ledger: LedgerService;
  let adminApi: AdminApiService;
  let kyc: KycService;
  let rpc: MockChainRpcAdapter;
  let watcher: ChainWatcherIndexer;
  let risk: WithdrawalSafetyEngine;

  const usdtAssetId = '018e0000-0000-7000-8000-000000000001';
  const usdtContractAddress = '0x1111111111111111111111111111111111111111' as const;

  beforeEach(() => {
    identity = new IdentityService();
    ledger = new LedgerService();
    adminApi = new AdminApiService();
    kyc = new KycService();
    risk = new WithdrawalSafetyEngine();

    rpc = new MockChainRpcAdapter(84532, 1000);
    watcher = new ChainWatcherIndexer(rpc, 12, 1000);

    // Wire chain-watcher deposit confirmation directly to double-entry ledger
    const hotWalletAcc = ledger.createAccount(null, usdtAssetId, 'system_hot_wallet');
    watcher.onCredit((userId, assetId, amount, referenceId) => {
      const userAvailAcc = ledger.getOrCreateUserAccount(userId, assetId, 'user_available');
      ledger.postJournalEntry({
        referenceType: 'deposit',
        referenceId,
        description: 'On-chain deposit credited from Base L2',
        lines: [
          { accountId: hotWalletAcc.id, debit: amount, credit: '0' },
          { accountId: userAvailAcc.id, debit: '0', credit: amount },
        ],
      });
    });

    watcher.registerAssetAddress(usdtContractAddress, usdtAssetId);
  });

  it('completes the full Phase 2 Exit Flow: KYC verification -> Testnet deposit -> Maker-Checker withdrawal', async () => {
    // -----------------------------------------------------------------------
    // STEP 1: User Onboarding & Initial KYC Level Check
    // -----------------------------------------------------------------------
    const userWallet = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' as const;
    const user = identity.createUserWithWallet(userWallet);
    watcher.registerUserAddress(userWallet, user.id);

    // Verify initial tier is 0 (Browse)
    expect(kyc.getUserTier(user.id)).toBe(0);

    // Tier 0 cannot withdraw
    const preKycAssessment = risk.evaluateWithdrawal({
      userId: user.id,
      userKycTier: kyc.getUserTier(user.id),
      amountUSD: 500,
      isAddressWhitelisted: false,
      rolling24hVolumeUSD: 0,
      isPanicFrozen: false,
    });
    expect(preKycAssessment.isAllowed).toBe(false);
    expect(preKycAssessment.reasons[0]).toMatch(/Tier L0 cannot withdraw/);

    // -----------------------------------------------------------------------
    // STEP 2: User Completes KYC Flow (Documents Uploaded & Verified)
    // -----------------------------------------------------------------------
    const kycCase = await kyc.initiateCase(user.id, 2); // Target: Tier 2 (Full)
    expect(kycCase.status).toBe('draft');

    // Upload Identification Document
    const mockDocBuffer = Buffer.from('FAKE_PASSPORT_IMAGE_DATA');
    await kyc.uploadDocument(kycCase.id, 'passport', mockDocBuffer);

    // Submit for automated verification
    await kyc.submitCaseForEvaluation(kycCase.id);
    expect(kycCase.status).toBe('under_review');

    // Compliance Officer (Alice) reviews and approves KYC Case
    const aliceAdmin = adminApi.getAdminByEmail('maker.admin@exchange.local')!;
    const approvedCase = kyc.adminReviewDecision(
      kycCase.id,
      aliceAdmin.id,
      'approve',
      'Passport verified, sanctions check clear'
    );
    expect(approvedCase.status).toBe('approved');
    expect(kyc.getUserTier(user.id)).toBe(2); // Successfully upgraded to Tier 2!

    // -----------------------------------------------------------------------
    // STEP 3: User Deposits Testnet Funds into Vault on Base L2
    // -----------------------------------------------------------------------
    const depositAmountAtomic = '25000000000'; // 25,000 USDT (6 decimals)
    const depositTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;

    // Simulate Vault.sol emitting Deposit event on Base L2
    rpc.emitDeposit(depositTxHash, userWallet, usdtContractAddress, depositAmountAtomic, 1);

    // Polling indexer before 12 block confirmations -> pending/confirming
    await watcher.pollAndIndex();
    let tracked = watcher.getDeposit(depositTxHash);
    expect(tracked).not.toBeNull();
    expect(tracked?.status).toBe('confirming');

    // Fast-forward 12 blocks on Base L2
    rpc.advanceBlocks(12);
    await watcher.pollAndIndex();

    // Deposit must be credited
    tracked = watcher.getDeposit(depositTxHash);
    expect(tracked?.status).toBe('credited');

    // Double-entry ledger must reflect the credited balance
    const userAcc = ledger.getUserAccount(user.id, usdtAssetId, 'user_available')!;
    expect(ledger.getBalance(userAcc.id)).toBe(depositAmountAtomic);

    // -----------------------------------------------------------------------
    // STEP 4: User Requests Withdrawal > $10,000 (Requires Four-Eyes Approval)
    // -----------------------------------------------------------------------
    const withdrawalAmountUSD = 15000; // $15,000 > $10,000 threshold
    const withdrawalAmountAtomic = '15000000000'; // 15,000 USDT

    const riskAssessment = risk.evaluateWithdrawal({
      userId: user.id,
      userKycTier: kyc.getUserTier(user.id),
      amountUSD: withdrawalAmountUSD,
      isAddressWhitelisted: true,
      rolling24hVolumeUSD: 0,
      isPanicFrozen: false,
    });

    expect(riskAssessment.isAllowed).toBe(true);
    expect(riskAssessment.requiresFourEyesApproval).toBe(true); // Flagged for 4-eyes

    // Place balance hold on the requested withdrawal amount
    const hold = ledger.placeHold(
      user.id,
      usdtAssetId,
      withdrawalAmountAtomic,
      'withdrawal_request',
      'with_req_001'
    );
    expect(hold.status).toBe('active');
    expect(ledger.getBalance(userAcc.id)).toBe('10000000000'); // 25,000 - 15,000 = 10,000 left available

    // -----------------------------------------------------------------------
    // STEP 5: Maker Admin Initiates Approval Request
    // -----------------------------------------------------------------------
    const approvalReq = adminApi.initiateApprovalRequest(
      aliceAdmin,
      'fiat_withdrawal',
      'with_req_001',
      'High-value withdrawal > $10k threshold requiring dual authorization',
      { amountUSD: withdrawalAmountUSD, destination: userWallet },
      '10.0.0.1',
      'AdminConsole'
    );
    expect(approvalReq.status).toBe('pending');

    // -----------------------------------------------------------------------
    // STEP 6: Four-Eyes Invariant Check: Maker CANNOT Self-Approve
    // -----------------------------------------------------------------------
    expect(() => {
      adminApi.executeApprovalDecision(
        aliceAdmin,
        approvalReq.id,
        'approved',
        'Attempted self-approval',
        '10.0.0.1',
        'AdminConsole'
      );
    }).toThrow(/Four-eyes invariant violation/);

    // -----------------------------------------------------------------------
    // STEP 7: Distinct Checker Admin (Bob) Approves with Hardware MFA
    // -----------------------------------------------------------------------
    const bobAdmin = adminApi.getAdminByEmail('checker.admin@exchange.local')!;
    const decisionResult = adminApi.executeApprovalDecision(
      bobAdmin,
      approvalReq.id,
      'approved',
      'Secondary verification passed. Payout authorized.',
      '10.0.0.2',
      'AdminConsole'
    );

    expect(decisionResult.request.status).toBe('approved');

    // Complete withdrawal in ledger: move held funds out
    const hotWalletAcc = ledger.getUserAccount(null as any, usdtAssetId, 'system_hot_wallet')!;
    const heldAcc = ledger.getUserAccount(user.id, usdtAssetId, 'user_held')!;

    ledger.postJournalEntry({
      referenceType: 'withdrawal',
      referenceId: approvalReq.id,
      description: 'Approved withdrawal dispatched',
      lines: [
        { accountId: heldAcc.id, debit: withdrawalAmountAtomic, credit: '0' },
        { accountId: hotWalletAcc.id, debit: '0', credit: withdrawalAmountAtomic },
      ],
    });

    // -----------------------------------------------------------------------
    // STEP 8: Cryptographic Audit Chain Verification
    // -----------------------------------------------------------------------
    const auditStatus = adminApi.auditChain.verifyChain();
    expect(auditStatus.isValid).toBe(true);
    expect(auditStatus.totalEvents).toBeGreaterThanOrEqual(2);
  });
});
