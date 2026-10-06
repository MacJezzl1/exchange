import crypto from 'crypto';
import { HexString } from '@exchange/shared-types';

export interface ParsedSiweMessage {
  domain: string;
  address: HexString;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export class SiweHandler {
  private readonly nonces = new Map<string, number>(); // nonce -> expiry timestamp

  public generateNonce(): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    this.nonces.set(nonce, Date.now() + 300000); // 5 min TTL
    return nonce;
  }

  public parseMessage(message: string): ParsedSiweMessage | null {
    try {
      // EIP-4361 standard format matching
      const domainMatch = message.match(/^([a-zA-Z0-9.-]+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/);
      if (!domainMatch) return null;

      const domain = domainMatch[1]!;
      const address = domainMatch[2]!.toLowerCase() as HexString;

      const uriMatch = message.match(/URI: (.+)/);
      const versionMatch = message.match(/Version: (.+)/);
      const chainIdMatch = message.match(/Chain ID: (\d+)/);
      const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
      const issuedAtMatch = message.match(/Issued At: (.+)/);

      if (!uriMatch || !versionMatch || !chainIdMatch || !nonceMatch || !issuedAtMatch) {
        return null;
      }

      return {
        domain,
        address,
        uri: uriMatch[1]!,
        version: versionMatch[1]!,
        chainId: parseInt(chainIdMatch[1]!, 10),
        nonce: nonceMatch[1]!,
        issuedAt: issuedAtMatch[1]!,
      };
    } catch {
      return null;
    }
  }

  public verifySignature(
    message: string,
    signature: HexString,
    expectedDomain = 'localhost'
  ): { isValid: boolean; address?: HexString; reason?: string } {
    const parsed = this.parseMessage(message);
    if (!parsed) {
      return { isValid: false, reason: 'invalid_siwe_format' };
    }

    if (parsed.domain !== expectedDomain) {
      return { isValid: false, reason: 'domain_mismatch' };
    }

    const expiry = this.nonces.get(parsed.nonce);
    if (!expiry || expiry < Date.now()) {
      return { isValid: false, reason: 'nonce_expired_or_invalid' };
    }

    this.nonces.delete(parsed.nonce);

    // Verify signature format (0x + 130 hex characters = 65 bytes r,s,v)
    if (!signature.startsWith('0x') || signature.length !== 132) {
      return { isValid: false, reason: 'invalid_signature_length' };
    }

    return { isValid: true, address: parsed.address };
  }
}
