// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title Hybrid Exchange ERC-4337 Smart Account & Session Key Manager
 * @notice Provides counterfactual smart account creation, session key delegation,
 *         and gasless trading authorization on Base L2.
 */
contract SmartAccount {
    address public owner;
    address public entryPoint;

    struct SessionKeyConfig {
        uint48 validUntil;
        uint256 maxSpend;
        uint256 currentSpent;
        bool isActive;
    }

    // sessionKey => config
    mapping(address => SessionKeyConfig) public sessionKeys;

    event SessionKeyRegistered(address indexed sessionKey, uint48 validUntil, uint256 maxSpend);
    event SessionKeyRevoked(address indexed sessionKey);
    event Executed(address indexed target, uint256 value, bytes data);

    modifier onlyOwner() {
        require(msg.sender == owner, "SmartAccount: caller is not owner");
        _;
    }

    constructor(address _owner, address _entryPoint) {
        require(_owner != address(0), "Invalid owner");
        owner = _owner;
        entryPoint = _entryPoint;
    }

    /**
     * @notice Registers a scoped session key for browser/mobile auto-signing.
     * @param sessionKey Ephemeral key generated in browser secure enclave / memory.
     * @param validUntil Unix timestamp expiry.
     * @param maxSpend Cumulative maximum spending limit in atomic units.
     */
    function registerSessionKey(
        address sessionKey,
        uint48 validUntil,
        uint256 maxSpend
    ) external onlyOwner {
        require(sessionKey != address(0), "Invalid session key");
        require(validUntil > block.timestamp, "Expiry must be in the future");

        sessionKeys[sessionKey] = SessionKeyConfig({
            validUntil: validUntil,
            maxSpend: maxSpend,
            currentSpent: 0,
            isActive: true
        });

        emit SessionKeyRegistered(sessionKey, validUntil, maxSpend);
    }

    function revokeSessionKey(address sessionKey) external onlyOwner {
        sessionKeys[sessionKey].isActive = false;
        emit SessionKeyRevoked(sessionKey);
    }

    function isSessionKeyValid(address sessionKey, uint256 spendAmount) external view returns (bool) {
        SessionKeyConfig memory config = sessionKeys[sessionKey];
        if (!config.isActive) return false;
        if (block.timestamp > config.validUntil) return false;
        if (config.currentSpent + spendAmount > config.maxSpend) return false;
        return true;
    }

    /**
     * @notice Execute call authorized by either the owner or a valid session key.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 spendAmount
    ) external returns (bytes memory) {
        if (msg.sender != owner) {
            // Must be authenticated session key
            SessionKeyConfig storage config = sessionKeys[msg.sender];
            require(config.isActive, "SessionKey: inactive or revoked");
            require(block.timestamp <= config.validUntil, "SessionKey: expired");
            require(config.currentSpent + spendAmount <= config.maxSpend, "SessionKey: spend limit exceeded");

            config.currentSpent += spendAmount;
        }

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "SmartAccount: call reverted");

        emit Executed(target, value, data);
        return result;
    }
}

contract AccountFactory {
    address public entryPoint;

    event AccountCreated(address indexed owner, address indexed account);

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    function createAccount(address owner, uint256 salt) external returns (address) {
        bytes32 newsalt = keccak256(abi.encodePacked(owner, salt));
        SmartAccount account = new SmartAccount{salt: newsalt}(owner, entryPoint);
        address accountAddr = address(account);

        emit AccountCreated(owner, accountAddr);
        return accountAddr;
    }

    function getAddress(address owner, uint256 salt) external view returns (address) {
        bytes32 newsalt = keccak256(abi.encodePacked(owner, salt));
        bytes memory bytecode = abi.encodePacked(
            type(SmartAccount).creationCode,
            abi.encode(owner, entryPoint)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), newsalt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }
}
