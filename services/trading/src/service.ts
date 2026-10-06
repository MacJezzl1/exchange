import { v7 as uuidv7 } from 'uuid';
import { UUID, AtomicAmount } from '@exchange/shared-types';
import { LedgerService } from '@exchange/ledger';
import { MatchingEngineCore, InternalOrder, EngineEvent } from './engine';
import { PlaceOrderInput, MarketConfig } from './types';

export class TradingService {
  private readonly ledger: LedgerService;
  private readonly markets = new Map<UUID, MarketConfig>();
  private readonly engines = new Map<UUID, MatchingEngineCore>();
  private readonly userOrderNonces = new Map<UUID, Set<number>>();
  private readonly orderHolds = new Map<UUID, UUID>(); // orderId -> holdId

  constructor(ledger: LedgerService) {
    this.ledger = ledger;
  }

  public registerMarket(config: MarketConfig): void {
    this.markets.set(config.id, config);
    this.engines.set(config.id, new MatchingEngineCore(config.id));
  }

  public getMarket(marketId: UUID): MarketConfig | null {
    return this.markets.get(marketId) || null;
  }

  public getEngine(marketId: UUID): MatchingEngineCore | null {
    return this.engines.get(marketId) || null;
  }

  /**
   * Validates and submits an order into the deterministic matching engine.
   */
  public submitOrder(input: PlaceOrderInput): { orderId: UUID; events: EngineEvent[] } {
    const market = this.markets.get(input.marketId);
    if (!market) {
      throw new Error(`Market ${input.marketId} not found`);
    }

    if (market.isHalted) {
      throw new Error(`Market ${market.symbol} is currently halted by circuit breaker`);
    }

    if (input.expiry <= Math.floor(Date.now() / 1000)) {
      throw new Error('Order expired');
    }

    // Verify nonce uniqueness per user
    const nonces = this.userOrderNonces.get(input.userId) || new Set<number>();
    if (nonces.has(input.nonce)) {
      throw new Error(`Order nonce ${input.nonce} has already been used by user`);
    }
    nonces.add(input.nonce);
    this.userOrderNonces.set(input.userId, nonces);

    const price = BigInt(input.price);
    const quantity = BigInt(input.quantity);

    if (quantity < market.minOrderSize || quantity > market.maxOrderSize) {
      throw new Error(`Order quantity outside lot limits [${market.minOrderSize}, ${market.maxOrderSize}]`);
    }

    // Pre-trade Balance Hold in Double-Entry Ledger
    const orderId = uuidv7();
    let holdAssetId: UUID;
    let holdAmount: AtomicAmount;

    if (input.side === 'buy') {
      holdAssetId = market.quoteAssetId;
      const quoteGross = price * quantity;
      const feeBuffer = (quoteGross * BigInt(market.takerFeeBps)) / 10000n;
      holdAmount = (quoteGross + feeBuffer).toString();
    } else {
      holdAssetId = market.baseAssetId;
      holdAmount = quantity.toString(); // Hold full base asset to sell
    }

    const hold = this.ledger.placeHold(
      input.userId,
      holdAssetId,
      holdAmount,
      `Order hold for ${market.symbol} ${input.side}`,
      orderId
    );
    this.orderHolds.set(orderId, hold.id);

    const internalOrder: InternalOrder = {
      id: orderId,
      userId: input.userId,
      marketId: input.marketId,
      side: input.side,
      orderType: input.orderType,
      price,
      quantity,
      remainingQuantity: quantity,
      timestampNs: Date.now() * 1000000,
    };

    const engine = this.engines.get(input.marketId)!;
    const events = engine.processOrder(internalOrder);

    // Process engine events (settlement & fee postings in double-entry ledger)
    for (const event of events) {
      if (event.type === 'TradeExecuted') {
        this.settleTradeInLedger(market, event.trade);
      } else if (event.type === 'OrderCancelled') {
        // Release remaining hold
        const holdId = this.orderHolds.get(event.orderId);
        if (holdId) {
          this.ledger.releaseHold(holdId);
        }
      }
    }

    return { orderId, events };
  }

