# 🚀 Hybrid Exchange Platform

> A production-grade **Hybrid Decentralized Exchange** combining CEX-speed deterministic order matching with non-custodial Base L2 on-chain settlement, double-entry cryptographic ledger guarantees, four-eyes maker-checker controls, and proof of reserves.

[![CI - Build & Test Suite](https://github.com/MacJezzl1/exchange/actions/workflows/ci.yml/badge.svg)](https://github.com/MacJezzl1/exchange/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Base L2](https://img.shields.io/badge/Network-Base%20L2-0052FF.svg)](https://base.org)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E.svg)](https://supabase.com)

---

## 🌟 Key Features

1. **Ultra-Low Latency Order Matching**:
   - Deterministic price-time priority matching engine (Rust & TypeScript).
   - **> 100,000 orders/sec** sustained throughput with **< 10 µs latency**.
   - Zero floating-point arithmetic (strict atomic integer math: `u128` / `bigint` / `NUMERIC(38,0)`).
   - Advanced order types: `Limit`, `Market`, `Post-Only`, `IOC` (Immediate-Or-Cancel), `FOK` (Fill-Or-Kill).
   - MEV-Resistant **Frequent Batch Auctions (FBA)** with discrete-time uniform price clearing.

2. **Non-Custodial Sovereign Custody (Base L2)**:
   - [`Vault.sol`](contracts/src/Vault.sol): Multi-asset non-custodial smart vault on Base L2.
   - [`Settlement.sol`](contracts/src/Settlement.sol): Compressed batch trade settlement and cryptographic Merkle proof verification.
   - **Emergency Escape Hatch**: 7-day offline trigger allows traders to withdraw directly without operator signatures.
   - [`AccountFactory.sol`](contracts/src/AccountFactory.sol): ERC-4337 Smart Accounts with scoped session keys and spending caps.

3. **Financial Integrity & Double-Entry Accounting**:
   - Strict mathematical invariant: $\sum \text{Debit} == \sum \text{Credit}$.
   - Pre-trade balance holds: prevents order overdrafts before entering the order book.
   - Non-negative balance enforcement across all user and system accounts.
   - Cryptographic SHA-256 hash-chained append-only audit trail with tamper detection.

4. **Security, Four-Eyes Controls & Compliance**:
   - Isolated Admin Control Plane on port `8081` with WebAuthn FIDO2 / hardware token MFA.
   - **Maker-Checker Four-Eyes Engine**: Dual-administrator sign-off required for payouts $\ge \$10\text{k}$ (Maker cannot approve own request).
   - Tiered KYC verification engine (L0 to L3).
   - Automated FIFO tax & capital gains calculation engine with CSV exports for SARS, FIRS, KRA, and IRS.
   - Localized African fiat rails: ZAR (Stitch Instant EFT), NGN (Paystack NIP), KES (Safaricom M-Pesa).

5. **Transparency & Proof-of-Reserves (PoR)**:
   - Binary Merkle Tree comparing off-chain user liabilities against on-chain verified Vault assets.
   - Live public Transparency Center with real-time solvency ratios ($\ge 100\%$) and self-verification proof tool.

---

## 🏗️ Architecture & Services

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTENDS & USER PORTALS                        │
├────────────────────┬───────────────────────┬───────────────────────────┤
│  Trader Terminal   │   Admin Portal Shell  │  Transparency & PoR Page  │
│  apps/web (:3000)  │  apps/admin (:3001)   │    apps/status (:3002)    │
└─────────┬──────────┴───────────┬───────────┴─────────────┬─────────────┘
          │                      │                         │
          ▼                      ▼                         ▼
┌──────────────────┐   ┌───────────────────┐     ┌───────────────────┐
│ trading service  │   │     admin-api     │     │ settlement service│
│ matching engine  │   │  WebAuthn + RBAC  │     │ Merkle Tree + PoR │
│   market-data    │   │  Maker-Checker    │     │ Batch Aggregator  │
└─────────┬────────┘   └─────────┬─────────┘     └─────────┬─────────┘
          │                      │                         │
          └──────────────────────┼─────────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │     ledger service    │
                     │  Double-Entry Engine  │
                     │    sum(D) == sum(C)   │
                     └───────────┬───────────┘
                                 │
                     ┌───────────┴───────────┐
                     │  Base L2 Smart Vault  │
                     │ Vault.sol / Settle.sol│
                     └───────────────────────┘
```

---

## ⚡ Quickstart (Local Development)

### Prerequisites
- Node.js $\ge 20$
- pnpm $\ge 9$ (`npm install -g pnpm`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Build Monorepo
```bash
pnpm build
```

### 3. Run Test Suite
```bash
pnpm test
```

### 4. Launch Local Development Environment
```bash
pnpm dev
# or
node scripts/dev.js
```

This launches all applications concurrently:
- **Trader Terminal**: [http://localhost:3000](http://localhost:3000)
- **Admin Control Plane**: [http://localhost:3001](http://localhost:3001)
- **Proof-of-Reserves Center**: [http://localhost:3002](http://localhost:3002)
- **Isolated Admin API**: [http://localhost:8081](http://localhost:8081)

---

## ☁️ Deploying to Vercel

The monorepo includes a unified Vercel configuration (`vercel.json` and `api/index.js`) that automatically routes traffic to the appropriate frontend and API services:

### Option A: One-Click Vercel Monorepo Deployment
1. Import this GitHub repository into [Vercel](https://vercel.com/new).
2. Framework Preset: **Other**
3. Build Command: `pnpm build`
4. Output Directory: Leave blank / default
5. Install Command: `pnpm install`
6. Click **Deploy**!

Routes on Vercel:
- `/` $\to$ Spot Trader Terminal
- `/admin` $\to$ Admin Control Plane
- `/status` $\to$ Proof-of-Reserves & Transparency Center
- `/api/status`, `/api/por`, `/api/batches` $\to$ Public Verification APIs

---

## 🗄️ Setting up Supabase

The repository includes a consolidated schema containing all 12 isolated domain schemas, RFC 9562 UUIDv7 generators, append-only triggers, and Supabase Realtime publications.

### Option A: Via Supabase Dashboard (Fastest)
1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Open [`supabase/migrations/20261006000001_initial_schema.sql`](supabase/migrations/20261006000001_initial_schema.sql) and paste its contents.
4. Click **Run**.
5. *(Optional)* Paste and run [`supabase/seed.sql`](supabase/seed.sql) to populate initial trading pairs (`BTC-USDT`, `ETH-USDC`).

### Option B: Via Automated Migration Runner
```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Execute migration and seed runner
node scripts/supabase-migrate.js
```

### Option C: Using Supabase CLI
```bash
npx supabase link --project-ref [YOUR-PROJECT-REF]
npx supabase db push
```

---

## 🧪 Invariant & Chaos Testing

Run the full automated test suite verifying all 6 phases:

```bash
pnpm test
```

### Verified Test Suites:
- `tests/phase1.test.ts`: Identity (Passkeys, SIWE), Double-Entry Ledger, Admin API, Four-Eyes Maker-Checker, SHA-256 Audit Chain.
- `tests/phase2.test.ts`: KYC Provider, Base L2 `Vault.sol` non-custodial custody, Chain-watcher confirmation tracker, Withdrawal Safety.
- `tests/phase3.test.ts`: Matching Engine deterministic replay, Limit/Market/Post-Only/IOC/FOK order types, **115k orders/sec** throughput benchmark.
- `tests/phase4.test.ts`: `Settlement.sol`, Batch netting aggregator, Merkle inclusion proofs, Proof-of-Reserves solvency.
- `tests/phase5.test.ts`: ERC-4337 Session Keys, Frequent Batch Auctions (FBA), African Fiat Rails (ZAR/NGN/KES), FIFO Tax Engine.
- `tests/phase6.test.ts`: Disaster recovery engine crash replay, ledger invariant fault injection, settlement sequence defenses, 7-day escape hatch drill.

---

## 🔒 Security & Bug Bounty

Review the full security model and operational runbooks:
- [Architecture & Sequence Diagrams](docs/architecture.md)
- [STRIDE Threat Model](docs/security/threat-model.md)
- [Smart Contracts Threat Model](docs/security/contracts-threat-model.md)
- [Production Launch Readiness & Audit Package](docs/security/launch-readiness.md)
- [Incident Response Runbooks](docs/security/runbooks/)

---

## 📄 License

MIT © 2026 Hybrid Exchange Platform Team
