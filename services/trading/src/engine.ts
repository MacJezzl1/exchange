import { v7 as uuidv7 } from 'uuid';
import { UUID, AtomicAmount, OrderSide, OrderType } from '@exchange/shared-types';

export interface InternalOrder {
  id: UUID;
  userId: UUID;
  marketId: UUID;
  side: OrderSide;
  orderType: OrderType;
  price: bigint; // Atomic quote units per lot
  quantity: bigint; // Atomic base units
  remainingQuantity: bigint;
  timestampNs: number;
}

export interface InternalTrade {
  tradeId: UUID;
  sequence: number;
  marketId: UUID;
  makerOrderId: UUID;
  takerOrderId: UUID;
  makerUserId: UUID;
  takerUserId: UUID;
  side: OrderSide;
  price: AtomicAmount;
  quantity: AtomicAmount;
  quoteAmount: AtomicAmount;
  timestampNs: number;
}

export type EngineEvent =
  | { type: 'OrderAccepted'; sequence: number; order: InternalOrder }
  | { type: 'TradeExecuted'; sequence: number; trade: InternalTrade }
  | { type: 'OrderCancelled'; sequence: number; orderId: UUID; reason: string };

export class MatchingEngineCore {
  public readonly marketId: UUID;
  public sequence = 0;
  // Bids: descending price order (Map keys sorted manually)
  public readonly bids = new Map<bigint, InternalOrder[]>();
  // Asks: ascending price order
  public readonly asks = new Map<bigint, InternalOrder[]>();
  public readonly orders = new Map<UUID, InternalOrder>();

  constructor(marketId: UUID) {
    this.marketId = marketId;
  }

  public processOrder(order: InternalOrder): EngineEvent[] {
    const events: EngineEvent[] = [];

    // 1. PostOnly check
    if (order.orderType === 'post_only') {
      const bestAsk = this.getBestAsk();
      const bestBid = this.getBestBid();
      const wouldCross =
        (order.side === 'buy' && bestAsk !== null && order.price >= bestAsk) ||
        (order.side === 'sell' && bestBid !== null && order.price <= bestBid);

      if (wouldCross) {
        this.sequence++;
        events.push({
          type: 'OrderCancelled',
          sequence: this.sequence,
          orderId: order.id,
          reason: 'post_only_would_cross',
        });
        return events;
      }
    }

    // 2. FillOrKill check
    if (order.orderType === 'fok') {
      if (!this.canFillCompletely(order)) {
        this.sequence++;
        events.push({
          type: 'OrderCancelled',
          sequence: this.sequence,
          orderId: order.id,
          reason: 'fok_insufficient_liquidity',
        });
        return events;
      }
    }

    // 3. Match against opposing book
    if (order.side === 'buy') {
      while (order.remainingQuantity > 0n) {
        const bestAskPrice = this.getBestAsk();
        if (bestAskPrice === null) break;

        if (order.orderType === 'limit' && order.price < bestAskPrice) {
          break; // Buy limit price is below best ask -> rest on book
        }

        const askQueue = this.asks.get(bestAskPrice)!;
        const makerOrder = askQueue[0]!;

        const matchQty =
          order.remainingQuantity < makerOrder.remainingQuantity
            ? order.remainingQuantity
            : makerOrder.remainingQuantity;

        const execPrice = makerOrder.price; // Maker sets continuous trading price
        const quoteAmount = (matchQty * execPrice).toString();

        order.remainingQuantity -= matchQty;
        makerOrder.remainingQuantity -= matchQty;

        this.sequence++;
        events.push({
          type: 'TradeExecuted',
          sequence: this.sequence,
          trade: {
            tradeId: uuidv7(),
            sequence: this.sequence,
            marketId: this.marketId,
            makerOrderId: makerOrder.id,
            takerOrderId: order.id,
            makerUserId: makerOrder.userId,
            takerUserId: order.userId,
            side: 'buy',
            price: execPrice.toString(),
            quantity: matchQty.toString(),
            quoteAmount,
            timestampNs: order.timestampNs,
          },
        });

        if (makerOrder.remainingQuantity === 0n) {
          askQueue.shift();
          this.orders.delete(makerOrder.id);
          if (askQueue.length === 0) {
            this.asks.delete(bestAskPrice);
          }
        }
      }
    } else {
      // Sell order
      while (order.remainingQuantity > 0n) {
        const bestBidPrice = this.getBestBid();
        if (bestBidPrice === null) break;

        if (order.orderType === 'limit' && order.price > bestBidPrice) {
          break; // Sell limit price is above best bid -> rest on book
        }

        const bidQueue = this.bids.get(bestBidPrice)!;
        const makerOrder = bidQueue[0]!;

        const matchQty =
          order.remainingQuantity < makerOrder.remainingQuantity
            ? order.remainingQuantity
            : makerOrder.remainingQuantity;

        const execPrice = makerOrder.price;
        const quoteAmount = (matchQty * execPrice).toString();

        order.remainingQuantity -= matchQty;
        makerOrder.remainingQuantity -= matchQty;

        this.sequence++;
        events.push({
          type: 'TradeExecuted',
          sequence: this.sequence,
          trade: {
            tradeId: uuidv7(),
            sequence: this.sequence,
            marketId: this.marketId,
            makerOrderId: makerOrder.id,
            takerOrderId: order.id,
            makerUserId: makerOrder.userId,
            takerUserId: order.userId,
            side: 'sell',
            price: execPrice.toString(),
            quantity: matchQty.toString(),
            quoteAmount,
            timestampNs: order.timestampNs,
          },
        });

        if (makerOrder.remainingQuantity === 0n) {
          bidQueue.shift();
          this.orders.delete(makerOrder.id);
          if (bidQueue.length === 0) {
            this.bids.delete(bestBidPrice);
          }
        }
      }
    }

    // 4. Handle unfilled remainder
    if (order.remainingQuantity > 0n) {
      if (order.orderType === 'ioc' || order.orderType === 'market') {
        this.sequence++;
        events.push({
          type: 'OrderCancelled',
          sequence: this.sequence,
          orderId: order.id,
          reason: 'ioc_remainder_cancelled',
        });
      } else {
        // Rest on book
        this.sequence++;
        events.push({
          type: 'OrderAccepted',
          sequence: this.sequence,
          order: { ...order },
        });
        this.orders.set(order.id, { ...order });

        const book = order.side === 'buy' ? this.bids : this.asks;
        const queue = book.get(order.price) || [];
        queue.push({ ...order });
        book.set(order.price, queue);
      }
    }

    return events;
  }

