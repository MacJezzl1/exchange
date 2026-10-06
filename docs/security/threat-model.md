# Comprehensive STRIDE Threat Model

**Document Version**: 1.0.0 (Phase 0 Foundation)  
**Status**: DRAFT / PRE-AUDIT (Not Yet Audited)  
**Target Architecture**: Hybrid Exchange Platform  

---

## 1. Scope & Security Architecture Boundary

The Hybrid Exchange Platform operates on a defense-in-depth model with a sharp division between:
1. **The Non-Custodial Core**: On-chain vault contracts on Base L2, where users maintain sovereign custody of deposited assets.
2. **The High-Performance Matching Tier**: Deterministic off-chain order execution driven by EIP-712 cryptographic order intents.
3. **The Isolated Admin Subsystem**: Completely separate domain, dedicated database user role, mandatory hardware-key (WebAuthn) MFA, and maker-checker approval gates.
4. **The Custodial Fiat Gateway**: Regional payment rails isolated behind compliance and AML checks.

```
+-----------------------------------------------------------------------------------------+
|                                      EXTERNAL TIER                                      |
|  [Trader Client] (EIP-712 / Passkey)        [Admin Client] (WebAuthn Hard Token Only)   |
+------------------------------------+------------------------------------+---------------+
                                     |                                    |
+------------------------------------v------------------------------------v---------------+
|                                      EDGE GATEWAY                                       |
|  api-gateway (CORS, CSP, Rate Limits, WAF)   admin-api (IP Allowlist, VPN, Hardware Auth)|
+------------------------------------+------------------------------------+---------------+
                                     |                                    |
+------------------------------------v------------------------------------v---------------+
|                                  CORE SERVICES (INTERNAL VPC)                           |
|  identity | trading | risk | ledger | settlement | custody-fiat | compliance | kyc      |
+------------------------------------+------------------------------------+---------------+
                                     |
+------------------------------------v------------------------------------+---------------+
|                          DETERMINISTIC EXECUTION & STORAGE                              |
|  matching-engine (Rust Core) | NATS JetStream | PostgreSQL 16 (Schema-Isolated)        |
+------------------------------------+------------------------------------+---------------+
                                     |
+------------------------------------v------------------------------------+---------------+
|                                ON-CHAIN SETTLEMENT TIER                                 |
|  Vault.sol | Settlement.sol | AccountFactory.sol (Base L2 EVM)                          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. STRIDE Threat Analysis by Component

### 2.1 API Gateway & Trader Edge

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Adversary attempts to forge user sessions or spoof authentication tokens. | High | WebAuthn passkeys as primary authentication; short-lived cryptographically signed session tokens; device fingerprint verification; SIWE (EIP-4361) signature verification for wallet logins. |
| **Tampering** | Man-in-the-middle tampering of order requests or balance queries. | Critical | Strict TLS 1.3 enforced; EIP-712 signed typed structured data for every trade; schema validation with Zod on ingestion. |
| **Repudiation** | User places an order and subsequently denies having submitted it. | High | Every order carries a non-malleable EIP-712 cryptographic signature bound to `chainId`, `verifyingContract`, `market`, `price`, `quantity`, and monotonically increasing `nonce`. |
| **Information Disclosure** | Leakage of order book depth, user positions, or API keys in transit/logs. | High | Strict structured JSON logging with automatic PII and authorization credential redaction; strict CORS and CSP headers; `httpOnly`, `secure`, `sameSite=strict` cookies. |
| **Denial of Service** | DDoS attack flooding order ingestion endpoints to degrade matching latency. | High | Distributed Redis token-bucket rate limiting per IP and per API key; Cloudflare/WAF edge filtering; connection pooling and payload size limits. |
| **Elevation of Privilege** | Trader client attempts to access administrative endpoints or other users' accounts. | Critical | Strict separation of network boundaries (`api-gateway` cannot route to `admin-api`); authorization middlewares enforcing user UUID ownership on all requests. |

---

### 2.2 Matching Engine & Event Bus (Rust Core & NATS JetStream)

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Unauthorized service injecting synthetic trades or false order cancellations into NATS. | Critical | NATS JetStream requires mutual TLS (mTLS) and token authentication per service account; subject authorization rules limit who can publish to `order.commands.>`. |
| **Tampering** | In-flight modification of trade prices, order quantities, or execution sequence. | Critical | Fixed-point arithmetic (`u128`) guarantees zero IEEE-754 precision loss or drift; deterministic replay verifies log hash consistency; sequential sequence numbering enforced. |
| **Repudiation** | Engine operator claims a trade occurred at a different timestamp or clearing price. | High | Every engine event (`OrderAccepted`, `TradeExecuted`, `OrderCancelled`) carries an immutable sequence number and timestamp; audit hash chain continuously captures engine snapshots. |
| **Information Disclosure** | Order flow front-running or MEV extraction by internal staff or malicious operator. | Critical | Frequent batch auctions (FBA) with 100-500ms auction windows and uniform clearing prices; commit-reveal schemes for orders above size thresholds; zero order pre-sorting by gas fee. |
| **Denial of Service** | Crafted order payload causes panic, stack overflow, or memory exhaustion in matching engine. | High | Memory pre-allocation for order books; bounded order queues; strict input sanitization; no unbounded dynamic allocations during execution hot path; engine runs under systemd watchdog with automated snapshot recovery. |
| **Elevation of Privilege** | Memory corruption or exploit in the Rust core yielding host system access. | Critical | 100% `#![forbid(unsafe_code)]` in matching engine core; Rust memory safety guarantees; sandboxed non-root container deployment. |

