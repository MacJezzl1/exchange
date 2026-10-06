# Hybrid Exchange Platform Architecture Specification

## 1. System Overview & Principles

The Platform is a production-grade **hybrid spot exchange** delivering centralized exchange (CEX) speed with decentralized, non-custodial on-chain asset custody.

### Core Non-Negotiable Invariants
1. **Funds Safety Above Everything**: Users self-custody assets in on-chain vault contracts (`Vault.sol`). The Platform can never move user funds without a cryptographic user signature (EIP-712 order or direct vault instruction).
2. **Deterministic Matching Core**: Off-chain matching engine implemented in Rust operates single-threaded per market, processing orders sequentially with fixed-point integer math (zero floating-point arithmetic) and event sourcing.
3. **Full Auditability & Double-Entry Invariant**: Every monetary balance update is backed by a balanced double-entry journal entry (`sum(debit) == sum(credit)`). Every system and admin action is committed to an append-only, SHA-256 hash-chained audit log anchored periodically on-chain.
4. **Isolated Admin System**: The admin application (`apps/admin`) and backend (`services/admin-api`) run on a separate domain, distinct database credentials, mandatory hardware-key (WebAuthn) MFA, and four-eyes (maker-checker) approval workflows.
5. **Separable Fiat Rails**: Local fiat currency rails (ZAR/NGN/KES/GHS) are completely isolated behind a compliance gateway and enabled on a strict per-jurisdiction licensing basis.

---

## 2. High-Level Component Diagram

```mermaid
flowchart TB
    subgraph Clients["Client Tier"]
        TraderWeb["Trader Web App (Next.js 14)<br/>EIP-712 Signing / Passkeys"]
        AdminWeb["Admin App (Next.js 14)<br/>Isolated Domain & WebAuthn"]
        StatusWeb["Public Transparency & Status Page"]
        APIClient["Institutional API Client<br/>(REST & WebSockets)"]
    end

    subgraph Edge["Edge & Security Gateway"]
        APIGW["api-gateway<br/>Rate Limiting, WAF, JWT/API Key Auth"]
        AdminAPI["admin-api<br/>VPN/Allowlist, WebAuthn MFA, RBAC"]
    end

    subgraph CoreServices["Domain Microservices Tier"]
        Identity["identity<br/>Passkeys, SIWE, Sessions"]
        Trading["trading<br/>Order Intake & Lifecycle"]
        Risk["risk<br/>Pre-trade & Withdrawal Limits"]
        Ledger["ledger<br/>Double-Entry Journal & Holds"]
        MarketData["market-data<br/>Depth, Candles, WebSocket Pub/Sub"]
        KYC["kyc<br/>Tier Validation & Documents"]
        Compliance["compliance<br/>Sanctions, AML, Travel Rule"]
        CustodyFiat["custody-fiat<br/>Fiat Rails & Payment Providers"]
        Notifications["notifications<br/>Email, SMS, Webhooks"]
    end

    subgraph MatchingTier["Deterministic Execution Engine"]
        NATS["NATS JetStream Event Bus"]
        ME["matching-engine (Rust)<br/>Single-threaded In-Memory Order Book<br/>Snapshot & Replay Engine"]
    end

    subgraph SettlementTier["On-Chain Settlement & Indexing"]
        SettlementSvc["settlement<br/>Batching, Merkle Trees, Proof Builder"]
        ChainWatcher["chain-watcher<br/>L2 Event Indexer & Confirmation Tracker"]
    end

    subgraph Blockchain["Base L2 (EVM) Contracts"]
        Vault["Vault.sol<br/>User Deposits & Escrow"]
        SettlementContract["Settlement.sol<br/>Batch Verifier & State Transition"]
        AccountFactory["AccountFactory.sol<br/>ERC-4337 Smart Accounts"]
    end

    subgraph Storage["Persistence & Caching"]
        PG[(PostgreSQL 16<br/>Schema-Per-Domain System of Record)]
        Redis[(Redis 7<br/>Rate Limits, Locks, Cache)]
        AuditDB[(audit schema<br/>Hash-Chained Append-Only Log)]
    end

    %% Edge Connections
    TraderWeb --> APIGW
    APIClient --> APIGW
    StatusWeb --> APIGW
    AdminWeb --> AdminAPI

    APIGW --> Identity
    APIGW --> Trading
    APIGW --> MarketData
    APIGW --> CustodyFiat

    AdminAPI --> AdminWeb
    AdminAPI --> AuditDB

    %% Trading Flow
    Trading --> Risk
    Trading --> Ledger
    Trading --> NATS
    NATS --> ME
    ME --> NATS
    NATS --> Ledger
    NATS --> MarketData
    NATS --> SettlementSvc

    %% Settlement Flow
    SettlementSvc --> SettlementContract
    ChainWatcher --> Vault
    ChainWatcher --> SettlementContract
    ChainWatcher --> NATS

    %% Data persistence
    CoreServices --> PG
    CoreServices --> Redis
    AdminAPI --> PG
```

