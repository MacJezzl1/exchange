# ADR-0002: Service Implementation in TypeScript (Node.js) with Strict Mode

## Status
Accepted

## Context
Section 3.2 allows TypeScript (Node.js) with strict mode or Go for microservices, requiring explicit documentation per service. The platform features 13 microservices handling complex domain logic (identity, ledger, trading intake, KYC, compliance, admin API).

## Decision
Adopt **TypeScript (Node.js)** with strict compiler configuration (`noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`) across all 13 microservices and shared libraries.

### Rationale:
1. **Shared Type System**: Sharing models between backend services, frontend Next.js applications, the public TypeScript SDK, and EIP-712 typing eliminates impedance mismatch and hand-duplicated schema definitions.
2. **Ecosystem Synergy**: First-class support for WebAuthn libraries (`@simplewebauthn`), EVM client libraries (`viem`), and OpenAPI/AsyncAPI validators.
3. **High-Throughput Boundaries**: Pure compute-intensive workloads (order matching) are offloaded to Rust (`services/matching-engine`), while I/O-bound microservices benefit from Node.js asynchronous event-driven I/O.
4. If a specific edge service (such as WebSocket fan-out) exhibits GC pressure under future benchmark loads, it can be migrated to Go without architectural overhaul due to event-driven message boundaries.

## Consequences
- **Positive**: Single unified language across frontend, backend, SDK, and tooling; zero duplicate type maintenance; rapid integration with web standards.
- **Negative**: Node.js single-threaded event loop requires disciplined avoidance of synchronous CPU-heavy tasks.
