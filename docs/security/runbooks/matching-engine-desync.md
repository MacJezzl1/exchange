# Runbook: Matching Engine Desync & Replay Recovery

## 1. Trigger Conditions
- Sequence number gap detected between NATS event log and matching engine state.
- In-memory order book hash does not match expected state root.
- Unhandled panic in matching engine process.

## 2. Recovery Procedure
1. Trading service pauses order intake for the affected market pair.
2. Cancel in-flight matches and isolate engine worker.
3. Reload latest verified snapshot from persistent storage.
4. Deterministically replay all events from NATS JetStream beginning from `snapshot_sequence + 1`.
5. Compare recovered state hash with ledger journal postings.
6. Resume market trading with a 10-second cancel-only grace period.
