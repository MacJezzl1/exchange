import { v7 as uuidv7 } from 'uuid';
import { UUID, HexString } from '@exchange/shared-types';
import { TrackedDeposit } from './types';
import { ChainRpcAdapter, MockChainRpcAdapter } from './provider';

export interface LedgerCreditCallback {
  (userId: UUID, assetId: UUID, amount: string, referenceId: UUID): void;
}

export class ChainWatcherIndexer {
  private readonly rpc: ChainRpcAdapter;
  private readonly requiredConfirmations: number;
  private lastIndexedBlock: number;
  private readonly deposits = new Map<string, TrackedDeposit>(); // txHash:logIndex -> TrackedDeposit
  private readonly addressToUser = new Map<HexString, UUID>();
  private readonly assetAddressToId = new Map<HexString, UUID>();
  private onCreditCallback?: LedgerCreditCallback;

  constructor(rpc?: ChainRpcAdapter, requiredConfirmations = 12, startBlock = 1000) {
    this.rpc = rpc || new MockChainRpcAdapter(84532, startBlock);
    this.requiredConfirmations = requiredConfirmations;
    this.lastIndexedBlock = startBlock;
  }

  public registerUserAddress(address: HexString, userId: UUID): void {
    this.addressToUser.set(address.toLowerCase() as HexString, userId);
  }

  public registerAssetAddress(contractAddress: HexString, assetId: UUID): void {
    this.assetAddressToId.set(contractAddress.toLowerCase() as HexString, assetId);
  }

  public onCredit(callback: LedgerCreditCallback): void {
    this.onCreditCallback = callback;
  }

  public async pollAndIndex(): Promise<{ newDeposits: number; creditedDeposits: number }> {
    const headBlock = await this.rpc.getLatestBlockNumber();
    if (headBlock < this.lastIndexedBlock) {
      return { newDeposits: 0, creditedDeposits: 0 };
    }

    const logs = await this.rpc.getDepositLogs(this.lastIndexedBlock, headBlock);
    let newDeposits = 0;
    let creditedDeposits = 0;

    // Ingest logs
    for (const log of logs) {
      const key = `${log.txHash}:${log.logIndex}`;
      if (!this.deposits.has(key)) {
        const userId = this.addressToUser.get(log.userAddress);
        const assetId = this.assetAddressToId.get(log.assetAddress);

        if (userId && assetId) {
          const deposit: TrackedDeposit = {
            id: uuidv7(),
            userId,
            chainId: this.rpc.chainId,
            txHash: log.txHash,
            logIndex: log.logIndex,
            blockNumber: log.blockNumber,
            amount: log.amount,
            assetId,
            status: 'pending',
            confirmations: 0,
          };
          this.deposits.set(key, deposit);
          newDeposits++;
        }
      }
    }

    // Update confirmations & credit
    for (const deposit of this.deposits.values()) {
      if (deposit.status !== 'credited') {
        const confirmations = Math.max(0, headBlock - deposit.blockNumber + 1);
        deposit.confirmations = confirmations;

        if (confirmations >= this.requiredConfirmations) {
          deposit.status = 'credited';
          deposit.creditedAt = new Date().toISOString();
          creditedDeposits++;

          if (this.onCreditCallback) {
            this.onCreditCallback(deposit.userId, deposit.assetId, deposit.amount, deposit.id);
          }
        } else if (confirmations > 0) {
          deposit.status = 'confirming';
        }
      }
    }

    this.lastIndexedBlock = headBlock + 1;
    return { newDeposits, creditedDeposits };
  }

  public getDeposit(txHash: HexString, logIndex = 0): TrackedDeposit | null {
    return this.deposits.get(`${txHash}:${logIndex}`) || null;
  }
}
