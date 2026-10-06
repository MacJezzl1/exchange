-- ==============================================================================
-- Migration: 000004_trading_and_market.sql
-- Domains: market, trading
-- Required Tables:
--   market: market, candle
--   trading: fee_schedule, order, order_event, trade, settlement_batch, settlement_item
-- Rollback note: DROP TABLE trading.settlement_item, trading.settlement_batch, ...
-- ==============================================================================

-- Enums
CREATE TYPE trading.order_side AS ENUM ('buy', 'sell');
CREATE TYPE trading.order_type AS ENUM (
    'limit',
    'market',
    'stop',
    'stop_limit',
    'post_only',
    'ioc',
    'fok',
    'twap',
    'iceberg'
);
CREATE TYPE trading.order_status AS ENUM (
    'open',
    'partially_filled',
    'filled',
    'cancelled',
    'rejected',
    'expired'
);
CREATE TYPE trading.order_event_type AS ENUM (
    'placed',
    'accepted',
    'matched',
    'cancelled',
    'expired',
    'rejected'
);
CREATE TYPE trading.settlement_batch_status AS ENUM (
    'pending',
    'submitted',
    'confirmed',
    'failed'
);

-- 1. Table: market.market
CREATE TABLE market.market (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    symbol varchar(30) NOT NULL UNIQUE, -- e.g. 'BTC-USDT', 'USDT-ZAR'
    base_asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    quote_asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    tick_size numeric(38,0) NOT NULL CHECK (tick_size > 0),
    lot_size numeric(38,0) NOT NULL CHECK (lot_size > 0),
    min_order_size numeric(38,0) NOT NULL CHECK (min_order_size > 0),
    max_order_size numeric(38,0) NOT NULL CHECK (max_order_size >= min_order_size),
    maker_fee_bps smallint NOT NULL DEFAULT 10 CHECK (maker_fee_bps >= 0),
    taker_fee_bps smallint NOT NULL DEFAULT 20 CHECK (taker_fee_bps >= 0),
    price_band_pct numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (price_band_pct > 0),
    is_active boolean NOT NULL DEFAULT true,
    is_halted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_market_distinct_assets CHECK (base_asset_id <> quote_asset_id)
);

