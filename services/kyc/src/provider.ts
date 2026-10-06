import crypto from 'crypto';
import { UUID } from '@exchange/shared-types';
import { DocumentType } from './types';

export interface KycProviderSession {
  sessionId: string;
  userId: UUID;
  status: 'pending' | 'completed' | 'failed';
}

export interface KycVerificationOutcome {
  sessionId: string;
  isPassed: boolean;
  confidenceScore: number;
  checks: {
    liveness: boolean;
    idValidity: boolean;
    sanctionsScreening: boolean;
  };
  details: Record<string, unknown>;
}

/**
 * Provider-agnostic interface for KYC and Identity Verification providers
 * (e.g., Sumsub, Veriff, Onfido, Smile Identity in Africa).
 *
 * TO SWAP IN PRODUCTION PROVIDER:
 * 1. Implement this interface in a class named `SumsubKycProvider` or `VeriffKycProvider`.
 * 2. In `services/kyc/src/service.ts`, inject the production provider based on `process.env.KYC_PROVIDER`.
 */
export interface KycProviderAdapter {
  readonly name: string;
  createSession(userId: UUID): Promise<KycProviderSession>;
  uploadDocument(sessionId: string, docType: DocumentType, fileBuffer: Buffer): Promise<{ documentId: string; sha256: string }>;
  evaluateSession(sessionId: string): Promise<KycVerificationOutcome>;
}

/**
 * Deterministic Mock/Sandbox Adapter for testing and local development.
 */
export class MockKycProvider implements KycProviderAdapter {
  public readonly name = 'mock_kyc_sandbox';
  private readonly sessions = new Map<string, KycProviderSession>();
  private readonly documents = new Map<string, { docType: DocumentType; sha256: string }[]>();

  public async createSession(userId: UUID): Promise<KycProviderSession> {
    const sessionId = `mock_sess_${crypto.randomBytes(8).toString('hex')}`;
    const session: KycProviderSession = {
      sessionId,
      userId,
      status: 'pending',
    };
    this.sessions.set(sessionId, session);
    this.documents.set(sessionId, []);
    return session;
  }

  public async uploadDocument(
    sessionId: string,
    docType: DocumentType,
    fileBuffer: Buffer
  ): Promise<{ documentId: string; sha256: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const documentId = `mock_doc_${crypto.randomBytes(6).toString('hex')}`;

    const docs = this.documents.get(sessionId) || [];
    docs.push({ docType, sha256 });
    this.documents.set(sessionId, docs);

    return { documentId, sha256 };
  }

  public async evaluateSession(sessionId: string): Promise<KycVerificationOutcome> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const docs = this.documents.get(sessionId) || [];
    if (docs.length === 0) {
      return {
        sessionId,
        isPassed: false,
        confidenceScore: 0.0,
        checks: { liveness: false, idValidity: false, sanctionsScreening: false },
        details: { reason: 'No documents submitted' },
      };
    }

    // Pass standard valid documents
    session.status = 'completed';
    return {
      sessionId,
      isPassed: true,
      confidenceScore: 98.5,
      checks: {
        liveness: true,
        idValidity: true,
        sanctionsScreening: true, // Clean record, no OFAC / UN hits
      },
      details: {
        extractedName: 'Verified Trader',
        jurisdiction: 'ZA',
        riskCategory: 'LOW',
      },
    };
  }
}
