// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./interfaces/IVault.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Hybrid Exchange Non-Custodial Vault Contract
 * @notice Users retain sovereign custody of assets. Withdrawals require either a valid
 *         operator settlement proof or the non-custodial emergency escape hatch.
 * @dev Deployed on Base L2 (EVM).
 */
contract Vault is IVault {
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE"); // Pause only
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Sentinel address representing native ETH
    address public constant NATIVE_ETH = address(0);

    // Escape hatch parameters
    uint256 public constant ESCAPE_HATCH_PERIOD = 7 days;
    uint256 public constant LARGE_WITHDRAWAL_DELAY = 2 hours;

    // State Variables
    address public governance;
    address public operator;
    address public guardian;

    bool public paused;
    uint256 public lastOperatorHeartbeat;
    uint256 public largeWithdrawalThreshold; // In atomic units (e.g. 50,000 USD equivalent)
    uint256 public depositNonceCounter;

    // Balances: user => asset => balance
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public totalVaultBalances; // asset => total

    // Replay Protection: user => nonce => executed
    mapping(address => mapping(uint256 => bool)) public executedNonces;

    // Delayed Large Withdrawals
    struct PendingWithdrawal {
        address user;
        address asset;
        uint256 amount;
        uint256 unlockTimestamp;
        bool executed;
    }
    mapping(bytes32 => PendingWithdrawal) public pendingWithdrawals;

    // Reentrancy guard lock
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // Modifiers
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        require(!paused, "Vault: paused by guardian");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Vault: caller is not governance");
        _;
    }

    modifier onlyGuardianOrGovernance() {
        require(msg.sender == guardian || msg.sender == governance, "Vault: caller not guardian or governance");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Vault: caller is not operator");
        _;
    }

    constructor(
        address _governance,
        address _operator,
        address _guardian,
        uint256 _largeWithdrawalThreshold
    ) {
        require(_governance != address(0), "Invalid governance");
        require(_operator != address(0), "Invalid operator");
        require(_guardian != address(0), "Invalid guardian");
        require(_operator != _guardian, "Operator and guardian keys must never be the same");

        governance = _governance;
        operator = _operator;
        guardian = _guardian;
        largeWithdrawalThreshold = _largeWithdrawalThreshold;

        lastOperatorHeartbeat = block.timestamp;
        _status = _NOT_ENTERED;
    }

    // ==========================================
    // 1. DEPOSITS
    // ==========================================

    receive() external payable {
        depositNative();
    }

    function depositNative() public payable override whenNotPaused nonReentrant {
        require(msg.value > 0, "Deposit amount must be > 0");

        balances[msg.sender][NATIVE_ETH] += msg.value;
        totalVaultBalances[NATIVE_ETH] += msg.value;
        depositNonceCounter++;

        emit Deposit(msg.sender, NATIVE_ETH, msg.value, depositNonceCounter);
    }

    function depositERC20(address token, uint256 amount) external override whenNotPaused nonReentrant {
        require(token != NATIVE_ETH, "Use depositNative for ETH");
        require(amount > 0, "Deposit amount must be > 0");

        balances[msg.sender][token] += amount;
        totalVaultBalances[token] += amount;
        depositNonceCounter++;

        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(success, "ERC20 transferFrom failed");

        emit Deposit(msg.sender, token, amount, depositNonceCounter);
    }

    // ==========================================
    // 2. WITHDRAWALS & PROOFS
    // ==========================================

    function withdraw(
        address token,
        uint256 amount,
        uint256 nonce,
        bytes calldata operatorSignature
    ) external override whenNotPaused nonReentrant {
        require(!executedNonces[msg.sender][nonce], "Vault: nonce already executed");
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender][token] >= amount, "Vault: insufficient settled balance");

        // Verify operator signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                token,
                amount,
                nonce,
                block.chainid,
                address(this)
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        address recoveredSigner = _recoverSigner(ethSignedMessageHash, operatorSignature);
        require(recoveredSigner == operator, "Vault: invalid operator settlement signature");

        // Mark nonce as spent
        executedNonces[msg.sender][nonce] = true;
        lastOperatorHeartbeat = block.timestamp;

        // Check large withdrawal threshold delay
        if (amount >= largeWithdrawalThreshold) {
            bytes32 withdrawalId = keccak256(abi.encodePacked(msg.sender, token, amount, nonce, block.timestamp));
            uint256 unlockTime = block.timestamp + LARGE_WITHDRAWAL_DELAY;

            pendingWithdrawals[withdrawalId] = PendingWithdrawal({
                user: msg.sender,
                asset: token,
                amount: amount,
                unlockTimestamp: unlockTime,
                executed: false
            });

            // Encumber balance
            balances[msg.sender][token] -= amount;

            emit WithdrawalRequested(withdrawalId, msg.sender, token, amount, unlockTime);
            return;
        }

        // Immediate payout under threshold
        _transferOut(token, msg.sender, amount);
    }

    function executePendingWithdrawal(bytes32 withdrawalId) external override whenNotPaused nonReentrant {
        PendingWithdrawal storage pw = pendingWithdrawals[withdrawalId];
        require(pw.user != address(0), "Withdrawal does not exist");
        require(!pw.executed, "Withdrawal already executed");
        require(block.timestamp >= pw.unlockTimestamp, "Timelock delay not elapsed");

        pw.executed = true;
        _transferOut(pw.asset, pw.user, pw.amount);
    }

    // ==========================================
    // 3. EMERGENCY ESCAPE HATCH
    // ==========================================

    /**
     * @notice If operator has been offline beyond ESCAPE_HATCH_PERIOD (7 days),
     *         users can withdraw their funds non-custodially without operator signatures.
     */
    function executeEmergencyEscapeHatch(address token) external override nonReentrant {
        require(
            block.timestamp > lastOperatorHeartbeat + ESCAPE_HATCH_PERIOD,
            "Vault: escape hatch unavailable, operator is active"
        );

        uint256 userBal = balances[msg.sender][token];
        require(userBal > 0, "Vault: zero balance to withdraw");

        balances[msg.sender][token] = 0;
        _transferOut(token, msg.sender, userBal);

        emit EmergencyEscapeHatchExecuted(msg.sender, token, userBal);
    }

    // ==========================================
    // 4. OPERATOR HEARTBEAT & ADMIN
    // ==========================================

    function updateOperatorHeartbeat() external onlyOperator {
        lastOperatorHeartbeat = block.timestamp;
        emit OperatorHeartbeatUpdated(block.timestamp);
    }

    function pause() external onlyGuardianOrGovernance {
        paused = true;
    }

    function unpause() external onlyGovernance {
        paused = false;
    }

    function setOperator(address _operator) external onlyGovernance {
        require(_operator != address(0) && _operator != guardian, "Invalid operator address");
        operator = _operator;
    }

    function setGuardian(address _guardian) external onlyGovernance {
        require(_guardian != address(0) && _guardian != operator, "Invalid guardian address");
        guardian = _guardian;
    }

    function setLargeWithdrawalThreshold(uint256 _threshold) external onlyGovernance {
        largeWithdrawalThreshold = _threshold;
    }

    function getUserBalance(address user, address token) external view override returns (uint256) {
        return balances[user][token];
    }

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    function _transferOut(address token, address to, uint256 amount) internal {
        if (balances[to][token] >= amount) {
            balances[to][token] -= amount;
        }
        totalVaultBalances[token] -= amount;

        if (token == NATIVE_ETH) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Native ETH transfer failed");
        } else {
            bool success = IERC20(token).transfer(to, amount);
            require(success, "ERC20 transfer failed");
        }

        emit WithdrawalExecuted(to, token, amount);
    }

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        return ecrecover(hash, v, r, s);
    }
}
