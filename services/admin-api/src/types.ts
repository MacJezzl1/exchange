import { UUID, TimestampISO, ApprovalRequest } from '@exchange/shared-types';

export interface AdminUser {
  id: UUID;
  email: string;
  fullName: string;
  roleId: UUID;
  roleName: string;
  permissions: string[];
  status: 'active' | 'suspended' | 'deactivated';
  webauthnCredentialId: string;
  webauthnPublicKey: string;
  signCounter: number;
  createdAt: TimestampISO;
}

export interface AdminSession {
  id: UUID;
  adminUserId: UUID;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: TimestampISO;
  revokedAt?: TimestampISO;
  createdAt: TimestampISO;
}

export interface LogAuditParams {
  actorId: UUID;
  actorType: 'admin' | 'system' | 'user';
  action: string;
  entityType: string;
  entityId: UUID;
  ipAddress: string;
  userAgent: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface CreateApprovalRequestParams {
  actionType: ApprovalRequest['action_type'];
  entityId: UUID;
  requesterAdminId: UUID;
  reason: string;
  payload: Record<string, unknown>;
  ttlHours?: number;
}