---

### 2.3 Double-Entry Ledger & PostgreSQL Database

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Compromised microservice connects to the database pretending to be the ledger service. | Critical | Dedicated PostgreSQL roles per microservice with password/cert authentication; network firewalls restricting DB port 5432 to internal service subnets. |
| **Tampering** | Malicious insider or SQL injection modifies user account balances directly. | Critical | PostgreSQL constraint trigger strictly enforces `sum(debit) == sum(credit)` on every transaction; `UPDATE` and `DELETE` on financial ledger tables are rejected via unconditional database triggers; parameterized queries only. |
| **Repudiation** | Platform claims a user withdrew funds without proof. | High | Balances change solely via balanced `journal_line` records referencing a valid `journal_entry` with verifiable cryptographic on-chain or payment provider proof. |
| **Information Disclosure** | Database dump exposes trader net worth, PII, and trade history. | High | Encrypted storage at rest (AES-256); field-level encryption for KYC PII (using Cloud KMS-wrapped DEKs); schema-level privilege restrictions. |
| **Denial of Service** | Long-running queries or connection starvation freezing balance checks. | High | Strict database connection pools with timeouts; index optimization on all foreign keys; separate read-replicas for analytical queries and admin views. |
| **Elevation of Privilege** | Service attempts to read or modify tables belonging to another domain. | Critical | Schema-per-domain architecture (`identity`, `ledger`, `trading`, etc.); services are granted access only to their respective schemas. |

---

### 2.4 Smart Contracts (Vault.sol & Settlement.sol on Base L2)

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Malicious actor submits forged settlement batch purporting to be the operator. | Critical | `Settlement.sol` verifies cryptographic ECDSA signature from the registered operator address; operator private key stored in Cloud KMS / HSM. |
| **Tampering** | Exploiting reentrancy or integer overflow in `Vault.sol` during deposit or withdrawal. | Critical | Solidity 0.8.26 built-in overflow checks; OpenZeppelin `ReentrancyGuardUpgradeable`; checks-effects-interactions pattern; invariant test suites. |
| **Repudiation** | Operator falsely claims settlement batch was executed on-chain. | High | On-chain events (`BatchSettled`) emit Merkle root of net balance changes, queryable and verifiable by any node. |
| **Information Disclosure** | Front-running of pending batch settlements in the mempool. | Medium | Base L2 uses a centralized sequencer with private mempool; contracts enforce strict sequence nonces so batches cannot be inserted out of order. |
| **Denial of Service** | Operator key goes offline or refuses to settle, trapping user funds indefinitely. | Critical | **Emergency Escape Hatch**: If no valid settlement occurs within `ESCAPE_HATCH_PERIOD` (e.g. 7 days), users can call `initiateEmergencyWithdrawal()` directly on `Vault.sol` using their last settled balance. |
| **Elevation of Privilege** | Unauthorized upgrade of contract implementation via proxy. | Critical | Timelock governance controller (minimum 48-hour delay) controlled by multi-signature wallet (e.g. Safe 3-of-5). |

