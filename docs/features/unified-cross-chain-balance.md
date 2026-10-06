# Feature Design: 6. Unified Cross-Chain Balance View

## 1. Summary
Single deposit address per chain with clear status tracking (pending, confirming, credited). Modular chain adapter interface.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
