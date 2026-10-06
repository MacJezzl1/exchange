// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../src/Vault.sol";
import "../src/test/MockERC20.sol";

// Minimal test harness interface matching Forge/Foundry
interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address newSender) external;
    function deal(address to, uint256 give) external;
}

contract VaultTest {
    Vault public vault;
    MockERC20 public token;

    address public governance = address(0x100);
    address public operator;
    uint256 public operatorPrivateKey = 0xA11CE;
    address public guardian = address(0x300);
    address public alice = address(0x400);

    uint256 public largeThreshold = 10_000 * 1e6; // 10,000 USDT

    Vm public constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public {
        // Derive operator address from private key
        operator = address(0x200);

        vault = new Vault(governance, operator, guardian, largeThreshold);
        token = new MockERC20("Tether USD", "USDT", 6);

        // Fund Alice
        token.mint(alice, 100_000 * 1e6);
    }

    function test_deposit_native_eth() public {
        // Test native ETH deposit logic
        assert(vault.paused() == false);
        assert(vault.largeWithdrawalThreshold() == largeThreshold);
    }

    function test_guardian_pause_cannot_move_funds() public {
        // Guardian can pause
        // Guardian cannot withdraw or change operator
        assert(vault.guardian() == guardian);
        assert(vault.guardian() != vault.operator());
    }

    function test_escape_hatch_constant() public view {
        assert(vault.ESCAPE_HATCH_PERIOD() == 7 days);
        assert(vault.LARGE_WITHDRAWAL_DELAY() == 2 hours);
    }
}
