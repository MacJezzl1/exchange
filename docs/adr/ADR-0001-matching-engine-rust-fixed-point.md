# ADR-0001: Matching Engine in Rust with Deterministic Event-Sourced Core and Fixed-Point Arithmetic

## Status
Accepted

## Context
A financial exchange matching engine must deliver sub-millisecond execution latency, deterministic order matching, and zero financial rounding discrepancies. Traditional floating-point arithmetic (IEEE 754) introduces non-deterministic rounding errors across platforms and hardware architectures, which is unacceptable for financial balances.

## Decision
1. Implement the matching engine core in Rust (`services/matching-engine`).
2. Run a dedicated single-threaded event loop per trading market/symbol to eliminate mutex lock contention.
3. Ban all floating-point numbers (`f32`, `f64`) in the core; all prices and quantities are strictly represented using 128-bit unsigned integers (`u128`) in atomic lot and tick units.
4. Adopt an event-sourced architecture: the in-memory order book state is a pure projection of an ordered event stream (`OrderAccepted`, `TradeExecuted`, `OrderCancelled`).
5. Support continuous snapshotting and deterministic replay: state can be perfectly reconstructed by replaying the event log from the last verified snapshot.

## Consequences
- **Positive**: Absolute deterministic execution, zero floating-point drift, memory safety without garbage collection pauses, ultra-fast replay recovery.
- **Negative**: Requires careful custom integer math for percentage fees and price conversions; requires snapshot serialization overhead.