---

## 3. Core Data & Execution Flows

### 3.1 Order Lifecycle & Trade Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Trader Client
    participant GW as api-gateway
    participant TradeSvc as trading service
    participant Risk as risk service
    participant Ledger as ledger service
    participant NATS as NATS JetStream
    participant ME as matching-engine (Rust)
    participant Settle as settlement service
    participant MktData as market-data service

    Trader->>Trader: Sign Order Typed Data (EIP-712)
    Trader->>GW: POST /api/v1/orders (Signed Order)
    GW->>GW: Authenticate Session/API Key & Validate Nonce
    GW->>TradeSvc: Submit Validated Order
    TradeSvc->>Risk: Pre-trade Check (Margin, Price Bands, KYC Tier)
    Risk-->>TradeSvc: Approved
    TradeSvc->>Ledger: Place Balance Hold (Quote for Buy, Base for Sell)
    Ledger-->>TradeSvc: Hold Placed (Journal Hold ID)
    TradeSvc->>NATS: Publish OrderCommand::Place(order)
    NATS->>ME: Stream Order to Deterministic Market Loop
    ME->>ME: Match against Price-Time Priority Book
    ME->>NATS: Publish EngineEvent::TradeExecuted(seq, trade)
    ME->>NATS: Publish EngineEvent::OrderAccepted(seq, remaining)

    par Double-Entry Settlement & Market Data
        NATS->>Ledger: TradeExecuted Event
        Ledger->>Ledger: Apply Double-Entry Postings (Maker/Taker Balances & Fees)
    and
        NATS->>MktData: TradeExecuted Event & Depth Update
        MktData->>Trader: WebSocket Broadcast (Depth Diff, Ticker, Trades)
    and
        NATS->>Settle: TradeExecuted Event
        Settle->>Settle: Buffer into Pending Settlement Batch
    end
```

### 3.2 On-Chain Deposit & Crediting Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Wallet
    participant Vault as Vault.sol (Base L2)
    participant Watcher as chain-watcher
    participant NATS as NATS JetStream
    participant Ledger as ledger service
    participant DB as PostgreSQL (custody schema)

    User->>Vault: deposit(asset, amount)
    Vault->>Vault: Emit Deposit(user, asset, amount, nonce)
    Watcher->>Vault: Ingest Block Events via JSON-RPC/WS
    Watcher->>DB: Record onchain_deposit (status: pending, confirmations: 0)
    Watcher->>Watcher: Track confirmations until >= required_confirmations
    Watcher->>DB: Update onchain_deposit (status: confirmed)
    Watcher->>NATS: Publish OnchainDepositConfirmed(deposit_id, user_id, amount)
    NATS->>Ledger: Handle Deposit Posting
    Ledger->>Ledger: Insert Journal Entry (Credit User Available, Debit Hot Wallet Asset)
    Ledger->>DB: Update custody.onchain_deposit (status: credited)
```

### 3.3 On-Chain Batch Settlement Flow

```mermaid
sequenceDiagram
    autonumber
    participant Settle as settlement service
    participant KMS as AWS/GCP Cloud KMS (Operator Key)
    participant SettlementContract as Settlement.sol
    participant Watcher as chain-watcher
    participant Ledger as ledger service

    Settle->>Settle: Group settled trades into batch (e.g. 500 trades or 5s window)
    Settle->>Settle: Compute net balance deltas & Merkle root
    Settle->>KMS: Request Operator Signature over (batch_hash, nonce, merkle_root)
    KMS-->>Settle: Signature (v, r, s)
    Settle->>SettlementContract: submitSettlementBatch(merkle_root, deltas, signature)
    SettlementContract->>SettlementContract: Verify Operator Signature & Apply Net Adjustments
    SettlementContract->>SettlementContract: Emit BatchSettled(batch_id, merkle_root)
    Watcher->>SettlementContract: Catch BatchSettled Event
    Watcher->>Ledger: Confirm Batch On-Chain
    Ledger->>Ledger: Mark matching trade postings as settled_onchain
```

