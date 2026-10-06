import { v7 as uuidv7 } from 'uuid';
import { UUID, ApprovalRequest } from '@exchange/shared-types';
import { CreateApprovalRequestParams } from './types';

export interface ApprovalStepRecord {
  id: UUID;
  approvalRequestId: UUID;
  adminUserId: UUID;
  decision: 'approved' | 'rejected';
  notes: string;
  ipAddress: string;
  createdAt: string;
}

export class MakerCheckerApprovalEngine {
  private readonly requests = new Map<UUID, ApprovalRequest>();
  private readonly steps = new Map<UUID, ApprovalStepRecord[]>(); // requestId -> steps
  private readonly payloads = new Map<UUID, Record<string, unknown>>();

  public createRequest(params: CreateApprovalRequestParams): ApprovalRequest {
    const id = uuidv7();
    const expiresAt = new Date(Date.now() + (params.ttlHours || 24) * 3600 * 1000).toISOString();

    const request: ApprovalRequest = {
      id,
      action_type: params.actionType,
      entity_id: params.entityId,
      requester_id: params.requesterAdminId,
      status: 'pending',
      required_approvals: 2,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    this.requests.set(id, request);
    this.steps.set(id, []);
    this.payloads.set(id, params.payload);
    return request;
  }

  public getRequest(requestId: UUID): ApprovalRequest | null {
    return this.requests.get(requestId) || null;
  }

  public getPayload(requestId: UUID): Record<string, unknown> | null {
    return this.payloads.get(requestId) || null;
  }

  public listPendingRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending');
  }

  /**
   * Submits a checker decision.
   * STRICT ENFORCEMENT: The checker CANNOT be the maker (original requester).
   */
  public submitDecision(
    requestId: UUID,
    checkerAdminId: UUID,
    decision: 'approved' | 'rejected',
    notes: string,
    ipAddress: string
  ): { request: ApprovalRequest; step: ApprovalStepRecord } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Approval request ${requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Approval request ${requestId} is already resolved (${request.status})`);
    }

    if (new Date(request.expires_at) < new Date()) {
      request.status = 'expired';
      throw new Error(`Approval request ${requestId} has expired`);
    }

    // Four-Eyes Invariant check: maker cannot be checker
    if (request.requester_id === checkerAdminId) {
      throw new Error(
        `Four-eyes invariant violation: The requester (Maker ${checkerAdminId}) cannot act as the Checker on their own request`
      );
    }

    const steps = this.steps.get(requestId) || [];

    // Ensure this admin has not already acted on this request
    if (steps.some((s) => s.adminUserId === checkerAdminId)) {
      throw new Error(`Admin ${checkerAdminId} has already reviewed request ${requestId}`);
    }

    const step: ApprovalStepRecord = {
      id: uuidv7(),
      approvalRequestId: requestId,
      adminUserId: checkerAdminId,
      decision,
      notes,
      ipAddress,
      createdAt: new Date().toISOString(),
    };

    steps.push(step);
    this.steps.set(requestId, steps);

    if (decision === 'rejected') {
      request.status = 'rejected';
    } else {
      // Since required_approvals = 2 and Maker counts as 1 (initiated), Checker completes step 2
      request.status = 'approved';
    }

    return { request, step };
  }
}
