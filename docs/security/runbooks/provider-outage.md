# Runbook: External Provider Outage (KYC / Fiat Rails / RPC)

## 1. Trigger Conditions
- 5xx errors or connection timeouts exceeding 2 minutes from Stitch / Bank EFT provider / KYC verification partner / Base L2 RPC node.

## 2. Immediate Response
1. Automatic failover to secondary backup RPC endpoint for Base L2.
2. For fiat rails: mark provider status as degraded in `fiat.payment_provider`, queue deposits/withdrawals gracefully, and update status page (`apps/status`).
3. For KYC providers: queue incoming user verification submissions and display informative delay notifications in trader UI.
