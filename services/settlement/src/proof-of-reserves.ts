import { AccountBalance, ProofOfReservesReport } from './types';
import { MerkleTree } from './merkle';

export class ProofOfReservesEngine {
  /**
   * Generates a cryptographic Proof-of-Reserves report.
   * Compares total off-chain liabilities (sum of all user ledger balances)
   * against verified on-chain Vault reserves.
   */
  public generateReport(
    userBalances: AccountBalance[],
    onChainReserves: Record<string, bigint> // assetAddress (lowercase) -> on-chain balance
  ): {
    report: ProofOfReservesReport;
    merkleTree: MerkleTree;
  } {
    const merkleTree = new MerkleTree(userBalances);
    const merkleRoot = merkleTree.getRoot();

    // Aggregate total liabilities per asset
    const liabilitiesMap = new Map<string, bigint>();
    for (const record of userBalances) {
      const asset = record.assetAddress.toLowerCase();
      const current = liabilitiesMap.get(asset) || 0n;
      liabilitiesMap.set(asset, current + record.balance);
    }

    const totalLiabilities: Record<string, string> = {};
    const totalReserves: Record<string, string> = {};
    const reserveRatios: Record<string, number> = {};
    let isSolvent = true;

    for (const [asset, liabilityBig] of liabilitiesMap.entries()) {
      totalLiabilities[asset] = liabilityBig.toString();
      const reserveBig = onChainReserves[asset] ?? 0n;
      totalReserves[asset] = reserveBig.toString();

      if (liabilityBig === 0n) {
        reserveRatios[asset] = 100.0;
      } else {
        // Compute ratio percentage with 2 decimal precision: (reserve * 10000 / liability) / 100
        const ratioBasisPoints = Number((reserveBig * 10000n) / liabilityBig);
        const ratioPct = ratioBasisPoints / 100;
        reserveRatios[asset] = ratioPct;

        if (reserveBig < liabilityBig) {
          isSolvent = false;
        }
      }
    }

    const report: ProofOfReservesReport = {
      timestamp: new Date().toISOString(),
      merkleRoot,
      totalLiabilities,
      totalReserves,
      reserveRatios,
      isSolvent,
      leafCount: userBalances.length,
    };

    return { report, merkleTree };
  }
}
