import crypto from 'crypto';
import { UUID, TimestampISO } from '@exchange/shared-types';

export interface StoredPasskeyCredential {
  id: UUID;
  userId: UUID;
  externalId: string; // Base64URL credential ID
  publicKey: string;
  signCounter: number;
  nickname: string;
  transports: string[];
  createdAt: TimestampISO;
  lastUsedAt?: TimestampISO;
}

export class WebAuthnHandler {
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly challenges = new Map<string, { challenge: string; expiresAt: number }>();

  constructor(rpId = 'localhost', rpName = 'Hybrid Exchange Platform') {
    this.rpId = rpId;
    this.rpName = rpName;
  }

  public generateRegistrationChallenge(userId: UUID): {
    challenge: string;
    rp: { id: string; name: string };
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: { alg: number; type: 'public-key' }[];
  } {
    const challenge = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 300000; // 5 min TTL
    this.challenges.set(userId, { challenge, expiresAt });

    return {
      challenge,
      rp: { id: this.rpId, name: this.rpName },
      user: {
        id: Buffer.from(userId).toString('base64url'),
        name: `user-${userId.slice(0, 8)}`,
        displayName: `Trader ${userId.slice(0, 8)}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
    };
  }

  public generateAuthenticationChallenge(userId: UUID): {
    challenge: string;
    rpId: string;
  } {
    const challenge = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 300000;
    this.challenges.set(userId, { challenge, expiresAt });

    return {
      challenge,
      rpId: this.rpId,
    };
  }

  public verifyRegistration(
    userId: UUID,
    clientDataJSON: string,
    credentialId: string,
    publicKey: string
  ): boolean {
    const record = this.challenges.get(userId);
    if (!record || record.expiresAt < Date.now()) {
      return false;
    }

    try {
      const parsedClientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'));
      if (parsedClientData.type !== 'webauthn.create') {
        return false;
      }
      if (parsedClientData.challenge !== record.challenge) {
        return false;
      }

      this.challenges.delete(userId);
      return Boolean(credentialId && publicKey);
    } catch {
      return false;
    }
  }

  public verifyAuthentication(
    userId: UUID,
    clientDataJSON: string,
    credential: StoredPasskeyCredential
  ): boolean {
    const record = this.challenges.get(userId);
    if (!record || record.expiresAt < Date.now()) {
      return false;
    }

    try {
      const parsedClientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'));
      if (parsedClientData.type !== 'webauthn.get') {
        return false;
      }
      if (parsedClientData.challenge !== record.challenge) {
        return false;
      }

      this.challenges.delete(userId);
      credential.signCounter++;
      credential.lastUsedAt = new Date().toISOString();
      return true;
    } catch {
      return false;
    }
  }
}
