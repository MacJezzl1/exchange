# Feature Design: 8. Advanced Order Types & Lifecycle

## 1. Summary
Limit, market, stop, stop-limit, post-only, IOC, FOK, OCO, TWAP, and iceberg orders. Validated server-side, 100% replayable from the event log.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