  public cancelOrder(orderId: UUID, reason = 'user_cancelled'): EngineEvent | null {
    const order = this.orders.get(orderId);
    if (!order) return null;

    this.orders.delete(orderId);
    const book = order.side === 'buy' ? this.bids : this.asks;
    const queue = book.get(order.price);
    if (queue) {
      const idx = queue.findIndex((o) => o.id === orderId);
      if (idx !== -1) queue.splice(idx, 1);
      if (queue.length === 0) book.delete(order.price);
    }

    this.sequence++;
    return {
      type: 'OrderCancelled',
      sequence: this.sequence,
      orderId,
      reason,
    };
  }

  public getBestBid(): bigint | null {
    const prices = Array.from(this.bids.keys()).filter((p) => (this.bids.get(p)?.length || 0) > 0);
    if (prices.length === 0) return null;
    return prices.sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))[0]!;
  }

  public getBestAsk(): bigint | null {
    const prices = Array.from(this.asks.keys()).filter((p) => (this.asks.get(p)?.length || 0) > 0);
    if (prices.length === 0) return null;
    return prices.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))[0]!;
  }

  public getDepth(levels = 20): { bids: [string, string][]; asks: [string, string][] } {
    const sortedBids = Array.from(this.bids.keys())
      .filter((p) => (this.bids.get(p)?.length || 0) > 0)
      .sort((a, b) => (b > a ? 1 : b < a ? -1 : 0))
      .slice(0, levels)
      .map((price) => {
        const queue = this.bids.get(price)!;
        const totalQty = queue.reduce((sum, o) => sum + o.remainingQuantity, 0n);
        return [price.toString(), totalQty.toString()] as [string, string];
      });

    const sortedAsks = Array.from(this.asks.keys())
      .filter((p) => (this.asks.get(p)?.length || 0) > 0)
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .slice(0, levels)
      .map((price) => {
        const queue = this.asks.get(price)!;
        const totalQty = queue.reduce((sum, o) => sum + o.remainingQuantity, 0n);
        return [price.toString(), totalQty.toString()] as [string, string];
      });

    return { bids: sortedBids, asks: sortedAsks };
  }

  private canFillCompletely(order: InternalOrder): boolean {
    let needed = order.quantity;
    if (order.side === 'buy') {
      const askPrices = Array.from(this.asks.keys()).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
      for (const price of askPrices) {
        if (order.orderType === 'limit' && price > order.price) break;
        const queue = this.asks.get(price)!;
        for (const maker of queue) {
          if (needed <= maker.remainingQuantity) return true;
          needed -= maker.remainingQuantity;
        }
      }
    } else {
      const bidPrices = Array.from(this.bids.keys()).sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
      for (const price of bidPrices) {
        if (order.orderType === 'limit' && price < order.price) break;
        const queue = this.bids.get(price)!;
        for (const maker of queue) {
          if (needed <= maker.remainingQuantity) return true;
          needed -= maker.remainingQuantity;
        }
      }
    }
    return false;
  }
}
