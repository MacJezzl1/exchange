import crypto from 'crypto';
import { UUID, TimestampISO } from '@exchange/shared-types';

export interface SessionData {
  id: UUID;
  userId: UUID;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: TimestampISO;
  revokedAt?: TimestampISO;
  revocationReason?: string;
  createdAt: TimestampISO;
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionData>(); // tokenHash -> SessionData

  public generateSessionToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  public createSession(
    sessionId: UUID,
    userId: UUID,
    tokenHash: string,
    ipAddress: string,
    userAgent: string,
    ttlSeconds = 86400 // 24 hours
  ): SessionData {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const session: SessionData = {
      id: sessionId,
      userId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt: now.toISOString(),
    };

    this.sessions.set(tokenHash, session);
    return session;
  }

  public getSessionByRawToken(rawToken: string): SessionData | null {
    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session) return null;

    if (session.revokedAt) return null;

    if (new Date(session.expiresAt) <= new Date()) {
      return null;
    }

    return session;
  }

  public revokeSession(rawToken: string, reason = 'user_logout'): boolean {
    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session) return false;

    session.revokedAt = new Date().toISOString();
    session.revocationReason = reason;
    return true;
  }

  public revokeAllUserSessions(userId: UUID, reason = 'security_revocation'): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date().toISOString();
        session.revocationReason = reason;
        count++;
      }
    }
    return count;
  }
}
