import { HexString } from '@exchange/shared-types';
import { OnchainDepositLog } from './types';

/**
 * Provider-agnostic interface for Blockchain JSON-RPC interactions
 * (e.g. Alchemy, Infura, QuickNode, or self-hosted Base L2 nodes via viem).
 *
 * TO SWAP IN PRODUCTION BASE L2 RPC:
 * 1. Implement this interface using `createPublicClient` from `viem` with `http(process.env.RPC_URL)`.
 * 2. Watch contract logs via `getLogs` on `Vault.sol` Deposit events.
 */
export interface ChainRpcAdapter {
  readonly chainId: number;
  getLatestBlockNumber(): Promise<number>;
  getDepositLogs(fromBlock: number, toBlock: number): Promise<OnchainDepositLog[]>;
}

export class MockChainRpcAdapter implements ChainRpcAdapter {
  public readonly chainId: number;
  private currentBlock: number;
  private readonly mockLogs: OnchainDepositLog[] = [];

  constructor(chainId = 84532, initialBlock = 1000) {
    this.chainId = chainId;
    this.currentBlock = initialBlock;
  }

  public async getLatestBlockNumber(): Promise<number> {
    return this.currentBlock;
  }

  public advanceBlocks(count = 1): number {
    this.currentBlock += count;
    return this.currentBlock;
  }

  public emitDeposit(
    txHash: HexString,
    userAddress: HexString,
    assetAddress: HexString,
    amount: string,
    nonce: number
  ): OnchainDepositLog {
    const log: OnchainDepositLog = {
      txHash,
      logIndex: 0,
      blockNumber: this.currentBlock,
      userAddress: userAddress.toLowerCase() as HexString,
      assetAddress: assetAddress.toLowerCase() as HexString,
      amount,
      nonce,
      timestamp: new Date().toISOString(),
    };
    this.mockLogs.push(log);
    return log;
  }

  public async getDepositLogs(fromBlock: number, toBlock: number): Promise<OnchainDepositLog[]> {
    return this.mockLogs.filter(
      (l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock
    );
  }
}
