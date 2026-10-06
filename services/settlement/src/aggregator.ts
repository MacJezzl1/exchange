import { BalanceDelta, MatchedTradeInput } from './types';

export class BatchAggregator {
  /**
   * Compresses an array of matched trades into net balance deltas across all participant accounts.
   * Netting eliminates redundant intermediate transfers, reducing on-chain gas costs by up to 90%.
   */
  public aggregateTrades(
    trades: MatchedTradeInput[],
    platformFeeAddress = '0x000000000000000000000000000000000000dEaD'
  ): {
    deltas: BalanceDelta[];
    totalVolumeBase: bigint;
    totalVolumeQuote: bigint;
    totalFeesCollected: bigint;
    tradeCount: number;
  } {
    // Map: `${userAddress.toLowerCase()}:${assetAddress.toLowerCase()}` -> delta (bigint)
    const netDeltas = new Map<string, bigint>();

    let totalVolumeBase = 0n;
    let totalVolumeQuote = 0n;
    let totalFeesCollected = 0n;

    for (const trade of trades) {
      const baseQty = BigInt(trade.quantity);
      const price = BigInt(trade.price);
      const quoteGross = baseQty * price;
      const buyerFee = BigInt(trade.buyerFee);
      const sellerFee = BigInt(trade.sellerFee);

      totalVolumeBase += baseQty;
      totalVolumeQuote += quoteGross;
      totalFeesCollected += buyerFee + sellerFee;

      // 1. Buyer:
      // + Base Asset (receives full baseQty)
      // - Quote Asset (pays quoteGross + buyerFee)
      this.addDelta(netDeltas, trade.buyerAddress, trade.baseAssetAddress, baseQty);
      this.addDelta(netDeltas, trade.buyerAddress, trade.quoteAssetAddress, -(quoteGross + buyerFee));

      // 2. Seller:
      // - Base Asset (sells baseQty)
      // + Quote Asset (receives quoteGross - sellerFee)
      this.addDelta(netDeltas, trade.sellerAddress, trade.baseAssetAddress, -baseQty);
      this.addDelta(netDeltas, trade.sellerAddress, trade.quoteAssetAddress, quoteGross - sellerFee);

      // 3. Platform Fee Account:
      // + Quote Asset (collects buyerFee + sellerFee)
      this.addDelta(netDeltas, platformFeeAddress, trade.quoteAssetAddress, buyerFee + sellerFee);
    }

    // Convert map to BalanceDelta array, filtering out net 0 deltas
    const deltas: BalanceDelta[] = [];
    for (const [key, delta] of netDeltas.entries()) {
      if (delta === 0n) continue;
      const [userAddress, assetAddress] = key.split(':');
      if (userAddress && assetAddress) {
        deltas.push({ userAddress, assetAddress, delta });
      }
    }

    // Verify conservation invariant across each asset: sum(deltas) must be exactly 0
    this.verifyConservation(deltas);

    return {
      deltas,
      totalVolumeBase,
      totalVolumeQuote,
      totalFeesCollected,
      tradeCount: trades.length,
    };
  }

  private addDelta(map: Map<string, bigint>, user: string, asset: string, amount: bigint): void {
    const key = `${user.toLowerCase()}:${asset.toLowerCase()}`;
    const current = map.get(key) || 0n;
    map.set(key, current + amount);
  }

  private verifyConservation(deltas: BalanceDelta[]): void {
    const assetSums = new Map<string, bigint>();
    for (const delta of deltas) {
      const a = delta.assetAddress.toLowerCase();
      const current = assetSums.get(a) || 0n;
      assetSums.set(a, current + delta.delta);
    }

    for (const [asset, sum] of assetSums.entries()) {
      if (sum !== 0n) {
        throw new Error(
          `Netting invariant violation: asset ${asset} does not balance to zero! Sum is ${sum.toString()}`
        );
      }
    }
  }
}
