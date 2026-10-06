import { UUID, HexString } from '@exchange/shared-types';

export interface RegisterPasskeyParams {
  userId: UUID;
  credentialId: string;
  publicKey: string;
  nickname: string;
  transports?: string[];
}

export interface VerifyPasskeyAuthParams {
  userId: UUID;
  credentialId: string;
  signature: string;
  clientDataJSON: string;
  authenticatorData: string;
}

export interface SiweAuthParams {
  message: string;
  signature: HexString;
  expectedNonce: string;
}

export interface CreateSessionParams {
  userId: UUID;
  ipAddress: string;
  userAgent: string;
  deviceId?: UUID;
  ttlSeconds?: number;
}

export interface SessionVerificationResult {
  isValid: boolean;
  userId?: UUID;
  sessionTokenHash?: string;
  reason?: string;
}