CREATE TRIGGER trg_market_market_updated_at
BEFORE UPDATE ON market.market
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: market.candle
CREATE TABLE market.candle (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    market_id uuid NOT NULL REFERENCES market.market(id) ON DELETE RESTRICT,
    resolution varchar(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    open_time timestamptz NOT NULL,
    close_time timestamptz NOT NULL,
    open_price numeric(38,0) NOT NULL,
    high_price numeric(38,0) NOT NULL,
    low_price numeric(38,0) NOT NULL,
    close_price numeric(38,0) NOT NULL,
    base_volume numeric(38,0) NOT NULL DEFAULT 0,
    quote_volume numeric(38,0) NOT NULL DEFAULT 0,
    trade_count integer NOT NULL DEFAULT 0,
    CONSTRAINT uq_market_candle_interval UNIQUE (market_id, resolution, open_time)
);

CREATE INDEX idx_market_candle_lookup ON market.candle(market_id, resolution, open_time DESC);

-- 3. Table: trading.fee_schedule
CREATE TABLE trading.fee_schedule (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NULL REFERENCES identity.user(id) ON DELETE RESTRICT, -- NULL for default tiers
    tier_name varchar(50) NOT NULL,
    min_30d_volume_usd numeric(38,0) NOT NULL DEFAULT 0,
    maker_fee_bps smallint NOT NULL CHECK (maker_fee_bps >= 0),
    taker_fee_bps smallint NOT NULL CHECK (taker_fee_bps >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_trading_fee_schedule_updated_at
BEFORE UPDATE ON trading.fee_schedule
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4. Table: trading.order
CREATE TABLE trading.order (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    market_id uuid NOT NULL REFERENCES market.market(id) ON DELETE RESTRICT,
    client_order_id varchar(64) NULL,
    side trading.order_side NOT NULL,
    order_type trading.order_type NOT NULL,
    price numeric(38,0) NOT NULL CHECK (price >= 0),
    quantity numeric(38,0) NOT NULL CHECK (quantity > 0),
    filled_quantity numeric(38,0) NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0 AND filled_quantity <= quantity),
    remaining_quantity numeric(38,0) NOT NULL CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
    status trading.order_status NOT NULL DEFAULT 'open',
    nonce bigint NOT NULL,
    expiry timestamptz NOT NULL,
    signature text NOT NULL, -- EIP-712 user signature
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_trading_order_user_nonce UNIQUE (user_id, nonce)
);

CREATE TRIGGER trg_trading_order_updated_at
BEFORE UPDATE ON trading.order
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_trading_order_user_status ON trading.order(user_id, status);
CREATE INDEX idx_trading_order_market_status ON trading.order(market_id, status);

-- 5. Table: trading.order_event (Append-Only)
CREATE TABLE trading.order_event (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    order_id uuid NOT NULL REFERENCES trading.order(id) ON DELETE RESTRICT,
    sequence_number bigint NOT NULL,
    event_type trading.order_event_type NOT NULL,
    delta_filled_quantity numeric(38,0) NOT NULL DEFAULT 0,
    remaining_quantity numeric(38,0) NOT NULL,
    event_payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_trading_order_event_append_only
BEFORE UPDATE OR DELETE ON trading.order_event
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_trading_order_event_order ON trading.order_event(order_id, sequence_number);

-- 6. Table: trading.trade (Append-Only)
CREATE TABLE trading.trade (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    sequence_number bigint NOT NULL UNIQUE,
    market_id uuid NOT NULL REFERENCES market.market(id) ON DELETE RESTRICT,
    maker_order_id uuid NOT NULL REFERENCES trading.order(id) ON DELETE RESTRICT,
    taker_order_id uuid NOT NULL REFERENCES trading.order(id) ON DELETE RESTRICT,
    maker_user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    taker_user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    side trading.order_side NOT NULL,
    price numeric(38,0) NOT NULL CHECK (price > 0),
    quantity numeric(38,0) NOT NULL CHECK (quantity > 0),
    quote_quantity numeric(38,0) NOT NULL CHECK (quote_quantity > 0),
    maker_fee numeric(38,0) NOT NULL DEFAULT 0,
    taker_fee numeric(38,0) NOT NULL DEFAULT 0,
    fee_asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    is_settled_onchain boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_trading_trade_append_only
BEFORE UPDATE OR DELETE ON trading.trade
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_trading_trade_market_seq ON trading.trade(market_id, sequence_number DESC);
CREATE INDEX idx_trading_trade_maker ON trading.trade(maker_user_id);
CREATE INDEX idx_trading_trade_taker ON trading.trade(taker_user_id);

-- 7. Table: trading.settlement_batch
CREATE TABLE trading.settlement_batch (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    batch_number bigserial NOT NULL UNIQUE,
    merkle_root varchar(66) NOT NULL,
    trade_count integer NOT NULL CHECK (trade_count > 0),
    status trading.settlement_batch_status NOT NULL DEFAULT 'pending',
    tx_hash varchar(66) NULL,
    chain_id integer NOT NULL,
    submitted_at timestamptz NULL,
    confirmed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_trading_settlement_batch_status ON trading.settlement_batch(status);

-- 8. Table: trading.settlement_item
CREATE TABLE trading.settlement_item (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    batch_id uuid NOT NULL REFERENCES trading.settlement_batch(id) ON DELETE RESTRICT,
    trade_id uuid NOT NULL REFERENCES trading.trade(id) ON DELETE RESTRICT,
    leaf_hash varchar(66) NOT NULL,
    leaf_index integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_trading_settlement_item UNIQUE (batch_id, trade_id)
);

CREATE INDEX idx_trading_settlement_item_batch ON trading.settlement_item(batch_id);
