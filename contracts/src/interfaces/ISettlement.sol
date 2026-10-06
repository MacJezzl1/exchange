// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ISettlement {
    struct BalanceDelta {
        address user;
        address asset;
        int256 delta; // Positive = credit, Negative = debit
    }

    event BatchSettled(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 deltaCount,
        uint256 timestamp
    );
    event OperatorHeartbeatUpdated(uint256 timestamp);
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    function submitSettlementBatch(
        uint256 batchId,
        bytes32 merkleRoot,
        BalanceDelta[] calldata deltas,
        bytes calldata operatorSignature
    ) external;

    function verifyBalanceProof(
        address user,
        address asset,
        uint256 balance,
        bytes32[] calldata merkleProof,
        bytes32 root
    ) external pure returns (bool);

    function getLastSettledBalance(address user, address asset) external view returns (uint256);
}
