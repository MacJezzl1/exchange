const fs = require('fs');
const path = require('path');

const features = [
  {
    slug: 'proof-of-reserves',
    title: '1. Verifiable Proof of Reserves and Solvency',
    summary: 'Merkle-tree liabilities snapshots published on a schedule; users can verify their own balance is included from a public page. Prepare design for ZK-based solvency proofs.'
  },
  {
    slug: 'mev-resistant-execution',
    title: '2. MEV-Resistant Execution (Frequent Batch Auctions)',
    summary: 'Orders batched into short frequent batch auctions (100-500 ms window) with uniform clearing prices, plus commit-reveal for large orders. Eliminates operator front-running by design.'
  },
  {
    slug: 'gasless-account-abstraction',
    title: '3. Gasless Trading with Account Abstraction (ERC-4337)',
    summary: 'ERC-4337 smart accounts, paymaster sponsored gas for trading, and scoped session keys with expiry and trading limits.'
  },
  {
    slug: 'passkey-first-login',
    title: '4. Passkey-First Login (WebAuthn / FIDO2 & SIWE)',
    summary: 'WebAuthn passkeys as primary frictionless login with SIWE as an option. Zero single-factor passwords for withdrawals.'
  },
  {
    slug: 'withdrawal-safety-layer',
    title: '5. Withdrawal Safety Layer & Panic Freeze',
    summary: 'Address whitelisting with mandatory time-lock delays, risk-scored withdrawals, user-configurable daily limits, and instant one-click panic freeze button.'
  },
  {
    slug: 'unified-cross-chain-balance',
    title: '6. Unified Cross-Chain Balance View',
    summary: 'Single deposit address per chain with clear status tracking (pending, confirming, credited). Modular chain adapter interface.'
  },
  {
    slug: 'african-rails',
    title: '7. African Rails & Local Payment Providers',
    summary: 'Pluggable payment-provider interface (Instant EFT via Stitch/Ozow, Mobile Money via M-Pesa, bank transfer). Maker-checker admin approvals for high-value payouts.'
  },
  {
    slug: 'advanced-order-types',
    title: '8. Advanced Order Types & Lifecycle',
    summary: 'Limit, market, stop, stop-limit, post-only, IOC, FOK, OCO, TWAP, and iceberg orders. Validated server-side, 100% replayable from the event log.'
  },
  {
    slug: 'verified-trader-track-records',
    title: '9. Verified Trader Track Records',
    summary: 'Opt-in performance analytics computed exclusively from settled on-chain and matching engine trades, preventing fake or manipulated track records.'
  },
  {
    slug: 'tax-and-accounting-exports',
    title: '10. Built-in Tax and Accounting Exports',
    summary: 'Cost-basis computation engines (FIFO, LIFO, HIFO) with CSV/PDF exports and South African Revenue Service (SARS) compliant format first.'
  },
  {
    slug: 'public-transparency-status',
    title: '11. Public Transparency and Status Page',
    summary: 'Real-time metrics: matching engine latency, settlement lag, insurance fund balance, circuit-breaker history, and incident disclosure.'
  },
  {
    slug: 'automated-market-protection',
    title: '12. Automated Market Protection & Circuit Breakers',
    summary: 'Dynamic price bands, self-trade prevention (STP), per-market and global emergency kill switches, insurance fund accounting.'
  },
  {
    slug: 'institutional-grade-api',
    title: '13. Institutional-Grade API & Sandbox',
    summary: 'High-throughput REST and WebSocket feeds, scoped API keys, IP allowlists, granular rate limits, and full sandbox simulation environment.'
  },
  {
    slug: 'cryptographic-audit-trail',
    title: '14. Cryptographic Audit Trail',
    summary: 'Append-only SHA-256 hash-chained log for all admin and system operations, with periodic on-chain timestamp anchoring.'
  }
];

const targetDir = path.join(__dirname, '../docs/features');
features.forEach(f => {
  const content = `# Feature Design: ${f.title}

## 1. Summary
${f.summary}

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
`;
  fs.writeFileSync(path.join(targetDir, `${f.slug}.md`), content);
});

console.log('14 Feature design docs written to docs/features/');
