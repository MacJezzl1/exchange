// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../src/Settlement.sol";
import "../src/interfaces/ISettlement.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address newSender) external;
}

contract SettlementTest {
    Settlement public settlement;

    address public governance = address(0x100);
    address public operator = address(0x200);
    address public guardian = address(0x300);
    address public vault = address(0x400);

    address public alice = address(0x1111);
    address public bob = address(0x2222);
    address public usdt = address(0x3333);

    Vm public constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public {
        settlement = new Settlement(governance, operator, guardian, vault);
    }

    function test_initial_state() public view {
        assert(settlement.governance() == governance);
        assert(settlement.operator() == operator);
        assert(settlement.guardian() == guardian);
        assert(settlement.vault() == vault);
        assert(settlement.lastBatchId() == 0);
        assert(settlement.paused() == false);
        assert(settlement.isEscapeHatchActive() == false);
    }

    function test_guardian_pause() public {
        vm.prank(guardian);
        settlement.pause();
        assert(settlement.paused() == true);

        vm.prank(governance);
        settlement.unpause();
        assert(settlement.paused() == false);
    }

    function test_merkle_proof_verification() public view {
        // Construct single-leaf tree
        uint256 balance = 1000 * 1e6;
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(alice, usdt, balance))));
        bytes32[] memory emptyProof = new bytes32[](0);

        // When proof is empty, leaf should match root
        bool isValid = settlement.verifyBalanceProof(alice, usdt, balance, emptyProof, leaf);
        assert(isValid == true);

        // Tampered balance should fail
        bool isForged = settlement.verifyBalanceProof(alice, usdt, balance + 1, emptyProof, leaf);
        assert(isForged == false);
    }

    function test_escape_hatch_activation_after_7_days() public {
        assert(settlement.isEscapeHatchActive() == false);

        // Advance time 8 days
        vm.warp(block.timestamp + 8 days);
        assert(settlement.isEscapeHatchActive() == true);
    }
}
