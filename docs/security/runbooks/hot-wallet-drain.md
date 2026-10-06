# Runbook: Hot Wallet Drain & Anomaly Response

## 1. Trigger Conditions
- Hot wallet balance drops below 20% of expected operating reserves within 1 hour.
- Outflow transaction volume exceeds hourly risk velocity threshold.

## 2. Immediate Actions
1. Automated circuit breaker activates: all outgoing withdrawals routed to manual maker-checker admin queue.
2. Freeze hot wallet sweeping scripts immediately.
3. Verify ledger `system_hot_wallet` account against on-chain hot wallet balance.
4. Notify Treasury and Security incident teams.
