import { v7 as uuidv7 } from 'uuid';
import { UUID } from '@exchange/shared-types';
import { KycCase, KycDocument, KycCheckResult, KycDecision, KycTier, DocumentType } from './types';
import { KycProviderAdapter, MockKycProvider } from './provider';

export class KycService {
  private readonly cases = new Map<UUID, KycCase>();
  private readonly userCases = new Map<UUID, UUID[]>(); // userId -> caseIds
  private readonly userTiers = new Map<UUID, KycTier>(); // userId -> current tier
  private readonly documents = new Map<UUID, KycDocument[]>(); // caseId -> docs
  private readonly checkResults = new Map<UUID, KycCheckResult[]>(); // caseId -> results
  private readonly decisions = new Map<UUID, KycDecision[]>(); // caseId -> decisions
  private readonly provider: KycProviderAdapter;

  constructor(provider?: KycProviderAdapter) {
    this.provider = provider || new MockKycProvider();
  }

  public getUserTier(userId: UUID): KycTier {
    return this.userTiers.get(userId) ?? 0; // Default: Tier 0 (Browse)
  }

  public async initiateCase(userId: UUID, targetTier: KycTier): Promise<KycCase> {
    const currentTier = this.getUserTier(userId);
    if (targetTier <= currentTier) {
      throw new Error(`User already holds tier ${currentTier}. Target tier must be higher.`);
    }

    const providerSession = await this.provider.createSession(userId);
    const caseId = uuidv7();

    const kycCase: KycCase = {
      id: caseId,
      userId,
      targetTier,
      status: 'draft',
      providerSessionId: providerSession.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cases.set(caseId, kycCase);
    const userList = this.userCases.get(userId) || [];
    userList.push(caseId);
    this.userCases.set(userId, userList);
    this.documents.set(caseId, []);
    this.checkResults.set(caseId, []);
    this.decisions.set(caseId, []);

    return kycCase;
  }

  public async uploadDocument(
    caseId: UUID,
    docType: DocumentType,
    fileBuffer: Buffer,
    mimeType = 'image/jpeg'
  ): Promise<KycDocument> {
    const kycCase = this.cases.get(caseId);
    if (!kycCase) {
      throw new Error(`KYC Case ${caseId} not found`);
    }

    if (kycCase.status !== 'draft' && kycCase.status !== 'more_info_required') {
      throw new Error(`Cannot add documents to case in status ${kycCase.status}`);
    }

    const uploaded = await this.provider.uploadDocument(kycCase.providerSessionId!, docType, fileBuffer);

    const doc: KycDocument = {
      id: uuidv7(),
      caseId,
      documentType: docType,
      fileSha256: uploaded.sha256,
      storageRef: uploaded.documentId,
      mimeType,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    const docList = this.documents.get(caseId) || [];
    docList.push(doc);
    this.documents.set(caseId, docList);

    return doc;
  }

  public async submitCaseForEvaluation(caseId: UUID): Promise<KycCase> {
    const kycCase = this.cases.get(caseId);
    if (!kycCase) {
      throw new Error(`KYC Case ${caseId} not found`);
    }

    const docs = this.documents.get(caseId) || [];
    if (docs.length === 0) {
      throw new Error('Cannot submit KYC case without required identification documents');
    }

    kycCase.status = 'under_review';
    kycCase.submittedAt = new Date().toISOString();
    kycCase.updatedAt = new Date().toISOString();

    // Trigger automated screening evaluation
    const outcome = await this.provider.evaluateSession(kycCase.providerSessionId!);

    const checkResult: KycCheckResult = {
      id: uuidv7(),
      caseId,
      providerName: this.provider.name,
      checkType: 'id_validity',
      isPassed: outcome.isPassed,
      confidenceScore: outcome.confidenceScore,
      details: outcome.details,
      createdAt: new Date().toISOString(),
    };

    const results = this.checkResults.get(caseId) || [];
    results.push(checkResult);
    this.checkResults.set(caseId, results);

    return kycCase;
  }

  public getPendingReviewQueue(): KycCase[] {
    return Array.from(this.cases.values()).filter((c) => c.status === 'under_review');
  }

  public adminReviewDecision(
    caseId: UUID,
    adminId: UUID,
    decision: 'approve' | 'reject' | 'request_more_info',
    reason: string
  ): KycCase {
    const kycCase = this.cases.get(caseId);
    if (!kycCase) {
      throw new Error(`KYC Case ${caseId} not found`);
    }

    if (kycCase.status !== 'under_review') {
      throw new Error(`Case ${caseId} is not in review status (${kycCase.status})`);
    }

    const decisionRecord: KycDecision = {
      id: uuidv7(),
      caseId,
      deciderAdminId: adminId,
      decision,
      reason,
      createdAt: new Date().toISOString(),
    };

    const decisionsList = this.decisions.get(caseId) || [];
    decisionsList.push(decisionRecord);
    this.decisions.set(caseId, decisionsList);

    if (decision === 'approve') {
      kycCase.status = 'approved';
      kycCase.decidedAt = new Date().toISOString();
      // Upgrade user's tier
      this.userTiers.set(kycCase.userId, kycCase.targetTier);
    } else if (decision === 'reject') {
      kycCase.status = 'rejected';
      kycCase.decidedAt = new Date().toISOString();
    } else {
      kycCase.status = 'more_info_required';
    }

    kycCase.updatedAt = new Date().toISOString();
    return kycCase;
  }
}
