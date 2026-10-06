# Feature Design: 7. African Rails & Local Payment Providers

## 1. Summary
Pluggable payment-provider interface (Instant EFT via Stitch/Ozow, Mobile Money via M-Pesa, bank transfer). Maker-checker admin approvals for high-value payouts.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
