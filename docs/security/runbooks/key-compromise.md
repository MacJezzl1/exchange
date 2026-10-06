# Runbook: Key Compromise Emergency Response

## 1. Trigger Conditions
- Unauthorized on-chain transaction or batch submission detected from the operator address.
- Cloud KMS / AWS KMS anomaly alert or API token leak reported.

## 2. Immediate Severity 0 Actions (First 5 Minutes)
1. **Activate Contract Pause**:
   - Guardian key immediately executes `Vault.pause()` on Base L2.
   - Halts all further deposits, normal withdrawals, and operator batch settlements.
2. **Revoke Compromised Key**:
   - In Cloud KMS / AWS KMS, immediately disable and schedule key destruction for the affected key version.
   - Rotate operator address in `Settlement.sol` via multi-sig governance.
3. **Notify Exchange Systems**:
   - Trading service activates global emergency kill switch: cancel all open orders and halt order intake.

## 3. Investigation & Recovery
1. Audit the last 100 on-chain blocks for unauthorized state transitions.
2. Verify double-entry ledger state against on-chain contract asset balances.
3. Deploy new operator key and verify zero balance discrepancies before unpausing.
