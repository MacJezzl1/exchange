import {
  Order,
  Market,
  OnchainDeposit,
  OnchainWithdrawal,
  UUID,
  OrderSide,
  OrderType,
  AtomicAmount,
  HexString,
} from '@exchange/shared-types';

export interface ExchangeClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
}

export class ExchangeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string | undefined;

  constructor(options: ExchangeClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  public async getMarkets(): Promise<Market[]> {
    return this.request<Market[]>('/api/v1/markets');
  }

  public async getOrderBook(symbol: string): Promise<{
    bids: [string, string][];
    asks: [string, string][];
    sequence: number;
  }> {
    return this.request(`/api/v1/markets/${symbol}/depth`);
  }

  public async submitOrder(order: {
    marketId: UUID;
    side: OrderSide;
    orderType: OrderType;
    price: AtomicAmount;
    quantity: AtomicAmount;
    nonce: number;
    expiry: number;
    signature: HexString;
  }): Promise<Order> {
    return this.request<Order>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  public async cancelOrder(orderId: UUID): Promise<{ success: boolean; id: UUID }> {
    return this.request(`/api/v1/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  public async getDeposits(): Promise<OnchainDeposit[]> {
    return this.request<OnchainDeposit[]>('/api/v1/account/deposits');
  }

  public async getWithdrawals(): Promise<OnchainWithdrawal[]> {
    return this.request<OnchainWithdrawal[]>('/api/v1/account/withdrawals');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['X-API-KEY'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error [${response.status}]: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }
}
