import { describe, it, expect } from 'vitest';
import { v7 as uuidv7 } from 'uuid';
import {
  BatchAggregator,
  MerkleTree,
  ProofOfReservesEngine,
  SettlementService,
  AccountBalance,
  MatchedTradeInput,
} from '../services/settlement/src';

describe('Phase 4: Hybrid Settlement, Merkle Trees & Proof of Reserves Verification', () => {
  const alice = '0x1111111111111111111111111111111111111111';
  const bob = '0x2222222222222222222222222222222222222222';
  const charlie = '0x3333333333333333333333333333333333333333';
  const feeCollector = '0x000000000000000000000000000000000000dEaD';

  const btcAsset = '0x018e0000000070008000000000000002';
  const usdtAsset = '0x018e0000000070008000000000000001';

  // =========================================================================
  // 1. BATCH AGGREGATOR NETTING & ZERO-SUM CONSERVATION
  // =========================================================================
  describe('Batch Aggregator & Netting Engine', () => {
    it('compresses multiple bilateral trades into net balance adjustments with zero-sum conservation', () => {
      const aggregator = new BatchAggregator();

      // Scenario:
      // Trade 1: Alice sells 1 BTC to Bob at 60,000 USDT (Maker Fee: 60, Taker Fee: 120)
      // Trade 2: Bob sells 0.5 BTC to Charlie at 61,000 USDT (Maker Fee: 30, Taker Fee: 61)
      const trades: MatchedTradeInput[] = [
        {
          tradeId: uuidv7(),
          buyerAddress: bob,
          sellerAddress: alice,
          baseAssetAddress: btcAsset,
          quoteAssetAddress: usdtAsset,
          price: '60000',
          quantity: '1',
          buyerFee: '120',
          sellerFee: '60',
        },
        {
          tradeId: uuidv7(),
          buyerAddress: charlie,
          sellerAddress: bob,
          baseAssetAddress: btcAsset,
          quoteAssetAddress: usdtAsset,
          price: '61000',
          quantity: '1', // using 1 unit for test math
          buyerFee: '61',
          sellerFee: '30',
        },
      ];

      const result = aggregator.aggregateTrades(trades, feeCollector);

      // Verify trade metrics
      expect(result.tradeCount).toBe(2);
      expect(result.totalVolumeBase).toBe(2n);
      expect(result.totalVolumeQuote).toBe(121000n);
      expect(result.totalFeesCollected).toBe(271n); // 120 + 60 + 61 + 30 = 271

      // Verify Alice net deltas:
      // - BTC: -1
      // - USDT: + (60,000 - 60) = +59,940
      const aliceBtc = result.deltas.find((d) => d.userAddress === alice && d.assetAddress === btcAsset);
      const aliceUsdt = result.deltas.find((d) => d.userAddress === alice && d.assetAddress === usdtAsset);
      expect(aliceBtc?.delta).toBe(-1n);
      expect(aliceUsdt?.delta).toBe(59940n);

      // Verify Bob net deltas (Bob bought 1 BTC then sold 1 BTC):
      // - BTC: +1 - 1 = 0 (net zero BTC delta!)
      // - USDT: - (60,000 + 120) + (61,000 - 30) = -60,120 + 60,970 = +850 USDT
      const bobBtc = result.deltas.find((d) => d.userAddress === bob && d.assetAddress === btcAsset);
      const bobUsdt = result.deltas.find((d) => d.userAddress === bob && d.assetAddress === usdtAsset);
      expect(bobBtc).toBeUndefined(); // Filtered out because net delta is 0! (Max gas compression)
      expect(bobUsdt?.delta).toBe(850n);

      // Verify Charlie net deltas:
      // - BTC: +1
      // - USDT: - (61,000 + 61) = -61,061
      const charlieBtc = result.deltas.find((d) => d.userAddress === charlie && d.assetAddress === btcAsset);
      const charlieUsdt = result.deltas.find((d) => d.userAddress === charlie && d.assetAddress === usdtAsset);
      expect(charlieBtc?.delta).toBe(1n);
      expect(charlieUsdt?.delta).toBe(-61061n);

      // Verify Platform Fee Collector:
      const feeDelta = result.deltas.find(
        (d) => d.userAddress.toLowerCase() === feeCollector.toLowerCase() && d.assetAddress === usdtAsset
      );
      expect(feeDelta?.delta).toBe(271n);

      // Total sum of all deltas across all assets must equal zero
      const sumBtc = result.deltas
        .filter((d) => d.assetAddress === btcAsset)
        .reduce((sum, d) => sum + d.delta, 0n);
      expect(sumBtc).toBe(0n);

      const sumUsdt = result.deltas
        .filter((d) => d.assetAddress === usdtAsset)
        .reduce((sum, d) => sum + d.delta, 0n);
      expect(sumUsdt).toBe(0n);
    });
  });

  // =========================================================================
  // 2. CRYPTOGRAPHIC MERKLE TREE & PROOF VERIFICATION
  // =========================================================================
  describe('Cryptographic Merkle Tree & Proof Generation', () => {
    it('constructs a deterministic Merkle tree and validates inclusion proofs', () => {
      const userAccounts: AccountBalance[] = [
        { userAddress: alice, assetAddress: btcAsset, balance: 500000000n },
        { userAddress: alice, assetAddress: usdtAsset, balance: 10000000000n },
        { userAddress: bob, assetAddress: btcAsset, balance: 250000000n },
        { userAddress: bob, assetAddress: usdtAsset, balance: 50000000000n },
        { userAddress: charlie, assetAddress: btcAsset, balance: 1000000000n },
      ];

      const tree = new MerkleTree(userAccounts);
      const root = tree.getRoot();
      expect(root).toBeDefined();
      expect(root.length).toBe(64); // SHA-256 hex string

      // Query proof for Alice BTC balance
      const aliceBtcProof = tree.getProofForAccount(alice, btcAsset);
      expect(aliceBtcProof).not.toBeNull();
      expect(aliceBtcProof!.root).toBe(root);
      expect(aliceBtcProof!.balance).toBe('500000000');

      // Valid proof passes verification
      const isValid = MerkleTree.verifyProof(aliceBtcProof!);
      expect(isValid).toBe(true);

      // Tampered proof (e.g. modified balance) is rejected
      const forgedProof = { ...aliceBtcProof!, balance: '9999999999' };
      const isForgedValid = MerkleTree.verifyProof(forgedProof);
      expect(isForgedValid).toBe(false);

      // Tampered address is rejected
      const forgedAddressProof = { ...aliceBtcProof!, userAddress: '0x9999999999999999999999999999999999999999' };
      const isAddressValid = MerkleTree.verifyProof(forgedAddressProof);
      expect(isAddressValid).toBe(false);
    });
  });

  // =========================================================================
  // 3. PROOF OF RESERVES ENGINE (SOLVENCY & COVERAGE)
  // =========================================================================
  describe('Proof-of-Reserves Solvency Engine', () => {
    it('correctly certifies solvency when on-chain reserves >= liabilities', () => {
      const engine = new ProofOfReservesEngine();
      const accounts: AccountBalance[] = [
        { userAddress: alice, assetAddress: usdtAsset, balance: 60000n },
        { userAddress: bob, assetAddress: usdtAsset, balance: 40000n },
        { userAddress: alice, assetAddress: btcAsset, balance: 2n },
      ];

      // Total Liabilities: USDT = 100,000, BTC = 2
      // On-chain Reserves: USDT = 102,000 (102% coverage), BTC = 2 (100% coverage)
      const onChainReserves = {
        [usdtAsset.toLowerCase()]: 102000n,
        [btcAsset.toLowerCase()]: 2n,
      };

      const { report } = engine.generateReport(accounts, onChainReserves);

      expect(report.isSolvent).toBe(true);
      expect(report.totalLiabilities[usdtAsset.toLowerCase()]).toBe('100000');
      expect(report.totalReserves[usdtAsset.toLowerCase()]).toBe('102000');
      expect(report.reserveRatios[usdtAsset.toLowerCase()]).toBe(102);
      expect(report.reserveRatios[btcAsset.toLowerCase()]).toBe(100);
    });

    it('flags under-collateralization when on-chain reserves < liabilities', () => {
      const engine = new ProofOfReservesEngine();
      const accounts: AccountBalance[] = [
        { userAddress: alice, assetAddress: usdtAsset, balance: 100000n },
      ];

      // Deficit: only 90,000 USDT in vault reserves (90% coverage)
      const onChainReserves = {
        [usdtAsset.toLowerCase()]: 90000n,
      };

      const { report } = engine.generateReport(accounts, onChainReserves);
      expect(report.isSolvent).toBe(false);
      expect(report.reserveRatios[usdtAsset.toLowerCase()]).toBe(90);
    });
  });

  // =========================================================================
  // 4. SETTLEMENT SERVICE ORCHESTRATION & BATCH COMMITS
  // =========================================================================
  describe('Settlement Service Workflow', () => {
    it('manages batches, commits Merkle roots, and verifies balance proofs', () => {
      const initialAccounts: AccountBalance[] = [
        { userAddress: alice, assetAddress: btcAsset, balance: 10n },
        { userAddress: bob, assetAddress: usdtAsset, balance: 600000n },
      ];

      const settlement = new SettlementService(initialAccounts);
      settlement.setOnChainReserve(btcAsset, 15n);
      settlement.setOnChainReserve(usdtAsset, 700000n);

      // Verify Initial Solvency
      const initialPoR = settlement.generateProofOfReserves();
      expect(initialPoR.isSolvent).toBe(true);

      // Execute a trade in Batch #1: Alice sells 2 BTC to Bob at 60,000 each (120,000 total)
      const batch1 = settlement.createSettlementBatch([
        {
          tradeId: uuidv7(),
          buyerAddress: bob,
          sellerAddress: alice,
          baseAssetAddress: btcAsset,
          quoteAssetAddress: usdtAsset,
          price: '60000',
          quantity: '2',
          buyerFee: '240',
          sellerFee: '120',
        },
      ]);

      expect(batch1.batchId).toBe(1);
      expect(batch1.status).toBe('confirmed');
      expect(batch1.txHash).toBeDefined();

      // Alice now has:
      // BTC: 10 - 2 = 8
      // USDT: 0 + (120,000 - 120) = 119,880
      const aliceBtcProof = settlement.getProofForUser(alice, btcAsset);
      expect(aliceBtcProof).not.toBeNull();
      expect(aliceBtcProof!.balance).toBe('8');
      expect(MerkleTree.verifyProof(aliceBtcProof!)).toBe(true);

      const aliceUsdtProof = settlement.getProofForUser(alice, usdtAsset);
      expect(aliceUsdtProof).not.toBeNull();
      expect(aliceUsdtProof!.balance).toBe('119880');
      expect(MerkleTree.verifyProof(aliceUsdtProof!)).toBe(true);

      // Sequential batch #2 increments batchId
      const batch2 = settlement.createSettlementBatch([
        {
          tradeId: uuidv7(),
          buyerAddress: alice,
          sellerAddress: bob,
          baseAssetAddress: btcAsset,
          quoteAssetAddress: usdtAsset,
          price: '60000',
          quantity: '1',
          buyerFee: '120',
          sellerFee: '60',
        },
      ]);

      expect(batch2.batchId).toBe(2);
      expect(settlement.getBatches().length).toBe(2);
    });
  });
});