### 3.4 Fiat Deposit & Maker-Checker (Four-Eyes) Withdrawal Flow

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Trader
    participant FiatSvc as custody-fiat service
    actor Maker as Compliance Admin (Maker)
    actor Checker as Finance Admin (Checker)
    participant AdminAPI as admin-api
    participant Audit as audit.audit_event

    Trader->>FiatSvc: Request Fiat Withdrawal (e.g. > ZAR 50,000 threshold)
    FiatSvc->>FiatSvc: Detect threshold exceeded -> Create ApprovalRequest
    FiatSvc->>AdminAPI: Notify Pending Approval Queue

    Maker->>AdminAPI: Review KYC, source of funds & Approve (Step 1)
    AdminAPI->>Audit: Append Maker Approval (Hash-Chained)
    AdminAPI->>AdminAPI: State: awaiting_second_approval

    Checker->>AdminAPI: Secondary Review with WebAuthn Re-Auth & Approve (Step 2)
    AdminAPI->>Audit: Append Checker Approval (Hash-Chained)
    AdminAPI->>FiatSvc: Execute Payout via Payment Provider API (Stitch / Bank EFT)
    FiatSvc-->>Trader: Funds Dispatched to Verified Bank Account
```

### 3.5 Emergency Escape Hatch Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Wallet
    participant Vault as Vault.sol
    participant Settlement as Settlement.sol

    Note over Vault,Settlement: Operator has been offline longer than ESCAPE_HATCH_PERIOD (e.g. 7 days)
    User->>Vault: initiateEmergencyWithdrawal(asset)
    Vault->>Settlement: verifyLastSettledBalance(user, asset)
    Settlement-->>Vault: Return last settled state & active uncancelled holds
    Vault->>Vault: Verify timelock elapsed & Transfer asset directly to User Wallet
    Vault->>User: Funds Dispatched Non-Custodially
```

---

## 4. Service Boundaries & Schema Ownership

Every microservice in the platform possesses **exclusive ownership** of its PostgreSQL schema:

| Service | Schema | Key Responsibilities & Owned Tables |
| :--- | :--- | :--- |
| `identity` | `identity` | User accounts, WebAuthn passkeys, SIWE credentials, session management, device tracking. |
| `kyc` | `kyc` | KYC cases, document verification results, tier limits (L0 to L3), risk profiles. |
| `ledger` | `ledger` | Double-entry bookkeeping: assets, user & system accounts, balanced journal lines, holds, snapshots. |
| `trading` | `trading` | Order ingestion, order cancellation, order lifecycle events, fee schedules. |
| `matching-engine` | *In-Memory + Event Log* | Deterministic order matching, sequential event assignment, tick and trade generation. |
| `settlement` | `trading` (settlement tables) | Batch aggregation, Merkle proof generation, on-chain transaction dispatch. |
| `chain-watcher` | `custody` | EVM block indexing, deposit confirmations, withdrawal broadcast confirmation. |
| `custody-fiat` | `fiat` | Payment provider integrations, bank account linkings, fiat deposit/withdrawal lifecycles. |
| `risk` | `risk` | Pre-trade risk assessment, market circuit breakers, withdrawal velocity limits. |
| `compliance` | `compliance` | Sanctions screening, PEP checks, suspicious activity reporting (SAR), Travel Rule records. |
| `admin-api` | `admin` | Admin authentication, granular RBAC, four-eyes approval workflows, configuration changes. |
| *Platform Audit* | `audit` | Append-only, cryptographically hash-chained log of all admin, financial, and security events. |
| `notifications` | `notify` | Dispatching multi-channel notifications (email, SMS, push, webhooks). |

---

## 5. High Availability, Fault Tolerance & Recovery

1. **Matching Engine Failure**:
   - The matching engine writes periodic snapshots (e.g. every 100,000 events) and relies on the NATS JetStream event log.
   - Upon restart, the engine loads the latest valid state snapshot and replays strictly sequenced events from the offset to re-establish exact order book memory state.
2. **Double-Entry Ledger Guarantees**:
   - Constraint triggers in PostgreSQL reject any journal entry where `sum(debit) != sum(credit)`.
   - Financial tables reject `UPDATE` and `DELETE` operations via database triggers; corrections must be recorded via compensating entries.
3. **Network Reorg Protection**:
   - `chain-watcher` requires a configurable number of block confirmations on Base L2 (minimum 12 blocks) before emitting credited deposit events to the ledger.
