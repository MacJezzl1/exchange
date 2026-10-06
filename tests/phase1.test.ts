import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService } from '../services/identity/src/service';
import { LedgerService } from '../services/ledger/src/service';
import { AdminApiService } from '../services/admin-api/src/service';
import { AuditLogChain } from '../services/admin-api/src/audit';
import { DoubleEntryValidator } from '../services/ledger/src/journal';

describe('Phase 1: Core Backbone & Invariants Verification', () => {
  let identity: IdentityService;
  let ledger: LedgerService;
  let adminApi: AdminApiService;

  beforeEach(() => {
    identity = new IdentityService();
    ledger = new LedgerService();
    adminApi = new AdminApiService();
  });

  // =========================================================================
  // 1. IDENTITY & CREDENTIAL TESTS
  // =========================================================================
  describe('Identity Domain (Passkeys, SIWE, Security)', () => {
    it('creates a user and registers a WebAuthn passkey', () => {
      const user = identity.createUserWithEmail('trader@example.com');
      expect(user.id).toBeDefined();
      expect(user.status).toBe('active');

      const challenge = identity.webAuthn.generateRegistrationChallenge(user.id);
      expect(challenge.challenge).toBeDefined();

      const clientDataJSON = Buffer.from(
        JSON.stringify({ type: 'webauthn.create', challenge: challenge.challenge })
      ).toString('base64url');

      const cred = identity.registerPasskey(
        user.id,
        clientDataJSON,
        'mock_credential_id_123',
        'mock_public_key_abc',
        'MacBook TouchID'
      );

      expect(cred.nickname).toBe('MacBook TouchID');
      expect(cred.signCounter).toBe(0);
    });

    it('authenticates with passkey and generates a secure session', () => {
      const user = identity.createUserWithEmail('trader2@example.com');
      const challengeReg = identity.webAuthn.generateRegistrationChallenge(user.id);
      const clientDataReg = Buffer.from(
        JSON.stringify({ type: 'webauthn.create', challenge: challengeReg.challenge })
      ).toString('base64url');
      identity.registerPasskey(user.id, clientDataReg, 'cred_456', 'pubkey_456', 'YubiKey 5C');

      const challengeAuth = identity.webAuthn.generateAuthenticationChallenge(user.id);
      const clientDataAuth = Buffer.from(
        JSON.stringify({ type: 'webauthn.get', challenge: challengeAuth.challenge })
      ).toString('base64url');

      const authResult = identity.authenticateWithPasskey(
        user.id,
        clientDataAuth,
        'cred_456',
        '192.168.1.100',
        'Mozilla/5.0'
      );

      expect(authResult.session.userId).toBe(user.id);
      expect(authResult.rawToken).toBeDefined();

      // Session lookup
      const session = identity.sessionManager.getSessionByRawToken(authResult.rawToken);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(user.id);
    });

    it('enforces panic freeze: locks account and terminates all sessions', () => {
      const user = identity.createUserWithEmail('trader3@example.com');
      const { rawToken, tokenHash } = identity.sessionManager.generateSessionToken();
      identity.sessionManager.createSession('sess_1', user.id, tokenHash, '127.0.0.1', 'agent');

      // Verify active session before freeze
      expect(identity.sessionManager.getSessionByRawToken(rawToken)).not.toBeNull();

      // Trigger panic freeze
      const frozen = identity.panicFreezeAccount(user.id, 'User clicked panic freeze');
      expect(frozen).toBe(true);
      expect(identity.isAccountFrozen(user.id)).toBe(true);

      // Session must be instantly invalid
      expect(identity.sessionManager.getSessionByRawToken(rawToken)).toBeNull();

      // Further logins must be rejected
      expect(() => {
        identity.authenticateWithPasskey(user.id, '', 'cred', '127.0.0.1', '');
      }).toThrow(/panic-frozen/);
    });

    it('enforces withdrawal address whitelisting timelock', () => {
      const user = identity.createUserWithEmail('trader4@example.com');
      const targetAddr = '0x1234567890123456789012345678901234567890';

      // Add whitelist address with 24h timelock
      const added = identity.addWhitelistAddress(user.id, 84532, targetAddr, 24);
      expect(added.isActive).toBe(false);

      // Immediately checking whitelisting must return false
      expect(identity.isAddressWhitelisted(user.id, 84532, targetAddr)).toBe(false);
    });

    it('validates Sign-In with Ethereum (SIWE / EIP-4361) messages', () => {
      const nonce = identity.siwe.generateNonce();
      const siweMsg = `localhost wants you to sign in with your Ethereum account:\n0x1111111111111111111111111111111111111111\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: 2026-10-06T10:00:00.000Z`;

      const parsed = identity.siwe.parseMessage(siweMsg);
      expect(parsed).not.toBeNull();
      expect(parsed?.address).toBe('0x1111111111111111111111111111111111111111');
      expect(parsed?.chainId).toBe(84532);

      // 65-byte dummy hex signature
      const dummySig = `0x${'aa'.repeat(65)}` as const;
      const verifyResult = identity.siwe.verifySignature(siweMsg, dummySig, 'localhost');
      expect(verifyResult.isValid).toBe(true);
      expect(verifyResult.address).toBe('0x1111111111111111111111111111111111111111');
    });
  });

  // =========================================================================
  // 2. LEDGER DOMAIN (Double-Entry Invariants)
  // =========================================================================
  describe('Ledger Domain (Double-Entry Core & Hold Lifecycle)', () => {
    const usdtAssetId = '018e0000-0000-7000-8000-000000000001';
    const btcAssetId = '018e0000-0000-7000-8000-000000000002';

    it('rejects unbalanced journal entries (Invariant 1)', () => {
      const res = DoubleEntryValidator.validateBalanced([
        { accountId: 'acc1', debit: '1000', credit: '0' },
        { accountId: 'acc2', debit: '0', credit: '999' },
      ]);
      expect(res.isBalanced).toBe(false);

      expect(() => {
        ledger.postJournalEntry({
          referenceType: 'reconciliation',
          referenceId: 'ref_1',
          description: 'Unbalanced injection test',
          lines: [
            { accountId: 'acc1', debit: '1000', credit: '0' },
            { accountId: 'acc2', debit: '0', credit: '999' },
          ],
        });
      }).toThrow(/Double-entry invariant violation/);
    });

    it('executes balanced user deposit: system_hot_wallet debit and user_available credit', () => {
      const userId = '018e0000-0001-0000-0000-000000000001';
      const userAvailAcc = ledger.getOrCreateUserAccount(userId, usdtAssetId, 'user_available');
      const hotWalletAcc = ledger.createAccount(null, usdtAssetId, 'system_hot_wallet');

      // Deposit 5,000 USDT (5,000,000,000 atomic units)
      const depositAmount = '5000000000';
      ledger.postJournalEntry({
        referenceType: 'deposit',
        referenceId: 'dep_tx_1',
        description: 'On-chain deposit credited',
        lines: [
          { accountId: hotWalletAcc.id, debit: depositAmount, credit: '0' },
          { accountId: userAvailAcc.id, debit: '0', credit: depositAmount },
        ],
      });

      expect(ledger.getBalance(userAvailAcc.id)).toBe('5000000000');
      expect(ledger.getBalance(hotWalletAcc.id)).toBe('5000000000');
    });

    it('prevents user balance from dropping below zero (Invariant 2)', () => {
      const userId = '018e0000-0001-0000-0000-000000000002';
      const userAvailAcc = ledger.getOrCreateUserAccount(userId, usdtAssetId, 'user_available');
      const hotWalletAcc = ledger.createAccount(null, usdtAssetId, 'system_hot_wallet');

      // Attempt to debit more than user has
      expect(() => {
        ledger.postJournalEntry({
          referenceType: 'withdrawal',
          referenceId: 'with_1',
          description: 'Overdraft attempt',
          lines: [
            { accountId: userAvailAcc.id, debit: '1000000', credit: '0' },
            { accountId: hotWalletAcc.id, debit: '0', credit: '1000000' },
          ],
        });
      }).toThrow(/would drop below zero/);
    });

    it('manages full balance hold lifecycle (place hold -> release hold)', () => {
      const userId = '018e0000-0001-0000-0000-000000000003';
      const userAvailAcc = ledger.getOrCreateUserAccount(userId, usdtAssetId, 'user_available');
      const hotWalletAcc = ledger.createAccount(null, usdtAssetId, 'system_hot_wallet');

      // Seed with 1,000 USDT
      ledger.postJournalEntry({
        referenceType: 'deposit',
        referenceId: 'dep_2',
        description: 'Seed deposit',
        lines: [
          { accountId: hotWalletAcc.id, debit: '1000000000', credit: '0' },
          { accountId: userAvailAcc.id, debit: '0', credit: '1000000000' },
        ],
      });

      // Place hold of 400 USDT for an open order
      const hold = ledger.placeHold(userId, usdtAssetId, '400000000', 'order_hold', 'order_123');
      expect(hold.status).toBe('active');
      expect(ledger.getBalance(userAvailAcc.id)).toBe('600000000'); // 1000 - 400 = 600

      const heldAcc = ledger.getUserAccount(userId, usdtAssetId, 'user_held')!;
      expect(ledger.getBalance(heldAcc.id)).toBe('400000000');

      // Cancel order -> Release hold
      const released = ledger.releaseHold(hold.id);
      expect(released).toBe(true);
      expect(ledger.getBalance(userAvailAcc.id)).toBe('1000000000'); // Restored to 1000
      expect(ledger.getBalance(heldAcc.id)).toBe('0');
    });
  });

  // =========================================================================
  // 3. ADMIN API, MAKER-CHECKER & AUDIT HASH CHAIN TESTS
  // =========================================================================
  describe('Admin Subsystem (WebAuthn MFA, Four-Eyes, Cryptographic Audit Chain)', () => {
    it('authenticates admin via FIDO2 hardware token', () => {
      const alice = adminApi.getAdminByEmail('maker.admin@exchange.local')!;
      expect(alice).toBeDefined();

      const { challenge, credentialId } = adminApi.generateHardwareChallenge(alice.id);
      expect(challenge).toBeDefined();
      expect(credentialId).toBe('cred_alice_yubikey_001');

      const clientDataJSON = Buffer.from(
        JSON.stringify({ type: 'webauthn.get', challenge })
      ).toString('base64url');

      const login = adminApi.verifyHardwareLogin(
        alice.id,
        credentialId,
        clientDataJSON,
        '10.0.0.5',
        'Mozilla/AdminClient'
      );

      expect(login.admin.id).toBe(alice.id);
      expect(login.rawToken).toBeDefined();

      // Verify active admin session
      const verify = adminApi.verifySession(login.rawToken);
      expect(verify.isValid).toBe(true);
      expect(verify.admin?.email).toBe('maker.admin@exchange.local');
    });

    it('strictly prevents Maker from acting as Checker on the same approval request (Four-Eyes Principle)', () => {
      const aliceMaker = adminApi.getAdminByEmail('maker.admin@exchange.local')!;

      // Alice initiates a sensitive fiat withdrawal approval request
      const req = adminApi.initiateApprovalRequest(
        aliceMaker,
        'fiat_withdrawal',
        'withdrawal_id_999',
        'Large ZAR fiat payout approval > ZAR 50,000 threshold',
        { amountZAR: 150000, recipient: 'Verified Standard Bank Account' },
        '10.0.0.5',
        'AdminConsole'
      );

      expect(req.status).toBe('pending');

      // Alice attempts to self-approve: MUST FAIL!
      expect(() => {
        adminApi.executeApprovalDecision(
          aliceMaker,
          req.id,
          'approved',
          'Attempted self-approval',
          '10.0.0.5',
          'AdminConsole'
        );
      }).toThrow(/Four-eyes invariant violation: The requester .* cannot act as the Checker/);
    });

    it('allows distinct Checker to sign off approval request and completes maker-checker workflow', () => {
      const aliceMaker = adminApi.getAdminByEmail('maker.admin@exchange.local')!;
      const bobChecker = adminApi.getAdminByEmail('checker.admin@exchange.local')!;

      // Maker initiates request
      const req = adminApi.initiateApprovalRequest(
        aliceMaker,
        'fiat_withdrawal',
        'withdrawal_id_888',
        'Large ZAR fiat payout approval > ZAR 50,000 threshold',
        { amountZAR: 80000 },
        '10.0.0.5',
        'AdminConsole'
      );

      // Distinct Checker approves
      const outcome = adminApi.executeApprovalDecision(
        bobChecker,
        req.id,
        'approved',
        'Secondary FICA compliance check confirmed',
        '10.0.0.6',
        'AdminConsole'
      );

      expect(outcome.request.status).toBe('approved');
    });

    it('verifies the append-only SHA-256 hash-chained audit log end-to-end', () => {
      const alice = adminApi.getAdminByEmail('maker.admin@exchange.local')!;

      // Log 10 diverse administrative events
      for (let i = 1; i <= 10; i++) {
        adminApi.auditChain.appendEvent({
          actorId: alice.id,
          actorType: 'admin',
          action: `admin.operation.step_${i}`,
          entityType: 'test_entity',
          entityId: `entity_${i}`,
          ipAddress: '10.0.0.5',
          userAgent: 'TestRunner',
          reason: `Step ${i} audit justification`,
          details: { step: i, param: `val_${i}` },
        });
      }

      // Check chain validity
      const verification = adminApi.auditChain.verifyChain();
      expect(verification.isValid).toBe(true);
      expect(verification.totalEvents).toBeGreaterThanOrEqual(10);
    });

    it('detects tampering in the cryptographic audit chain', () => {
      const audit = new AuditLogChain();
      for (let i = 1; i <= 5; i++) {
        audit.appendEvent({
          actorId: 'admin_1',
          actorType: 'admin',
          action: `action_${i}`,
          entityType: 'entity',
          entityId: `id_${i}`,
          ipAddress: '127.0.0.1',
          userAgent: 'Agent',
          reason: 'Normal action',
          details: {},
        });
      }

      // Chain is initially valid
      expect(audit.verifyChain().isValid).toBe(true);

      // Malicious insider directly mutates past event details in memory
      const events = (audit as any).events;
      events[2].action = 'tampered.action'; // Mutated without updating hash chain!

      const tamperedCheck = audit.verifyChain();
      expect(tamperedCheck.isValid).toBe(false);
      expect(tamperedCheck.brokenAtSequence).toBe(3);
    });
  });
});
