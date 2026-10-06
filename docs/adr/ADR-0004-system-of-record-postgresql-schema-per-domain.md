# ADR-0004: PostgreSQL 16 as System of Record with Schema-Per-Domain Isolation

## Status
Accepted

## Context
Exchange financial data demands ACID guarantees, strict foreign keys, double-entry ledger balance constraints, append-only auditability, and clear bounded contexts across 12 business domains.

## Decision
1. Standardize on **PostgreSQL 16** as the authoritative relational system of record.
2. Structure the database into 12 dedicated schemas matching microservice domains: `identity`, `kyc`, `ledger`, `trading`, `custody`, `fiat`, `risk`, `compliance`, `market`, `admin`, `audit`, `notify`.
3. Enforce schema ownership via dedicated database roles (e.g., `identity_svc` can only write to `identity.*`). Services must never directly query or update another service's tables.
4. Conventions:
   - Primary keys: UUIDv7 (time-ordered, index-friendly).
   - Timestamps: UTC `timestamptz`.
   - Money and quantities: `NUMERIC(38,0)` in atomic base integer units + `asset_id` FK. No floating points.
   - Enums: Native Postgres enum types or lookup tables.
   - Append-only constraints: Triggers rejecting `UPDATE` and `DELETE` on financial ledger (`journal_entry`, `journal_line`) and audit (`audit_event`) tables.
   - Double-entry trigger: Deferred constraint trigger verifying that `sum(debit) == sum(credit)` for every `journal_entry`.

## Consequences
- **Positive**: Strict data integrity, zero accidental financial mutations, predictable write performance with time-ordered UUIDv7.
- **Negative**: Requires rigorous migration tooling and cross-service communication via APIs/events rather than SQL JOINs.
