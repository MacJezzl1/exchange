import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { AuditEvent } from '@exchange/shared-types';
import { LogAuditParams } from './types';

export class AuditLogChain {
  private readonly events: AuditEvent[] = [];
  private readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  public appendEvent(params: LogAuditParams): AuditEvent {
    const id = uuidv7();
    const sequenceNumber = this.events.length + 1;
    const createdAt = new Date().toISOString();

    const prevHash =
      this.events.length === 0
        ? this.GENESIS_HASH
        : this.events[this.events.length - 1]!.hash;

    const payloadToHash = `${prevHash}${id}${params.actorId}${params.actorType}${params.action}${params.entityType}${params.entityId}${params.ipAddress}${params.reason || ''}${JSON.stringify(params.details || {})}${createdAt}`;

    const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const event: AuditEvent = {
      id,
      sequence_number: sequenceNumber,
      prev_hash: prevHash,
      hash,
      actor_id: params.actorId,
      actor_type: params.actorType,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      reason: params.reason || '',
      details: params.details || {},
      created_at: createdAt,
    };

    this.events.push(event);
    return event;
  }

  public getEvents(limit = 100): AuditEvent[] {
    return [...this.events].slice(-limit).reverse();
  }

  public getLatestHash(): string {
    if (this.events.length === 0) return this.GENESIS_HASH;
    return this.events[this.events.length - 1]!.hash;
  }

  /**
   * Cryptographically verifies the integrity of the audit chain from end to end.
   */
  public verifyChain(): {
    isValid: boolean;
    totalEvents: number;
    brokenAtSequence?: number;
    reason?: string;
  } {
    let expectedPrevHash = this.GENESIS_HASH;

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i]!;

      // 1. Verify sequence order
      if (event.sequence_number !== i + 1) {
        return {
          isValid: false,
          totalEvents: this.events.length,
          brokenAtSequence: event.sequence_number,
          reason: `Sequence gap detected: expected ${i + 1}, found ${event.sequence_number}`,
        };
      }

      // 2. Verify prev_hash link
      if (event.prev_hash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEvents: this.events.length,
          brokenAtSequence: event.sequence_number,
          reason: `Invalid prev_hash at sequence ${event.sequence_number}`,
        };
      }

      // 3. Recompute SHA-256 hash
      const payloadToHash = `${event.prev_hash}${event.id}${event.actor_id}${event.actor_type}${event.action}${event.entity_type}${event.entity_id}${event.ip_address}${event.reason || ''}${JSON.stringify(event.details || {})}${event.created_at}`;
      const recomputedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

      if (event.hash !== recomputedHash) {
        return {
          isValid: false,
          totalEvents: this.events.length,
          brokenAtSequence: event.sequence_number,
          reason: `Hash mismatch at sequence ${event.sequence_number}: recomputed ${recomputedHash} != stored ${event.hash}`,
        };
      }

      expectedPrevHash = event.hash;
    }

    return {
      isValid: true,
      totalEvents: this.events.length,
    };
  }
}
