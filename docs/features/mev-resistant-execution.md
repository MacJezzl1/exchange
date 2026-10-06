# Feature Design: 2. MEV-Resistant Execution (Frequent Batch Auctions)

## 1. Summary
Orders batched into short frequent batch auctions (100-500 ms window) with uniform clearing prices, plus commit-reveal for large orders. Eliminates operator front-running by design.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
