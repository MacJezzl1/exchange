import { AtomicAmount } from '@exchange/shared-types';
import { Candle, Ticker, DepthSnapshot } from './types';

export class MarketDataService {
  private readonly tickers = new Map<string, Ticker>();
  private readonly candles = new Map<string, Candle[]>(); // symbol:interval -> candles
  private readonly depths = new Map<string, DepthSnapshot>();

  public updateDepth(symbol: string, bids: [string, string][], asks: [string, string][], sequence: number): DepthSnapshot {
    const depth: DepthSnapshot = { bids, asks, sequence };
    this.depths.set(symbol, depth);
    return depth;
  }

  public getDepth(symbol: string): DepthSnapshot | null {
    return this.depths.get(symbol) || null;
  }

  public recordTrade(symbol: string, price: AtomicAmount, quantity: AtomicAmount, timestampMs = Date.now()): void {
    const priceBig = BigInt(price);
    const qtyBig = BigInt(quantity);

    // 1. Update Ticker
    let ticker = this.tickers.get(symbol);
    if (!ticker) {
      ticker = {
        marketId: '018e0000-0002-7000-8000-000000000001',
        symbol,
        lastPrice: price,
        high24h: price,
        low24h: price,
        volume24h: quantity,
        updatedAt: new Date(timestampMs).toISOString(),
      };
    } else {
      ticker.lastPrice = price;
      if (priceBig > BigInt(ticker.high24h)) ticker.high24h = price;
      if (priceBig < BigInt(ticker.low24h)) ticker.low24h = price;
      ticker.volume24h = (BigInt(ticker.volume24h) + qtyBig).toString();
      ticker.updatedAt = new Date(timestampMs).toISOString();
    }
    this.tickers.set(symbol, ticker);

    // 2. Aggregate 1-minute Candlestick
    const candleKey = `${symbol}:1m`;
    const intervalMs = 60000;
    const bucketOpen = Math.floor(timestampMs / intervalMs) * intervalMs;
    const bucketClose = bucketOpen + intervalMs - 1;

    let candleList = this.candles.get(candleKey) || [];
    let currentCandle = candleList[candleList.length - 1];

    if (!currentCandle || currentCandle.openTime !== bucketOpen) {
      currentCandle = {
        openTime: bucketOpen,
        closeTime: bucketClose,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: quantity,
      };
      candleList.push(currentCandle);
    } else {
      if (priceBig > BigInt(currentCandle.high)) currentCandle.high = price;
      if (priceBig < BigInt(currentCandle.low)) currentCandle.low = price;
      currentCandle.close = price;
      currentCandle.volume = (BigInt(currentCandle.volume) + qtyBig).toString();
    }

    this.candles.set(candleKey, candleList);
  }

  public getTicker(symbol: string): Ticker | null {
    return this.tickers.get(symbol) || null;
  }

  public getCandles(symbol: string, _interval = '1m'): Candle[] {
    return this.candles.get(`${symbol}:1m`) || [];
  }
}