---

### 2.5 Admin System & Four-Eyes Approval Workflow

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker compromises an admin password and signs in. | Critical | **Zero Password Auth**: Admins must authenticate via physical FIDO2/WebAuthn hardware keys (YubiKey). No SMS or email OTP allowed. |
| **Tampering** | Rogue admin attempts to approve an unauthorized large fiat payout or unfreeze their own account. | Critical | **Four-Eyes Principle (Maker-Checker)**: Sensitive operations (`fiat_withdrawal`, `hot_wallet_change`, `market_halt`, `fee_change`) require two distinct admin approvals from different roles; enforced by database constraints in `admin.approval_request`. |
| **Repudiation** | Admin denies performing a destructive action (e.g. halting a market). | Critical | Every admin HTTP request writes to `audit.audit_event` with actor ID, IP, user-agent, reason, and before/after JSON diffs; each row is cryptographically hash-chained (`hash = SHA256(prev_hash + row_data)`). |
| **Information Disclosure** | Customer support agent harvests user PII or unmasked account balances. | High | Strict field masking in the admin UI; unmasking actions are explicitly logged as audit events with mandatory justification input. |
| **Denial of Service** | Admin portal flooded from external internet. | High | Admin domain is completely isolated (`admin.<domain>`), unlinked from trader app, accessible only via corporate VPN / IP allowlist, protected by WAF. |
| **Elevation of Privilege** | Support admin escalates themselves to SuperAdmin. | Critical | Role assignment is itself a four-eyes protected operation requiring SuperAdmin dual sign-off. |

---

## 3. Cryptographic Key Management & HSM / KMS Architecture

1. **Settlement Operator Signing Key**:
   - Resides in AWS KMS / GCP Cloud KMS with HSM backing (FIPS 140-2 Level 3).
   - Never exported into application memory or disk.
   - Distinct key from contract upgrade or guardian keys.
2. **Guardian Key**:
   - Dedicated key with authority **only** to trigger emergency pause on `Vault.sol` in the event of an detected exploit.
   - Cannot move funds or initiate withdrawals.
3. **Governance Multi-Sig**:
   - Gnosis Safe multi-signature wallet held by key engineering and legal officers across distinct geographical regions.
   - Enforces a 48-hour Timelock for any contract proxy upgrade or fee parameter modification.
4. **Data-at-Rest Encryption Keys (Envelope Encryption)**:
   - KYC documents and PII encrypted with AES-256-GCM data encryption keys (DEKs), wrapped by a KMS Key Encryption Key (KEK).

---

## 4. Audit-Readiness Checklist

- [ ] Static analysis configured and passing in CI (`slither` for Solidity, `cargo clippy -D warnings` for Rust, strict `tsc` for TypeScript).
- [ ] 100% line coverage and invariant tests for all smart contracts in Foundry.
- [ ] Deterministic replay test harness passing for matching engine (identical event inputs -> identical state output).
- [ ] Invariant tests verifying double-entry ledger always balances and holds never exceed available balance.
- [ ] Full STRIDE review conducted and signed off by lead security engineer.
- [ ] Incident response runbooks established in `docs/security/runbooks/` for key compromise, hot-wallet drain, and matching desync.
- [ ] Bug bounty scope and disclosure policy defined.
- [ ] External third-party smart contract and architecture audit scheduled prior to mainnet deployment.
