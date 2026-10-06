# Smart Contracts Threat Model & Invariants

**Target Contracts**:
- `contracts/src/Vault.sol` (User asset custody, deposits, withdrawals, escape hatch)
- `contracts/src/Settlement.sol` (Batch proof verification, net state transitions, cancellation enforcement)
- `contracts/src/AccountFactory.sol` (ERC-4337 smart account creation, session keys)

---

## 1. Non-Custodial Core Principles & Invariants

The platform smart contracts operate under strict mathematical and economic invariants:

1. **Vault Solvency Invariant**:
   $$\text{Contract Asset Balance} \ge \sum_{u} \text{User Settled Balances}(u) + \sum_{p} \text{Pending Withdrawals}(p)$$
2. **Zero Unauthorized Asset Movement**:
   No funds can be withdrawn from `Vault.sol` without either:
   - A direct transaction signed by the user's private key / ERC-4337 smart account.
   - A cryptographically verified settlement batch signed by the authorized operator key, referencing a valid EIP-712 order signed by the user.
3. **No Replay Attack Vector**:
   Every batch settlement must verify:
   - Batch nonce is strictly sequential: $\text{batchNonce} == \text{currentNonce} + 1$.
   - Order nonces are marked as executed or cancelled on-chain to prevent double-spending across batches.
4. **Guaranteed User Exit (Escape Hatch)**:
   If the operator ceases batch submissions for a period exceeding `ESCAPE_HATCH_PERIOD` (default: 7 days / 50,400 blocks on Base), any user can withdraw their funds non-custodially based on the last finalized on-chain settlement state.

---

## 2. Threat Analysis & Mitigations

### 2.1 Reentrancy & Flash Loan Manipulation
- **Threat**: Attacker executes a reentrancy attack during native ETH or ERC-777/ERC-20 token withdrawals from `Vault.sol`.
- **Mitigation**:
  - OpenZeppelin `ReentrancyGuardUpgradeable` applied to all deposit and withdrawal functions.
  - Strict adherence to Checks-Effects-Interactions (CEI): internal balances deducted prior to calling external transfer functions.

### 2.2 Operator Key Compromise
- **Threat**: Attacker steals the operator signing key and attempts to drain the vault via fraudulent settlement batches.
- **Mitigation**:
  - Maximum per-batch net outflow limits enforced on-chain.
  - Time-locked withdrawal delay for withdrawals exceeding large dollar thresholds (e.g. > $50,000 equivalent).
  - Emergency `pause()` function executable by an independent Guardian key (which cannot withdraw or move funds).
  - The Guardian and Operator keys are strictly isolated and never reside on the same server or KMS instance.

### 2.3 Malicious Proxy Upgrades
- **Threat**: Rogue admin upgrades the logic contract to drain funds.
- **Mitigation**:
  - Upgrade permissions are held exclusively by a `TimelockController` requiring a minimum 48-hour delay.
  - Proposed implementation code hashes are emitted as public on-chain events when scheduled, giving users ample time to withdraw via the normal exit path before an upgrade executes.
  - Multi-sig ownership on the governance contract (Safe 3-of-5).

---

## 3. Formal Invariant Test Suite Requirements (Foundry)

The contract test suite must assert the following invariant tests with a minimum of 10,000 runs:
1. `invariant_vault_balance_equals_or_exceeds_total_liabilities()`
2. `invariant_no_user_balance_underflow()`
3. `invariant_batch_nonce_strictly_monotonic()`
4. `invariant_cancelled_order_cannot_be_filled_in_settlement()`
5. `invariant_escape_hatch_accessible_when_liveness_exceeded()`
