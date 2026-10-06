// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IVault {
    event Deposit(address indexed user, address indexed asset, uint256 amount, uint256 indexed nonce);
    event WithdrawalRequested(bytes32 indexed withdrawalId, address indexed user, address indexed asset, uint256 amount, uint256 unlockTimestamp);
    event WithdrawalExecuted(address indexed user, address indexed asset, uint256 amount);
    event EmergencyEscapeHatchExecuted(address indexed user, address indexed asset, uint256 amount);
    event OperatorHeartbeatUpdated(uint256 timestamp);

    function depositNative() external payable;
    function depositERC20(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount, uint256 nonce, bytes calldata operatorSignature) external;
    function executePendingWithdrawal(bytes32 withdrawalId) external;
    function executeEmergencyEscapeHatch(address token) external;
    function getUserBalance(address user, address token) external view returns (uint256);
}
