import { UUID } from '@exchange/shared-types';

export interface AuctionOrder {
  id: UUID;
  userId: string;
  side: 'buy' | 'sell';
  price: bigint;
  quantity: bigint;
  timestampNs: number;
}

export interface AuctionFill {
  orderId: UUID;
  userId: string;
  side: 'buy' | 'sell';
  fillQuantity: bigint;
  clearingPrice: bigint;
}

export interface AuctionResult {
  epochId: number;
  clearingPrice: bigint;
  clearingVolume: bigint;
  fills: AuctionFill[];
  unfilledOrders: UUID[];
}

export class FrequentBatchAuctionEngine {
  private currentEpoch = 1;
  private pendingOrders: AuctionOrder[] = [];

  public submitOrder(order: AuctionOrder): void {
    this.pendingOrders.push(order);
  }

  public clearEpoch(): AuctionResult {
    const epochId = this.currentEpoch++;
    const orders = [...this.pendingOrders];
    this.pendingOrders = [];

    const bids = orders.filter((o) => o.side === 'buy');
    const asks = orders.filter((o) => o.side === 'sell');

    if (bids.length === 0 || asks.length === 0) {
      return {
        epochId,
        clearingPrice: 0n,
        clearingVolume: 0n,
        fills: [],
        unfilledOrders: orders.map((o) => o.id),
      };
    }

    // Collect all discrete candidate prices from orders
    const priceSet = new Set<bigint>();
    for (const b of bids) priceSet.add(b.price);
    for (const a of asks) priceSet.add(a.price);

    const candidatePrices = Array.from(priceSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    let maxMatchVolume = 0n;
    let bestPrices: bigint[] = [];

    // Evaluate executable volume at each candidate price
    for (const price of candidatePrices) {
      // Cumulative demand at this price: bids with price >= price
      let demand = 0n;
      for (const b of bids) {
        if (b.price >= price) {
          demand += b.quantity;
        }
      }

      // Cumulative supply at this price: asks with price <= price
      let supply = 0n;
      for (const a of asks) {
        if (a.price <= price) {
          supply += a.quantity;
        }
      }

      const matchedVolume = demand < supply ? demand : supply;

      if (matchedVolume > maxMatchVolume) {
        maxMatchVolume = matchedVolume;
        bestPrices = [price];
      } else if (matchedVolume === maxMatchVolume && matchedVolume > 0n) {
        bestPrices.push(price);
      }
    }

    if (maxMatchVolume === 0n || bestPrices.length === 0) {
      return {
        epochId,
        clearingPrice: 0n,
        clearingVolume: 0n,
        fills: [],
        unfilledOrders: orders.map((o) => o.id),
      };
    }

    // Midpoint of optimal clearing prices
    const minP = bestPrices[0]!;
    const maxP = bestPrices[bestPrices.length - 1]!;
    const clearingPrice = (minP + maxP) / 2n;

    // Allocate fills uniformly at clearingPrice
    const fills: AuctionFill[] = [];
    const filledOrderIds = new Set<UUID>();

    // Winning bids: price >= clearingPrice
    const winningBids = bids
      .filter((b) => b.price >= clearingPrice)
      .sort((a, b) => (b.price !== a.price ? (b.price > a.price ? 1 : -1) : a.timestampNs - b.timestampNs));

    // Winning asks: price <= clearingPrice
    const winningAsks = asks
      .filter((a) => a.price <= clearingPrice)
      .sort((a, b) => (a.price !== b.price ? (a.price < b.price ? 1 : -1) : a.timestampNs - b.timestampNs));

    let remainingBidFillCapacity = maxMatchVolume;
    for (const b of winningBids) {
      if (remainingBidFillCapacity <= 0n) break;
      const fillQty = b.quantity <= remainingBidFillCapacity ? b.quantity : remainingBidFillCapacity;
      fills.push({
        orderId: b.id,
        userId: b.userId,
        side: 'buy',
        fillQuantity: fillQty,
        clearingPrice,
      });
      remainingBidFillCapacity -= fillQty;
      filledOrderIds.add(b.id);
    }

    let remainingAskFillCapacity = maxMatchVolume;
    for (const a of winningAsks) {
      if (remainingAskFillCapacity <= 0n) break;
      const fillQty = a.quantity <= remainingAskFillCapacity ? a.quantity : remainingAskFillCapacity;
      fills.push({
        orderId: a.id,
        userId: a.userId,
        side: 'sell',
        fillQuantity: fillQty,
        clearingPrice,
      });
      remainingAskFillCapacity -= fillQty;
      filledOrderIds.add(a.id);
    }

    const unfilledOrders = orders.filter((o) => !filledOrderIds.has(o.id)).map((o) => o.id);

    return {
      epochId,
      clearingPrice,
      clearingVolume: maxMatchVolume,
      fills,
      unfilledOrders,
    };
  }
}
