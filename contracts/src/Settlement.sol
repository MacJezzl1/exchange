// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./interfaces/ISettlement.sol";

/**
 * @title Hybrid Exchange On-Chain Settlement Contract
 * @notice Verifies compressed batch trade settlements from off-chain matching engine,
 *         maintains user settled balance state, validates cryptographic Merkle proofs,
 *         and coordinates with Vault.sol for non-custodial custody.
 * @dev Deployed on Base L2 (EVM).
 */
contract Settlement is ISettlement {
    // Roles
    address public governance;
    address public operator;
    address public guardian;
    address public vault;

    // Heartbeat & Emergency parameters
    uint256 public constant ESCAPE_HATCH_PERIOD = 7 days;
    uint256 public lastOperatorHeartbeat;
    bool public paused;

    // Batch tracking
    uint256 public lastBatchId;
    bytes32 public latestMerkleRoot;
    mapping(uint256 => bytes32) public batchMerkleRoots; // batchId => root
    mapping(uint256 => bool) public executedBatches;

    // Settled balances: user => asset => balance
    mapping(address => mapping(address => uint256)) public settledBalances;

    // Reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // Modifiers
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        require(!paused, "Settlement: paused");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Settlement: caller is not governance");
        _;
    }

    modifier onlyGuardianOrGovernance() {
        require(msg.sender == guardian || msg.sender == governance, "Settlement: unauthorized");
        _;
    }

    constructor(
        address _governance,
        address _operator,
        address _guardian,
        address _vault
    ) {
        require(_governance != address(0), "Invalid governance");
        require(_operator != address(0), "Invalid operator");
        require(_guardian != address(0), "Invalid guardian");
        require(_operator != _guardian, "Operator and guardian must differ");

        governance = _governance;
        operator = _operator;
        guardian = _guardian;
        vault = _vault;

        lastOperatorHeartbeat = block.timestamp;
        _status = _NOT_ENTERED;
    }

    // ==========================================
    // 1. BATCH SETTLEMENT SUBMISSION
    // ==========================================

    /**
     * @notice Submits an aggregated trade settlement batch.
     * @param batchId Monotonically increasing batch sequence ID.
     * @param merkleRoot Merkle root of the global user balance state after this batch.
     * @param deltas Net balance changes to apply across affected user accounts.
     * @param operatorSignature Cryptographic signature from registered operator.
     */
    function submitSettlementBatch(
        uint256 batchId,
        bytes32 merkleRoot,
        BalanceDelta[] calldata deltas,
        bytes calldata operatorSignature
    ) external override whenNotPaused nonReentrant {
        require(batchId == lastBatchId + 1, "Settlement: invalid batch sequence");
        require(!executedBatches[batchId], "Settlement: batch already executed");
        require(merkleRoot != bytes32(0), "Settlement: invalid merkle root");

        // Hash deltas array
        bytes32 deltasHash = keccak256(abi.encode(deltas));

        // Construct EIP-191 / structured message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                batchId,
                merkleRoot,
                deltasHash
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        // Verify operator signature
        require(operatorSignature.length == 65, "Settlement: invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(operatorSignature.offset)
            s := calldataload(add(operatorSignature.offset, 32))
            v := byte(0, calldataload(add(operatorSignature.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Settlement: invalid signature v value");
        address recovered = ecrecover(ethSignedMessageHash, v, r, s);
        require(recovered == operator, "Settlement: invalid operator signature");

        // Apply balance deltas
        for (uint256 i = 0; i < deltas.length; i++) {
            address u = deltas[i].user;
            address a = deltas[i].asset;
            int256 d = deltas[i].delta;

            if (d > 0) {
                settledBalances[u][a] += uint256(d);
            } else if (d < 0) {
                uint256 absDebit = uint256(-d);
                require(settledBalances[u][a] >= absDebit, "Settlement: balance underflow");
                settledBalances[u][a] -= absDebit;
            }
        }

        // Commit batch state
        lastBatchId = batchId;
        latestMerkleRoot = merkleRoot;
        batchMerkleRoots[batchId] = merkleRoot;
        executedBatches[batchId] = true;
        lastOperatorHeartbeat = block.timestamp;

        emit BatchSettled(batchId, merkleRoot, deltas.length, block.timestamp);
        emit OperatorHeartbeatUpdated(block.timestamp);
    }

    // ==========================================
    // 2. MERKLE PROOF VERIFICATION
    // ==========================================

    /**
     * @notice Cryptographically verifies that a user balance is included in a Merkle root.
     * @param user Trader wallet address.
     * @param asset Asset contract address (or address(0) for ETH).
     * @param balance Stated token balance.
     * @param merkleProof Array of Merkle tree sibling hashes.
     * @param root Expected Merkle root hash.
     */
    function verifyBalanceProof(
        address user,
        address asset,
        uint256 balance,
        bytes32[] calldata merkleProof,
        bytes32 root
    ) public pure override returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(user, asset, balance))));
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < merkleProof.length; i++) {
            bytes32 proofElement = merkleProof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }

    // ==========================================
    // 3. BALANCE & EMERGENCY QUERIES
    // ==========================================

    function getLastSettledBalance(address user, address asset) external view override returns (uint256) {
        return settledBalances[user][asset];
    }

    function isEscapeHatchActive() public view returns (bool) {
        return block.timestamp > lastOperatorHeartbeat + ESCAPE_HATCH_PERIOD;
    }

    // ==========================================
    // 4. ADMIN & GOVERNANCE
    // ==========================================

    function pause() external onlyGuardianOrGovernance {
        paused = true;
    }

    function unpause() external onlyGovernance {
        paused = false;
    }

    function setOperator(address newOperator) external onlyGovernance {
        require(newOperator != address(0), "Invalid operator");
        require(newOperator != guardian, "Operator cannot be guardian");
        operator = newOperator;
    }

    function setGuardian(address newGuardian) external onlyGovernance {
        require(newGuardian != address(0), "Invalid guardian");
        require(newGuardian != operator, "Guardian cannot be operator");
        guardian = newGuardian;
    }

    function setVault(address newVault) external onlyGovernance {
        require(newVault != address(0), "Invalid vault");
        emit VaultUpdated(vault, newVault);
        vault = newVault;
    }
}
