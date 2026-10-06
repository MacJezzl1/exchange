import { v7 as uuidv7 } from 'uuid';
import { UUID, HexString, User } from '@exchange/shared-types';
import { SessionManager, SessionData } from './session';
import { WebAuthnHandler, StoredPasskeyCredential } from './webauthn';
import { SiweHandler } from './siwe';

export class IdentityService {
  private readonly users = new Map<UUID, User>();
  private readonly credentials = new Map<UUID, StoredPasskeyCredential[]>(); // userId -> credentials
  private readonly whitelistAddresses = new Map<UUID, { chainId: number; address: string; timelockExpiresAt: number }[]>();
  private readonly panicFrozenUsers = new Set<UUID>();

  public readonly sessionManager: SessionManager;
  public readonly webAuthn: WebAuthnHandler;
  public readonly siwe: SiweHandler;

  constructor() {
    this.sessionManager = new SessionManager();
    this.webAuthn = new WebAuthnHandler();
    this.siwe = new SiweHandler();
  }

  public createUserWithEmail(email: string): User {
    const user: User = {
      id: uuidv7(),
      email,
      wallet_address: null,
      status: 'active',
      kyc_level_id: '018e0000-0003-7000-8000-000000000000', // L0 Browse
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  public createUserWithWallet(walletAddress: HexString): User {
    const user: User = {
      id: uuidv7(),
      email: null,
      wallet_address: walletAddress.toLowerCase() as HexString,
      status: 'active',
      kyc_level_id: '018e0000-0003-7000-8000-000000000000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  public getUser(userId: UUID): User | null {
    return this.users.get(userId) || null;
  }

  public registerPasskey(
    userId: UUID,
    clientDataJSON: string,
    credentialId: string,
    publicKey: string,
    nickname: string
  ): StoredPasskeyCredential {
    const verified = this.webAuthn.verifyRegistration(userId, clientDataJSON, credentialId, publicKey);
    if (!verified) {
      throw new Error('WebAuthn registration verification failed');
    }

    const cred: StoredPasskeyCredential = {
      id: uuidv7(),
      userId,
      externalId: credentialId,
      publicKey,
      signCounter: 0,
      nickname,
      transports: ['internal'],
      createdAt: new Date().toISOString(),
    };

    const userCreds = this.credentials.get(userId) || [];
    userCreds.push(cred);
    this.credentials.set(userId, userCreds);

    return cred;
  }

  public authenticateWithPasskey(
    userId: UUID,
    clientDataJSON: string,
    credentialId: string,
    ipAddress: string,
    userAgent: string
  ): { user: User; session: SessionData; rawToken: string } {
    if (this.panicFrozenUsers.has(userId)) {
      throw new Error('Account is panic-frozen. Logins are prohibited until unfreeze.');
    }

    const user = this.getUser(userId);
    if (!user || user.status !== 'active') {
      throw new Error('User not found or not active');
    }

    const userCreds = this.credentials.get(userId) || [];
    const cred = userCreds.find((c) => c.externalId === credentialId);
    if (!cred) {
      throw new Error('Passkey credential not registered');
    }

    const ok = this.webAuthn.verifyAuthentication(userId, clientDataJSON, cred);
    if (!ok) {
      throw new Error('Passkey authentication challenge failed');
    }

    const { rawToken, tokenHash } = this.sessionManager.generateSessionToken();
    const session = this.sessionManager.createSession(uuidv7(), userId, tokenHash, ipAddress, userAgent);

    return { user, session, rawToken };
  }

  public panicFreezeAccount(userId: UUID, reason = 'user_panic_freeze'): boolean {
    const user = this.getUser(userId);
    if (!user) return false;

    this.panicFrozenUsers.add(userId);
    user.status = 'frozen';
    user.updated_at = new Date().toISOString();

    // Invalidate all active sessions immediately
    this.sessionManager.revokeAllUserSessions(userId, reason);
    return true;
  }

  public isAccountFrozen(userId: UUID): boolean {
    return this.panicFrozenUsers.has(userId);
  }

  public addWhitelistAddress(
    userId: UUID,
    chainId: number,
    address: string,
    timelockHours = 24
  ): { chainId: number; address: string; timelockExpiresAt: number; isActive: boolean } {
    const timelockExpiresAt = Date.now() + timelockHours * 3600 * 1000;
    const entry = { chainId, address: address.toLowerCase(), timelockExpiresAt };

    const list = this.whitelistAddresses.get(userId) || [];
    list.push(entry);
    this.whitelistAddresses.set(userId, list);

    return {
      chainId,
      address,
      timelockExpiresAt,
      isActive: false, // Inactive until timelock expires
    };
  }

  public isAddressWhitelisted(userId: UUID, chainId: number, address: string): boolean {
    const list = this.whitelistAddresses.get(userId) || [];
    const target = address.toLowerCase();
    const entry = list.find((e) => e.chainId === chainId && e.address === target);
    if (!entry) return false;

    return Date.now() >= entry.timelockExpiresAt;
  }
}
