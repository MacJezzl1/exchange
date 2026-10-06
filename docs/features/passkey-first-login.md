# Feature Design: 4. Passkey-First Login (WebAuthn / FIDO2 & SIWE)

## 1. Summary
WebAuthn passkeys as primary frictionless login with SIWE as an option. Zero single-factor passwords for withdrawals.

## 2. Architectural Boundaries
- Owned Services: Described in Section 3 and 12 of the Master Specification.
- Database Tables: Managed within domain PostgreSQL schemas.
- Implementation Phase: Aligned with the roadmap phase sequence.

## 3. Security & Invariant Considerations
- Requires zero trust assumptions towards internal operators.
- Strict event-sourced auditability.
