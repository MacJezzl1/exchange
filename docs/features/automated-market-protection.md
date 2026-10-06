# Feature Design: 12. Automated Market Protection & Circuit Breakers

## 1. Summary
Dynamic price bands, self-trade prevention (STP), per-market and global emergency kill switches, insurance fund accounting.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
