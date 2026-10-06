# ADR-0009: Web3 Contract Integration via viem and Statically Typed ABIs

## Status
Accepted

## Context
Backend services (`chain-watcher`, `settlement`) and frontend clients interact with EVM smart contracts on Base L2. The interaction must be type-safe and avoid out-of-sync ABI definitions.

## Decision
1. Standardize on **viem** for all EVM client interactions in Node.js and the browser.
2. Generate static TypeScript typings directly from compiled Foundry artifacts (`out/Vault.sol/Vault.json`) using `wagmi/cli` or type generation scripts.
3. Prohibit manual or unversioned copy-pasting of ABI JSON definitions into frontend or backend codebases.

## Consequences
- **Positive**: Compile-time verification of smart contract function signatures, parameters, and return types; light bundle footprint compared to legacy web3.js/ethers.
- **Negative**: Requires rebuilding types whenever contracts are modified and recompiled in Foundry.
