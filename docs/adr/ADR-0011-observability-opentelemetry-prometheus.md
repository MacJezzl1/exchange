# ADR-0011: Observability via OpenTelemetry, Prometheus Metrics, and Structured JSON Logging

## Status
Accepted

## Context
High-reliability exchange infrastructure requires granular distributed tracing, SLA tracking (matching engine roundtrip latency, settlement batch lag, DB query duration), and structured logs for incident forensics.

## Decision
1. **Tracing**: Standardize on OpenTelemetry (OTel) instrumentation across all Node.js services and the Rust matching engine, propagating trace contexts via W3C `traceparent` headers.
2. **Metrics**: Expose Prometheus `/metrics` endpoints on each service tracking:
   - Matching engine execution latency (histogram, p50/p90/p99/p99.9).
   - Order submission rate and error codes.
   - Double-entry ledger journal insertion latency.
   - On-chain settlement confirmation lag.
3. **Logging**: Structured JSON logging (`pino` for Node.js, `tracing-subscriber` with JSON format for Rust) with required fields: `timestamp`, `level`, `service`, `trace_id`, `actor_id`.
4. Sensitive fields (passwords, private keys, session tokens, full card/bank details) are redacted at the logger level.

## Consequences
- **Positive**: Comprehensive real-time system visibility, automated alert triggers for SLA violations, unified debugging across asynchronous microservices.
- **Negative**: Trace context propagation must be consistently maintained across NATS message headers.