  /**
   * Settles a matched trade across maker, taker, and platform fee accounts.
   */
  private settleTradeInLedger(market: MarketConfig, trade: any): void {
    const tradeQty = BigInt(trade.quantity);
    const execPrice = BigInt(trade.price);
    const quoteGross = tradeQty * execPrice;

    // Fees calculation
    // Maker fee: 10 bps = 0.10% (quoteGross * 10 / 10000)
    // Taker fee: 20 bps = 0.20% (quoteGross * 20 / 10000)
    const makerFee = (quoteGross * BigInt(market.makerFeeBps)) / 10000n;
    const takerFee = (quoteGross * BigInt(market.takerFeeBps)) / 10000n;

    // Accounts
    const makerUser = trade.makerUserId;
    const takerUser = trade.takerUserId;

    const baseAsset = market.baseAssetId;
    const quoteAsset = market.quoteAssetId;

    // System fee account for quote currency
    const systemFeeAcc = this.ledger.createAccount(null, quoteAsset, 'system_fee');

    // Trade Side: If taker is BUYER, maker was SELLER
    let buyerUserId: UUID;
    let sellerUserId: UUID;
    let buyerFee: bigint;
    let sellerFee: bigint;

    if (trade.side === 'buy') {
      buyerUserId = takerUser;
      sellerUserId = makerUser;
      buyerFee = takerFee;
      sellerFee = makerFee;
    } else {
      buyerUserId = makerUser;
      sellerUserId = takerUser;
      buyerFee = makerFee;
      sellerFee = takerFee;
    }

    // Buyer accounts
    const buyerHeldQuote = this.ledger.getUserAccount(buyerUserId, quoteAsset, 'user_held')!;
    const buyerAvailBase = this.ledger.getOrCreateUserAccount(buyerUserId, baseAsset, 'user_available');

    // Seller accounts
    const sellerHeldBase = this.ledger.getUserAccount(sellerUserId, baseAsset, 'user_held')!;
    const sellerAvailQuote = this.ledger.getOrCreateUserAccount(sellerUserId, quoteAsset, 'user_available');

    // 1. Leg A: Base asset transfer (Seller Held Base -> Buyer Avail Base)
    this.ledger.postJournalEntry({
      referenceType: 'trade',
      referenceId: trade.tradeId,
      description: `Trade settlement base asset transfer ${trade.tradeId}`,
      lines: [
        { accountId: sellerHeldBase.id, debit: tradeQty.toString(), credit: '0' },
        { accountId: buyerAvailBase.id, debit: '0', credit: tradeQty.toString() },
      ],
    });

    // 2. Leg B: Quote asset transfer (Buyer Held Quote -> Seller Avail Quote + Fees)
    // Net quote to seller = quoteGross - sellerFee
    const netSellerQuote = quoteGross - sellerFee;
    const totalFees = buyerFee + sellerFee;

    this.ledger.postJournalEntry({
      referenceType: 'trade',
      referenceId: trade.tradeId,
      description: `Trade settlement quote asset & fees ${trade.tradeId}`,
      lines: [
        { accountId: buyerHeldQuote.id, debit: (quoteGross + buyerFee).toString(), credit: '0' },
        { accountId: sellerAvailQuote.id, debit: '0', credit: netSellerQuote.toString() },
        { accountId: systemFeeAcc.id, debit: '0', credit: totalFees.toString() },
      ],
    });

    const buyerFeeBuffer = (quoteGross * BigInt(market.takerFeeBps)) / 10000n;
    const unusedHold = buyerFeeBuffer - buyerFee;
    if (unusedHold > 0n) {
      this.ledger.postJournalEntry({
        referenceType: 'release',
        referenceId: trade.tradeId,
        description: `Release unused fee buffer for ${trade.tradeId}`,
        lines: [
          { accountId: buyerHeldQuote.id, debit: unusedHold.toString(), credit: '0' },
          { accountId: this.ledger.getOrCreateUserAccount(buyerUserId, quoteAsset, 'user_available').id, debit: '0', credit: unusedHold.toString() },
        ],
      });
    }
  }
}
