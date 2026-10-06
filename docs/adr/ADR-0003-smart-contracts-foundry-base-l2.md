# ADR-0003: Solidity Smart Contracts with Foundry on Base EVM L2

## Status
Accepted

## Context
Non-custodial settlement requires on-chain smart contracts (`Vault.sol`, `Settlement.sol`, `AccountFactory.sol`) with low transaction gas costs, high throughput, and developer tooling supporting property-based invariant testing and fuzzing.

## Decision
1. **Tooling**: Foundry (`forge`, `cast`, `anvil`) for compilation, linting, gas snapshots, and invariant/fuzz testing. Hardhat/Truffle are excluded due to slower execution and JavaScript test overhead.
2. **Components**: OpenZeppelin v5 audited upgradeable contracts and cryptography libraries.
3. **Target Chain**: **Base L2** (Coinbase's OP-Stack EVM rollup) as the primary settlement chain.
   - Low transaction fees (< $0.01 per batch settlement).
   - High block throughput and sub-second soft confirmations.
   - Deep liquidity rails and institutional fiat on-ramps.
   - Direct compatibility with EVM standards (ERC-20, ERC-4337, EIP-712).

## Consequences
- **Positive**: Blazing fast testing in Rust-native Foundry, rigorous fuzz/invariant tests, negligible settlement gas overhead on Base.
- **Negative**: Operator remains reliant on Base sequencer availability (mitigated via on-chain emergency escape hatch).
