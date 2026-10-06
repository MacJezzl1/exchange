import { createHash } from 'crypto';
import {
  AccountBalance,
  MatchedTradeInput,
  SettlementBatch,
  MerkleProof,
  ProofOfReservesReport,
} from './types';
import { MerkleTree } from './merkle';
import { BatchAggregator } from './aggregator';
import { ProofOfReservesEngine } from './proof-of-reserves';

export class SettlementService {
  private readonly aggregator = new BatchAggregator();
  private readonly porEngine = new ProofOfReservesEngine();

  // Internal state
  private lastBatchId = 0;
  private readonly batches: SettlementBatch[] = [];
  private readonly accounts = new Map<string, bigint>(); // `${user}:${asset}` -> balance
  private currentMerkleTree: MerkleTree = new MerkleTree([]);
  private lastPoRReport: ProofOfReservesReport | null = null;

  // On-chain Vault reserves
  private readonly onChainReserves = new Map<string, bigint>();

  constructor(initialBalances: AccountBalance[] = []) {
    for (const acc of initialBalances) {
      const key = `${acc.userAddress.toLowerCase()}:${acc.assetAddress.toLowerCase()}`;
      this.accounts.set(key, acc.balance);
    }
    this.rebuildMerkleTree();
  }

  public setOnChainReserve(assetAddress: string, amount: bigint): void {
    this.onChainReserves.set(assetAddress.toLowerCase(), amount);
  }

  public getOnChainReserve(assetAddress: string): bigint {
    return this.onChainReserves.get(assetAddress.toLowerCase()) || 0n;
  }

  /**
   * Aggregates trade matches, updates balances, constructs new Merkle root, and creates a signed settlement batch.
   */
  public createSettlementBatch(
    trades: MatchedTradeInput[],
    operatorPrivateKeyMock = 'operator_secret_kms_key'
  ): SettlementBatch {
    const { deltas } = this.aggregator.aggregateTrades(trades);

    // Apply deltas to internal state
    for (const delta of deltas) {
      const key = `${delta.userAddress.toLowerCase()}:${delta.assetAddress.toLowerCase()}`;
      const current = this.accounts.get(key) || 0n;
      const updated = current + delta.delta;
      if (updated < 0n) {
        throw new Error(
          `Settlement failure: user ${delta.userAddress} balance would become negative (${updated.toString()})`
        );
      }
      this.accounts.set(key, updated);
    }

    // Rebuild Merkle tree
    this.rebuildMerkleTree();
    const merkleRoot = this.currentMerkleTree.getRoot();

    this.lastBatchId++;
    const batchId = this.lastBatchId;

    // Simulate operator signature over batch
    const batchHash = createHash('sha256')
      .update(
        `${batchId}:${merkleRoot}:${JSON.stringify(deltas, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`
      )
      .digest('hex');
    const operatorSignature = createHash('sha256')
      .update(batchHash + operatorPrivateKeyMock)
      .digest('hex');

    const batch: SettlementBatch = {
      batchId,
      timestamp: Date.now(),
      deltas,
      merkleRoot,
      operatorSignature,
      status: 'confirmed',
      txHash: `0x${createHash('sha256').update(`tx_${batchId}_${batchHash}`).digest('hex')}`,
    };

    this.batches.push(batch);
    return batch;
  }

  public getProofForUser(userAddress: string, assetAddress: string): MerkleProof | null {
    return this.currentMerkleTree.getProofForAccount(userAddress, assetAddress);
  }

  public generateProofOfReserves(): ProofOfReservesReport {
    const balances = this.getAllAccountBalances();
    const reservesObj: Record<string, bigint> = {};
    for (const [asset, amount] of this.onChainReserves.entries()) {
      reservesObj[asset] = amount;
    }

    const { report } = this.porEngine.generateReport(balances, reservesObj);
    this.lastPoRReport = report;
    return report;
  }

  public getBatches(): SettlementBatch[] {
    return [...this.batches];
  }

  public getLatestBatch(): SettlementBatch | null {
    return this.batches[this.batches.length - 1] || null;
  }

  public getLatestPoRReport(): ProofOfReservesReport | null {
    return this.lastPoRReport;
  }

  public getAllAccountBalances(): AccountBalance[] {
    const list: AccountBalance[] = [];
    for (const [key, balance] of this.accounts.entries()) {
      const [userAddress, assetAddress] = key.split(':');
      if (userAddress && assetAddress) {
        list.push({ userAddress, assetAddress, balance });
      }
    }
    return list;
  }

  private rebuildMerkleTree(): void {
    const list = this.getAllAccountBalances();
    this.currentMerkleTree = new MerkleTree(list);
  }
}
