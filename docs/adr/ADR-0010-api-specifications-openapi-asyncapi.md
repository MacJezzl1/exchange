# ADR-0010: Formal API Contracts via OpenAPI 3.1 and AsyncAPI 3.0

## Status
Accepted

## Context
Clear service interfaces and client contracts are essential to prevent runtime schema mismatches. Section 3.2 specifies OpenAPI for REST and AsyncAPI for asynchronous event bus and WebSocket feeds.

## Decision
1. **REST APIs**: Authored in OpenAPI 3.1 specification files:
   - `docs/api/openapi-trader.yaml` (Trader Edge API)
   - `docs/api/openapi-admin.yaml` (Admin API)
2. **Event & Streaming APIs**: Authored in AsyncAPI 3.0 specification:
   - `docs/api/asyncapi-events.yaml` (NATS JetStream events and market WebSocket subscriptions)
3. Generate TypeScript types and runtime validation schemas (via Zod or code-gen tooling) from these formal specifications.

## Consequences
- **Positive**: Single source of truth for edge documentation, automated client SDK generation, contract-first API development.
- **Negative**: Schema updates must be mirrored in the specification files before client or service changes are committed.
