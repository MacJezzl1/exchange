# Feature Design: 10. Built-in Tax and Accounting Exports

## 1. Summary
Cost-basis computation engines (FIFO, LIFO, HIFO) with CSV/PDF exports and South African Revenue Service (SARS) compliant format first.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
