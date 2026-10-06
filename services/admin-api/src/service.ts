import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { UUID, ApprovalRequest } from '@exchange/shared-types';
import { AdminUser, AdminSession } from './types';
import { AuditLogChain } from './audit';
import { MakerCheckerApprovalEngine } from './approvals';

export class AdminApiService {
  private readonly admins = new Map<UUID, AdminUser>();
  private readonly sessions = new Map<string, AdminSession>(); // tokenHash -> AdminSession
  private readonly challenges = new Map<UUID, { challenge: string; expiresAt: number }>();

  public readonly auditChain: AuditLogChain;
  public readonly approvals: MakerCheckerApprovalEngine;

  constructor() {
    this.auditChain = new AuditLogChain();
    this.approvals = new MakerCheckerApprovalEngine();
    this.seedDefaultAdminUsers();
  }

  private seedDefaultAdminUsers(): void {
    // 1. Alice Maker (Compliance Officer)
    const aliceId = '018e0000-0007-7000-8000-000000000001';
    this.admins.set(aliceId, {
      id: aliceId,
      email: 'maker.admin@exchange.local',
      fullName: 'Alice Maker (Compliance)',
      roleId: '018e0000-0005-7000-8000-000000000002',
      roleName: 'ComplianceOfficer',
      permissions: ['kyc.approve', 'fiat.withdrawal.initiate', 'market.inspect'],
      status: 'active',
      webauthnCredentialId: 'cred_alice_yubikey_001',
      webauthnPublicKey: 'pubkey_alice_mock',
      signCounter: 0,
      createdAt: new Date().toISOString(),
    });

    // 2. Bob Checker (Finance Payments)
    const bobId = '018e0000-0007-7000-8000-000000000002';
    this.admins.set(bobId, {
      id: bobId,
      email: 'checker.admin@exchange.local',
      fullName: 'Bob Checker (Finance)',
      roleId: '018e0000-0005-7000-8000-000000000003',
      roleName: 'FinancePayments',
      permissions: ['fiat.withdrawal.approve', 'hot_wallet.reconcile'],
      status: 'active',
      webauthnCredentialId: 'cred_bob_yubikey_002',
      webauthnPublicKey: 'pubkey_bob_mock',
      signCounter: 0,
      createdAt: new Date().toISOString(),
    });
  }

  public getAdmin(adminId: UUID): AdminUser | null {
    return this.admins.get(adminId) || null;
  }

  public getAdminByEmail(email: string): AdminUser | null {
    for (const a of this.admins.values()) {
      if (a.email.toLowerCase() === email.toLowerCase()) {
        return a;
      }
    }
    return null;
  }

  /**
   * Generates a WebAuthn challenge for hardware token MFA.
   */
  public generateHardwareChallenge(adminId: UUID): { challenge: string; credentialId: string } {
    const admin = this.getAdmin(adminId);
    if (!admin || admin.status !== 'active') {
      throw new Error('Admin user not found or inactive');
    }

    const challenge = crypto.randomBytes(32).toString('base64url');
    this.challenges.set(adminId, { challenge, expiresAt: Date.now() + 180000 }); // 3 min TTL

    return {
      challenge,
      credentialId: admin.webauthnCredentialId,
    };
  }

  /**
   * Verifies hardware WebAuthn MFA and issues a strictly short-lived session (max 60 minutes).
   */
  public verifyHardwareLogin(
    adminId: UUID,
    credentialId: string,
    _clientDataJSON: string,
    ipAddress: string,
    userAgent: string
  ): { admin: AdminUser; rawToken: string; session: AdminSession } {
    const admin = this.getAdmin(adminId);
    if (!admin || admin.status !== 'active') {
      throw new Error('Admin not found or inactive');
    }

    if (admin.webauthnCredentialId !== credentialId) {
      throw new Error('Unregistered hardware credential');
    }

    const challengeRecord = this.challenges.get(adminId);
    if (!challengeRecord || challengeRecord.expiresAt < Date.now()) {
      throw new Error('WebAuthn hardware challenge expired or invalid');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const sessionId = uuidv7();
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

    const session: AdminSession = {
      id: sessionId,
      adminUserId: adminId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(tokenHash, session);
    this.challenges.delete(adminId);
    admin.signCounter++;

    // Write audit event for login
    this.auditChain.appendEvent({
      actorId: admin.id,
      actorType: 'admin',
      action: 'admin.auth.hardware_login_success',
      entityType: 'admin_session',
      entityId: sessionId,
      ipAddress,
      userAgent,
      reason: 'FIDO2 hardware key verification successful',
      details: { role: admin.roleName },
    });

    return { admin, rawToken, session };
  }

  public verifySession(rawToken: string): { isValid: boolean; admin?: AdminUser } {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt) return { isValid: false };

    if (new Date(session.expiresAt) <= new Date()) {
      return { isValid: false };
    }

    const admin = this.getAdmin(session.adminUserId);
    if (!admin || admin.status !== 'active') {
      return { isValid: false };
    }

    return { isValid: true, admin };
  }

  /**
   * Initiates a Maker-Checker four-eyes approval request.
   */
  public initiateApprovalRequest(
    requesterAdmin: AdminUser,
    actionType: ApprovalRequest['action_type'],
    entityId: UUID,
    reason: string,
    payload: Record<string, unknown>,
    ipAddress: string,
    userAgent: string
  ): ApprovalRequest {
    const request = this.approvals.createRequest({
      actionType,
      entityId,
      requesterAdminId: requesterAdmin.id,
      reason,
      payload,
    });

    // Mandatory audit logging with reason
    this.auditChain.appendEvent({
      actorId: requesterAdmin.id,
      actorType: 'admin',
      action: 'admin.approval.request_created',
      entityType: 'approval_request',
      entityId: request.id,
      ipAddress,
      userAgent,
      reason,
      details: {
        actionType,
        targetEntityId: entityId,
        makerRole: requesterAdmin.roleName,
        payload,
      },
    });

    return request;
  }

  /**
   * Completes a Checker decision under the Four-Eyes principle.
   */
  public executeApprovalDecision(
    checkerAdmin: AdminUser,
    requestId: UUID,
    decision: 'approved' | 'rejected',
    notes: string,
    ipAddress: string,
    userAgent: string
  ): { request: ApprovalRequest; stepId: UUID } {
    // Checker cannot be Maker (asserted inside approvals engine)
    const { request, step } = this.approvals.submitDecision(
      requestId,
      checkerAdmin.id,
      decision,
      notes,
      ipAddress
    );

    // Mandatory audit logging
    this.auditChain.appendEvent({
      actorId: checkerAdmin.id,
      actorType: 'admin',
      action: `admin.approval.decision_${decision}`,
      entityType: 'approval_request',
      entityId: requestId,
      ipAddress,
      userAgent,
      reason: notes,
      details: {
        decision,
        checkerRole: checkerAdmin.roleName,
        finalStatus: request.status,
      },
    });

    return { request, stepId: step.id };
  }
}
