# Event Catalog: NATS JetStream Message Backbone

**Message Broker**: NATS JetStream  
**Serialization**: JSON / Canonical binary payload  
**Ordering Guarantees**: Per-market strict total order  
**Delivery Guarantees**: At-least-once with idempotent consumer processing  

---

## 1. Stream Hierarchy & Subject Taxonomy

Streams are partitioned logically by domain:
- `ORDERS`: Ingestion commands for matching (`orders.commands.>`)
- `ENGINE`: Deterministic engine execution events (`engine.events.>`)
- `LEDGER`: Financial double-entry journal postings (`ledger.events.>`)
- `CUSTODY`: On-chain chain watcher deposits and settlements (`custody.events.>`)
- `FIAT`: Fiat rails and payment status transitions (`fiat.events.>`)
- `MARKET`: Public market data distribution (`market.data.>`)

---

## 2. Event Definitions

### 2.1 Order Commands (`orders.commands.>`)

#### `orders.commands.place`
- **Publisher**: `trading` service
- **Subscriber**: `matching-engine`
- **Description**: Submits an authenticated order with a pre-trade balance hold placed by the ledger.
- **Payload Schema**:
  ```json
  {
    "order_id": "uuid",
    "user_id": "uuid",
    "market_id": "uuid",
    "symbol": "BTC-USDT",
    "side": "buy",
    "order_type": "limit",
    "price": "65000000000",
    "quantity": "10000000",
    "nonce": 1042,
    "expiry": 1775460000,
    "timestamp_ns": 1728210000000000000,
    "hold_id": "uuid"
  }
  ```

#### `orders.commands.cancel`
- **Publisher**: `trading` service
- **Subscriber**: `matching-engine`
- **Description**: Submits a user-signed or risk-triggered order cancellation.
- **Payload Schema**:
  ```json
  {
    "order_id": "uuid",
    "market_id": "uuid",
    "user_id": "uuid",
    "reason": "user_cancelled",
    "timestamp_ns": 1728210000000000000
  }
  ```

---

### 2.2 Matching Engine Events (`engine.events.>`)

#### `engine.events.{symbol}.order_accepted`
- **Publisher**: `matching-engine`
- **Subscribers**: `trading`, `market-data`
- **Description**: Order rested on the order book.
- **Payload Schema**:
  ```json
  {
    "sequence": 904210,
    "market_id": "uuid",
    "order_id": "uuid",
    "user_id": "uuid",
    "side": "buy",
    "price": "65000000000",
    "remaining_quantity": "10000000",
    "timestamp_ns": 1728210000000000000
  }
  ```

#### `engine.events.{symbol}.trade_executed`
- **Publisher**: `matching-engine`
- **Subscribers**: `ledger`, `settlement`, `market-data`, `trading`
- **Description**: Deterministic match between maker and taker orders.
- **Payload Schema**:
  ```json
  {
    "sequence": 904211,
    "trade_id": "uuid",
    "market_id": "uuid",
    "maker_order_id": "uuid",
    "taker_order_id": "uuid",
    "maker_user_id": "uuid",
    "taker_user_id": "uuid",
    "side": "buy",
    "price": "65000000000",
    "quantity": "5000000",
    "maker_fee": "65000",
    "taker_fee": "130000",
    "fee_asset_id": "uuid",
    "timestamp_ns": 1728210000000000000
  }
  ```

#### `engine.events.{symbol}.order_cancelled`
- **Publisher**: `matching-engine`
- **Subscribers**: `trading`, `ledger` (releases held balance)
- **Description**: Order removed from book.
- **Payload Schema**:
  ```json
  {
    "sequence": 904212,
    "market_id": "uuid",
    "order_id": "uuid",
    "user_id": "uuid",
    "unfilled_quantity": "5000000",
    "reason": "user_cancelled",
    "timestamp_ns": 1728210000000000000
  }
  ```

---

### 2.3 Custody & Settlement Events (`custody.events.>`)

#### `custody.events.deposit_confirmed`
- **Publisher**: `chain-watcher`
- **Subscriber**: `ledger`
- **Description**: Inbound on-chain deposit reached required block confirmations.
- **Payload Schema**:
  ```json
  {
    "deposit_id": "uuid",
    "user_id": "uuid",
    "chain_id": 84532,
    "asset_id": "uuid",
    "amount": "5000000000",
    "tx_hash": "0xabc...123",
    "block_number": 14209820,
    "timestamp": "2026-10-06T10:00:00Z"
  }
  ```

#### `custody.events.settlement_batch_confirmed`
- **Publisher**: `chain-watcher`
- **Subscribers**: `settlement`, `ledger`
- **Description**: Settlement batch successfully mined on Base L2.
- **Payload Schema**:
  ```json
  {
    "batch_id": "uuid",
    "batch_number": 402,
    "merkle_root": "0xdef...456",
    "tx_hash": "0x789...abc",
    "chain_id": 84532,
    "timestamp": "2026-10-06T10:01:00Z"
  }
  ```

---

### 2.4 Fiat Rails Events (`fiat.events.>`)

#### `fiat.events.deposit_completed`
- **Publisher**: `custody-fiat`
- **Subscriber**: `ledger`
- **Description**: Inbound fiat payment received from Stitch/M-Pesa.
- **Payload Schema**:
  ```json
  {
    "deposit_id": "uuid",
    "user_id": "uuid",
    "provider_id": "uuid",
    "asset_id": "uuid",
    "amount": "250000",
    "external_reference": "STITCH-REF-992",
    "timestamp": "2026-10-06T10:00:00Z"
  }
  ```

#### `fiat.events.withdrawal_requested`
- **Publisher**: `custody-fiat`
- **Subscriber**: `admin-api` (triggers approval queue)
- **Description**: Outbound fiat withdrawal initiated requiring compliance review.
