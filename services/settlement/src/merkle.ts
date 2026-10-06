import { createHash } from 'crypto';
import { AccountBalance, MerkleProof } from './types';

export function hashLeaf(userAddress: string, assetAddress: string, balance: bigint): string {
  // Canonical leaf hash: SHA-256(userAddress.toLowerCase() + ':' + assetAddress.toLowerCase() + ':' + balance.toString())
  const payload = `${userAddress.toLowerCase()}:${assetAddress.toLowerCase()}:${balance.toString()}`;
  return createHash('sha256').update(payload).digest('hex');
}

export function hashNodes(left: string, right: string): string {
  // Sort pairs to ensure commutative canonical ordering (prevents order-dependent vulnerabilities)
  const [first, second] = left <= right ? [left, right] : [right, left];
  return createHash('sha256').update(first + second).digest('hex');
}

export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];
  private readonly accounts: AccountBalance[] = [];

  constructor(accounts: AccountBalance[]) {
    // Sort accounts deterministically by userAddress then assetAddress
    this.accounts = [...accounts].sort((a, b) => {
      const uComp = a.userAddress.toLowerCase().localeCompare(b.userAddress.toLowerCase());
      if (uComp !== 0) return uComp;
      return a.assetAddress.toLowerCase().localeCompare(b.assetAddress.toLowerCase());
    });

    this.buildTree();
  }

  private buildTree(): void {
    if (this.accounts.length === 0) {
      const emptyHash = createHash('sha256').update('empty_tree').digest('hex');
      this.leaves = [emptyHash];
      this.layers = [[emptyHash]];
      return;
    }

    this.leaves = this.accounts.map((acc) => hashLeaf(acc.userAddress, acc.assetAddress, acc.balance));
    this.layers = [this.leaves];

    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i]!;
        if (i + 1 < currentLayer.length) {
          const right = currentLayer[i + 1]!;
          nextLayer.push(hashNodes(left, right));
        } else {
          // Odd element: duplicate to form pair (standard binary Merkle tree)
          nextLayer.push(hashNodes(left, left));
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    const topLayer = this.layers[this.layers.length - 1];
    return topLayer && topLayer[0] ? topLayer[0] : '';
  }

  public getProofForAccount(userAddress: string, assetAddress: string): MerkleProof | null {
    const targetIdx = this.accounts.findIndex(
      (acc) =>
        acc.userAddress.toLowerCase() === userAddress.toLowerCase() &&
        acc.assetAddress.toLowerCase() === assetAddress.toLowerCase()
    );

    if (targetIdx === -1) {
      return null;
    }

    const targetAccount = this.accounts[targetIdx]!;
    const leaf = this.leaves[targetIdx]!;
    const siblings: string[] = [];

    let currentIdx = targetIdx;
    for (let layerIdx = 0; layerIdx < this.layers.length - 1; layerIdx++) {
      const layer = this.layers[layerIdx]!;
      const isEven = currentIdx % 2 === 0;
      const siblingIdx = isEven ? currentIdx + 1 : currentIdx - 1;

      if (siblingIdx < layer.length) {
        siblings.push(layer[siblingIdx]!);
      } else {
        // Paired with self
        siblings.push(layer[currentIdx]!);
      }

      currentIdx = Math.floor(currentIdx / 2);
    }

    return {
      userAddress: targetAccount.userAddress,
      assetAddress: targetAccount.assetAddress,
      balance: targetAccount.balance.toString(),
      leaf,
      siblings,
      root: this.getRoot(),
    };
  }

  public static verifyProof(proof: MerkleProof): boolean {
    const computedLeaf = hashLeaf(proof.userAddress, proof.assetAddress, BigInt(proof.balance));
    if (computedLeaf !== proof.leaf) {
      return false;
    }

    let currentHash = proof.leaf;
    for (const sibling of proof.siblings) {
      currentHash = hashNodes(currentHash, sibling);
    }

    return currentHash === proof.root;
  }
}
