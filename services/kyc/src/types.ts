import { UUID, TimestampISO } from '@exchange/shared-types';

export type KycTier = 0 | 1 | 2 | 3;
export type KycCaseStatus = 'draft' | 'submitted' | 'under_review' | 'more_info_required' | 'approved' | 'rejected';
export type DocumentType = 'national_id' | 'passport' | 'drivers_license' | 'proof_of_residence';

export interface KycCase {
  id: UUID;
  userId: UUID;
  targetTier: KycTier;
  status: KycCaseStatus;
  providerSessionId?: string;
  assignedReviewerId?: UUID;
  submittedAt?: TimestampISO;
  decidedAt?: TimestampISO;
  createdAt: TimestampISO;
  updatedAt: TimestampISO;
}

export interface KycDocument {
  id: UUID;
  caseId: UUID;
  documentType: DocumentType;
  fileSha256: string;
  storageRef: string;
  mimeType: string;
  isVerified: boolean;
  createdAt: TimestampISO;
}

export interface KycCheckResult {
  id: UUID;
  caseId: UUID;
  providerName: string;
  checkType: 'liveness' | 'id_validity' | 'sanctions_screening';
  isPassed: boolean;
  confidenceScore: number;
  details: Record<string, unknown>;
  createdAt: TimestampISO;
}

export interface KycDecision {
  id: UUID;
  caseId: UUID;
  deciderAdminId?: UUID;
  decision: 'approve' | 'reject' | 'request_more_info';
  reason: string;
  createdAt: TimestampISO;
}
