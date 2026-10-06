# ADR-0005: Redis 7 for Ephemeral State, Distributed Locks, and Rate Limiting

## Status
Accepted

## Context
High-throughput edge operations (sliding-window rate limiting per IP/API key, user session cache, WebAuthn challenge caching, and distributed idempotency locks) require microsecond response times without overloading relational database connections.

## Decision
Deploy **Redis 7** as an in-memory cache and ephemeral state store.
- Use Redis for sliding-window token-bucket rate limiting at the `api-gateway`.
- Cache validated WebAuthn authentication challenges and temporary session data with strict TTLs.
- Implement distributed redlock / atomic SETNX for critical idempotency checks.
- Treat Redis as volatile: no financial or ledger data of record is ever stored solely in Redis. If Redis restarts, state can be safely reconstituted or expired gracefully.

## Consequences
- **Positive**: Low-latency edge filtering, protection of Postgres connection pools, clean ephemeral state expiry.
- **Negative**: Adds an additional infrastructure component requiring clustering/sentinel in high-availability production.
