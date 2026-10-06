-- Hybrid Exchange Platform - Consolidated Supabase Initial Schema

-- >>> 000001_init_extensions_and_schemas.sql <<<
-- ==============================================================================
-- Migration: 000001_init_extensions_and_schemas.sql
-- Description: Enable cryptographic extensions, UUIDv7 generation, helper functions,
--              and create all 12 isolated domain schemas.
-- Rollback note: DROP SCHEMA ... CASCADE; DROP EXTENSION ...;
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS kyc;
CREATE SCHEMA IF NOT EXISTS ledger;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS custody;
CREATE SCHEMA IF NOT EXISTS fiat;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS notify;

-- UUIDv7 Generator Function in public schema
-- Compliant with RFC 9562 (Unix epoch millisecond timestamp + version 7 + variant 1 + random bits)
CREATE OR REPLACE FUNCTION generate_uuid_v7()
RETURNS uuid
AS $$
DECLARE
    unix_time_ms bigint;
    uuid_bytes bytea;
BEGIN
    unix_time_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
    uuid_bytes := gen_random_bytes(16);

    -- Set top 48 bits to unix_time_ms
    uuid_bytes := set_byte(uuid_bytes, 0, ((unix_time_ms >> 40) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 1, ((unix_time_ms >> 32) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 2, ((unix_time_ms >> 24) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 3, ((unix_time_ms >> 16) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 4, ((unix_time_ms >> 8) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 5, (unix_time_ms & 255)::integer);

    -- Version 7 in high nibble of byte 6 (0x70 | (random & 0x0f))
    uuid_bytes := set_byte(uuid_bytes, 6, (112 | (get_byte(uuid_bytes, 6) & 15))::integer);

    -- Variant 1 (0b10) in high 2 bits of byte 8 (0x80 | (random & 0x3f))
    uuid_bytes := set_byte(uuid_bytes, 8, (128 | (get_byte(uuid_bytes, 8) & 63))::integer);

    RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Append-only enforcement trigger function: blocks UPDATE and DELETE on immutable tables
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS trigger
AS $$
BEGIN
    RAISE EXCEPTION 'Table % is strictly append-only. UPDATE and DELETE operations are prohibited by financial integrity policy.', TG_TABLE_NAME
        USING ERRCODE = '55000'; -- Object not modifiable
END;
$$ LANGUAGE plpgsql;

-- Timestamp auto-update trigger function for mutable tables
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS trigger
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- >>> 000002_identity.sql <<<
-- ==============================================================================
-- Migration: 000002_identity.sql
-- Domain: identity
-- Required Tables: user, user_credential, session, api_key, device, login_event,
--                  whitelist_address, account_security_setting
-- Rollback note: DROP TABLE identity.account_security_setting, identity.whitelist_address, ...
-- ==============================================================================

-- Enums
CREATE TYPE identity.user_status AS ENUM ('active', 'suspended', 'frozen', 'closed');
CREATE TYPE identity.credential_type AS ENUM ('passkey', 'siwe', 'totp', 'recovery_code');
CREATE TYPE identity.login_status AS ENUM ('success', 'failed_challenge', 'blocked_risk', 'mfa_required');

-- 1. Table: user
CREATE TABLE identity.user (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    email varchar(255) NULL UNIQUE,
    wallet_address varchar(42) NULL UNIQUE,
    status identity.user_status NOT NULL DEFAULT 'active',
    is_email_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_identity_user_identifier CHECK (email IS NOT NULL OR wallet_address IS NOT NULL)
);

CREATE TRIGGER trg_identity_user_updated_at
BEFORE UPDATE ON identity.user
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: user_credential
CREATE TABLE identity.user_credential (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    credential_type identity.credential_type NOT NULL,
    external_id text NOT NULL, -- WebAuthn Credential ID or Public Key
    public_key text NOT NULL,
    sign_counter bigint NOT NULL DEFAULT 0,
    transports text[] NULL,
    nickname varchar(100) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_used_at timestamptz NULL,
    CONSTRAINT uq_identity_credential_external_id UNIQUE (user_id, external_id)
);

CREATE INDEX idx_identity_user_credential_user_id ON identity.user_credential(user_id);

-- 3. Table: device
CREATE TABLE identity.device (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    fingerprint_hash varchar(64) NOT NULL,
    device_name varchar(100) NOT NULL,
    user_agent text NOT NULL,
    ip_address inet NOT NULL,
    is_trusted boolean NOT NULL DEFAULT false,
    first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_identity_device_user_fingerprint UNIQUE (user_id, fingerprint_hash)
);

CREATE INDEX idx_identity_device_user_id ON identity.device(user_id);

-- 4. Table: session
CREATE TABLE identity.session (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    device_id uuid NULL REFERENCES identity.device(id) ON DELETE SET NULL,
    token_hash varchar(64) NOT NULL UNIQUE,
    ip_address inet NOT NULL,
    user_agent text NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz NULL,
    revocation_reason varchar(100) NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_identity_session_user_id ON identity.session(user_id);
CREATE INDEX idx_identity_session_token_hash ON identity.session(token_hash);

-- 5. Table: api_key
CREATE TABLE identity.api_key (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    key_id varchar(32) NOT NULL UNIQUE,
    secret_hash varchar(64) NOT NULL,
    label varchar(100) NOT NULL,
    scopes text[] NOT NULL,
    ip_allowlist inet[] NULL,
    rate_limit_per_second integer NOT NULL DEFAULT 50,
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_used_at timestamptz NULL
);

CREATE INDEX idx_identity_api_key_user_id ON identity.api_key(user_id);
CREATE INDEX idx_identity_api_key_lookup ON identity.api_key(key_id) WHERE is_active = true;

-- 6. Table: login_event (Append-Only)
CREATE TABLE identity.login_event (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NULL REFERENCES identity.user(id) ON DELETE SET NULL,
    ip_address inet NOT NULL,
    user_agent text NOT NULL,
    device_fingerprint varchar(64) NULL,
    status identity.login_status NOT NULL,
    failure_reason varchar(100) NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_identity_login_event_append_only
BEFORE UPDATE OR DELETE ON identity.login_event
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_identity_login_event_user_id ON identity.login_event(user_id, created_at DESC);

-- 7. Table: whitelist_address
CREATE TABLE identity.whitelist_address (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    chain_id integer NOT NULL,
    address varchar(100) NOT NULL,
    label varchar(100) NOT NULL,
    is_active boolean NOT NULL DEFAULT false, -- Requires timelock to become active
    timelock_expires_at timestamptz NOT NULL, -- Mandatory timelock delay for new withdrawal addresses
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_identity_whitelist_addr UNIQUE (user_id, chain_id, address)
);

CREATE INDEX idx_identity_whitelist_address_user ON identity.whitelist_address(user_id);

-- 8. Table: account_security_setting
CREATE TABLE identity.account_security_setting (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL UNIQUE REFERENCES identity.user(id) ON DELETE RESTRICT,
    withdrawal_timelock_hours integer NOT NULL DEFAULT 24,
    withdrawal_limit_24h numeric(38,0) NOT NULL DEFAULT 10000000000, -- Atomic units
    panic_frozen_at timestamptz NULL,
    panic_freeze_reason text NULL,
    require_reauth_on_withdrawal boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_identity_security_setting_updated_at
BEFORE UPDATE ON identity.account_security_setting
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();


-- >>> 000003_ledger.sql <<<
-- ==============================================================================
-- Migration: 000003_ledger.sql
-- Domain: ledger (Double-Entry Core)
-- Required Tables: asset, account, journal_entry, journal_line, balance_snapshot, hold
-- Invariants:
--   1. Double-Entry: sum(debit) == sum(credit) per journal_entry (constraint trigger).
--   2. Append-only: journal_entry and journal_line reject UPDATE/DELETE.
--   3. Integer amounts: NUMERIC(38,0) in smallest atomic units.
-- Rollback note: DROP TABLE ledger.hold, ledger.balance_snapshot, ledger.journal_line, ...
-- ==============================================================================

-- Enums
CREATE TYPE ledger.asset_class AS ENUM ('crypto', 'fiat', 'stablecoin');
CREATE TYPE ledger.account_type AS ENUM (
    'user_available',
    'user_held',
    'system_fee',
    'system_insurance',
    'system_hot_wallet',
    'system_cold_storage',
    'system_settlement_clearing'
);
CREATE TYPE ledger.journal_reference_type AS ENUM (
    'trade',
    'deposit',
    'withdrawal',
    'hold',
    'release',
    'fee',
    'reconciliation'
);
CREATE TYPE ledger.hold_status AS ENUM ('active', 'captured', 'released');

-- 1. Table: asset
CREATE TABLE ledger.asset (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    symbol varchar(20) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    asset_class ledger.asset_class NOT NULL,
    decimals smallint NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
    chain_id integer NULL,
    contract_address varchar(100) NULL,
    is_active boolean NOT NULL DEFAULT true,
    can_deposit boolean NOT NULL DEFAULT true,
    can_withdraw boolean NOT NULL DEFAULT true,
    min_withdrawal numeric(38,0) NOT NULL DEFAULT 0,
    withdrawal_fee numeric(38,0) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_ledger_asset_updated_at
BEFORE UPDATE ON ledger.asset
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: account
CREATE TABLE ledger.account (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    account_type ledger.account_type NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    -- System accounts have user_id = NULL; user accounts must have user_id NOT NULL
    CONSTRAINT chk_ledger_account_user CHECK (
        (account_type IN ('user_available', 'user_held') AND user_id IS NOT NULL) OR
        (account_type NOT IN ('user_available', 'user_held') AND user_id IS NULL)
    ),
    CONSTRAINT uq_ledger_account_user_asset_type UNIQUE (user_id, asset_id, account_type)
);

CREATE INDEX idx_ledger_account_lookup ON ledger.account(user_id, asset_id, account_type);

-- 3. Table: journal_entry (Append-Only)
CREATE TABLE ledger.journal_entry (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    sequence_number bigserial NOT NULL UNIQUE,
    reference_type ledger.journal_reference_type NOT NULL,
    reference_id uuid NOT NULL,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_ledger_journal_entry_append_only
BEFORE UPDATE OR DELETE ON ledger.journal_entry
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_ledger_journal_entry_reference ON ledger.journal_entry(reference_type, reference_id);

-- 4. Table: journal_line (Append-Only)
CREATE TABLE ledger.journal_line (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    journal_entry_id uuid NOT NULL REFERENCES ledger.journal_entry(id) ON DELETE RESTRICT,
    account_id uuid NOT NULL REFERENCES ledger.account(id) ON DELETE RESTRICT,
    debit numeric(38,0) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit numeric(38,0) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    -- Exactly one of debit or credit must be strictly greater than zero
    CONSTRAINT chk_ledger_line_amount CHECK (
        (debit > 0 AND credit = 0) OR
        (credit > 0 AND debit = 0)
    )
);

CREATE TRIGGER trg_ledger_journal_line_append_only
BEFORE UPDATE OR DELETE ON ledger.journal_line
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_ledger_journal_line_entry ON ledger.journal_line(journal_entry_id);
CREATE INDEX idx_ledger_journal_line_account ON ledger.journal_line(account_id);

-- Constraint Trigger Function: Enforce Double-Entry Balance per journal_entry
CREATE OR REPLACE FUNCTION verify_journal_entry_balance()
RETURNS trigger
AS $$
DECLARE
    v_total_debit numeric(38,0);
    v_total_credit numeric(38,0);
BEGIN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM ledger.journal_line
    WHERE journal_entry_id = NEW.journal_entry_id;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Double-entry constraint violation: Journal entry % does not balance (Debit: %, Credit: %)',
            NEW.journal_entry_id, v_total_debit, v_total_credit
            USING ERRCODE = '23514'; -- Check violation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Deferred constraint trigger to allow multi-line batch inserts in a single transaction
CREATE CONSTRAINT TRIGGER trg_verify_journal_balance
AFTER INSERT ON ledger.journal_line
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION verify_journal_entry_balance();

-- 5. Table: balance_snapshot
CREATE TABLE ledger.balance_snapshot (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    account_id uuid NOT NULL REFERENCES ledger.account(id) ON DELETE RESTRICT,
    balance numeric(38,0) NOT NULL CHECK (balance >= 0),
    journal_entry_sequence bigint NOT NULL,
    snapshot_hash varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_ledger_snapshot_account ON ledger.balance_snapshot(account_id, created_at DESC);

-- 6. Table: hold
CREATE TABLE ledger.hold (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    account_id uuid NOT NULL REFERENCES ledger.account(id) ON DELETE RESTRICT,
    amount numeric(38,0) NOT NULL CHECK (amount > 0),
    reason varchar(50) NOT NULL, -- 'order_hold', 'withdrawal_hold'
    reference_id uuid NOT NULL,
    status ledger.hold_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_ledger_hold_updated_at
BEFORE UPDATE ON ledger.hold
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_ledger_hold_user_status ON ledger.hold(user_id, status);
CREATE INDEX idx_ledger_hold_reference ON ledger.hold(reference_id);


-- >>> 000004_trading_and_market.sql <<<
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


-- >>> 000005_custody.sql <<<
-- ==============================================================================
-- Migration: 000005_custody.sql
-- Domain: custody
-- Required Tables: chain, deposit_address, onchain_deposit, onchain_withdrawal,
--                  hot_wallet_state, reserve_snapshot, proof_of_reserves_root
-- Rollback note: DROP TABLE custody.proof_of_reserves_root, custody.reserve_snapshot, ...
-- ==============================================================================

-- Enums
CREATE TYPE custody.deposit_status AS ENUM (
    'detected',
    'confirming',
    'credited',
    'failed',
    'dropped'
);
CREATE TYPE custody.withdrawal_status AS ENUM (
    'pending_risk',
    'pending_approval',
    'queued',
    'submitted',
    'confirming',
    'confirmed',
    'rejected',
    'failed'
);

-- 1. Table: custody.chain
CREATE TABLE custody.chain (
    id integer PRIMARY KEY, -- Chain ID (e.g. 8453 for Base, 42161 for Arbitrum)
    name varchar(50) NOT NULL UNIQUE,
    is_evm boolean NOT NULL DEFAULT true,
    vault_address varchar(42) NOT NULL,
    settlement_address varchar(42) NOT NULL,
    required_confirmations smallint NOT NULL DEFAULT 12 CHECK (required_confirmations > 0),
    block_time_seconds numeric(4,2) NOT NULL DEFAULT 2.0,
    rpc_endpoint_url text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_custody_chain_updated_at
BEFORE UPDATE ON custody.chain
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: custody.deposit_address
CREATE TABLE custody.deposit_address (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    chain_id integer NOT NULL REFERENCES custody.chain(id) ON DELETE RESTRICT,
    address varchar(100) NOT NULL,
    derivation_index integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_custody_user_chain_addr UNIQUE (user_id, chain_id, address)
);

CREATE INDEX idx_custody_deposit_address_lookup ON custody.deposit_address(chain_id, address);

-- 3. Table: custody.onchain_deposit
CREATE TABLE custody.onchain_deposit (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    chain_id integer NOT NULL REFERENCES custody.chain(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    tx_hash varchar(66) NOT NULL,
    log_index integer NOT NULL,
    block_number bigint NOT NULL,
    from_address varchar(100) NOT NULL,
    to_address varchar(100) NOT NULL,
    amount numeric(38,0) NOT NULL CHECK (amount > 0),
    status custody.deposit_status NOT NULL DEFAULT 'detected',
    confirmations integer NOT NULL DEFAULT 0,
    credited_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_custody_deposit_tx_log UNIQUE (chain_id, tx_hash, log_index)
);

CREATE TRIGGER trg_custody_deposit_updated_at
BEFORE UPDATE ON custody.onchain_deposit
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_custody_deposit_user ON custody.onchain_deposit(user_id, status);

-- 4. Table: custody.onchain_withdrawal
CREATE TABLE custody.onchain_withdrawal (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    chain_id integer NOT NULL REFERENCES custody.chain(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    to_address varchar(100) NOT NULL,
    amount numeric(38,0) NOT NULL CHECK (amount > 0),
    fee_amount numeric(38,0) NOT NULL DEFAULT 0,
    risk_score smallint NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    status custody.withdrawal_status NOT NULL DEFAULT 'pending_risk',
    tx_hash varchar(66) NULL,
    block_number bigint NULL,
    approved_by_admin_id uuid NULL,
    rejection_reason text NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    confirmed_at timestamptz NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_custody_withdrawal_updated_at
BEFORE UPDATE ON custody.onchain_withdrawal
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_custody_withdrawal_user ON custody.onchain_withdrawal(user_id, status);

-- 5. Table: custody.hot_wallet_state
CREATE TABLE custody.hot_wallet_state (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    chain_id integer NOT NULL REFERENCES custody.chain(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    address varchar(100) NOT NULL,
    current_balance numeric(38,0) NOT NULL DEFAULT 0,
    min_reserve_threshold numeric(38,0) NOT NULL,
    max_reserve_threshold numeric(38,0) NOT NULL,
    last_swept_at timestamptz NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_custody_hot_wallet UNIQUE (chain_id, asset_id, address)
);

CREATE TRIGGER trg_custody_hot_wallet_updated_at
BEFORE UPDATE ON custody.hot_wallet_state
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 6. Table: custody.reserve_snapshot (Append-Only)
CREATE TABLE custody.reserve_snapshot (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    chain_id integer NOT NULL REFERENCES custody.chain(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    onchain_vault_balance numeric(38,0) NOT NULL,
    hot_wallet_balance numeric(38,0) NOT NULL,
    cold_wallet_balance numeric(38,0) NOT NULL,
    total_liabilities numeric(38,0) NOT NULL,
    coverage_ratio numeric(7,4) NOT NULL, -- e.g. 1.0500 = 105% solvency
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_custody_reserve_snapshot_append_only
BEFORE UPDATE OR DELETE ON custody.reserve_snapshot
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_custody_reserve_snapshot_time ON custody.reserve_snapshot(asset_id, created_at DESC);

-- 7. Table: custody.proof_of_reserves_root (Append-Only)
CREATE TABLE custody.proof_of_reserves_root (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    snapshot_sequence bigint NOT NULL UNIQUE,
    merkle_root varchar(66) NOT NULL,
    total_liabilities_hash varchar(64) NOT NULL,
    public_verification_url text NOT NULL,
    published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_custody_por_append_only
BEFORE UPDATE OR DELETE ON custody.proof_of_reserves_root
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();


-- >>> 000006_fiat.sql <<<
-- ==============================================================================
-- Migration: 000006_fiat.sql
-- Domain: fiat
-- Required Tables: payment_provider, bank_account_link, fiat_deposit,
--                  fiat_withdrawal, payment_review
-- Rollback note: DROP TABLE fiat.payment_review, fiat.fiat_withdrawal, ...
-- ==============================================================================

-- Enums
CREATE TYPE fiat.provider_type AS ENUM ('instant_eft', 'bank_transfer', 'mobile_money', 'card');
CREATE TYPE fiat.payment_status AS ENUM (
    'initiated',
    'pending_provider',
    'under_review',
    'approved',
    'completed',
    'failed',
    'cancelled',
    'refunded'
);
CREATE TYPE fiat.review_decision AS ENUM ('approved', 'rejected', 'more_info_required');

-- 1. Table: fiat.payment_provider
CREATE TABLE fiat.payment_provider (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    name varchar(50) NOT NULL UNIQUE, -- e.g. 'stitch', 'ozow', 'mpesa'
    provider_type fiat.provider_type NOT NULL,
    supported_currencies text[] NOT NULL, -- e.g. ['ZAR', 'KES']
    is_active boolean NOT NULL DEFAULT true,
    min_amount numeric(38,0) NOT NULL DEFAULT 1000, -- Smallest fiat units (cents)
    max_amount numeric(38,0) NOT NULL DEFAULT 10000000,
    fee_fixed numeric(38,0) NOT NULL DEFAULT 0,
    fee_percentage_bps smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_fiat_payment_provider_updated_at
BEFORE UPDATE ON fiat.payment_provider
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: fiat.bank_account_link
CREATE TABLE fiat.bank_account_link (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    account_holder_name varchar(150) NOT NULL,
    bank_name varchar(100) NOT NULL,
    account_number_masked varchar(30) NOT NULL,
    account_number_hash varchar(64) NOT NULL,
    branch_code varchar(20) NOT NULL,
    currency varchar(3) NOT NULL, -- 'ZAR', 'KES', 'NGN'
    is_verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_fiat_bank_user_acc UNIQUE (user_id, account_number_hash)
);

CREATE TRIGGER trg_fiat_bank_account_updated_at
BEFORE UPDATE ON fiat.bank_account_link
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_fiat_bank_account_user ON fiat.bank_account_link(user_id);

-- 3. Table: fiat.fiat_deposit
CREATE TABLE fiat.fiat_deposit (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    provider_id uuid NOT NULL REFERENCES fiat.payment_provider(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    external_reference text NULL,
    amount numeric(38,0) NOT NULL CHECK (amount > 0),
    fee_amount numeric(38,0) NOT NULL DEFAULT 0,
    status fiat.payment_status NOT NULL DEFAULT 'initiated',
    credited_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_fiat_deposit_updated_at
BEFORE UPDATE ON fiat.fiat_deposit
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_fiat_deposit_user_status ON fiat.fiat_deposit(user_id, status);

-- 4. Table: fiat.fiat_withdrawal
CREATE TABLE fiat.fiat_withdrawal (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    provider_id uuid NOT NULL REFERENCES fiat.payment_provider(id) ON DELETE RESTRICT,
    bank_account_id uuid NOT NULL REFERENCES fiat.bank_account_link(id) ON DELETE RESTRICT,
    asset_id uuid NOT NULL REFERENCES ledger.asset(id) ON DELETE RESTRICT,
    amount numeric(38,0) NOT NULL CHECK (amount > 0),
    fee_amount numeric(38,0) NOT NULL DEFAULT 0,
    status fiat.payment_status NOT NULL DEFAULT 'initiated',
    requires_approval boolean NOT NULL DEFAULT false,
    dispatched_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_fiat_withdrawal_updated_at
BEFORE UPDATE ON fiat.fiat_withdrawal
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_fiat_withdrawal_user_status ON fiat.fiat_withdrawal(user_id, status);

-- 5. Table: fiat.payment_review
CREATE TABLE fiat.payment_review (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    withdrawal_id uuid NOT NULL REFERENCES fiat.fiat_withdrawal(id) ON DELETE RESTRICT,
    reviewer_admin_id uuid NULL, -- References admin.admin_user(id)
    decision fiat.review_decision NOT NULL,
    notes text NOT NULL,
    risk_score smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_fiat_payment_review_withdrawal ON fiat.payment_review(withdrawal_id);


-- >>> 000007_kyc_and_compliance.sql <<<
-- ==============================================================================
-- Migration: 000007_kyc_and_compliance.sql
-- Domains: kyc, compliance
-- Required Tables:
--   kyc: kyc_level, risk_profile, kyc_case, kyc_document, kyc_check_result, kyc_decision
--   compliance: screening_result, sanction_hit, suspicious_activity_flag, travel_rule_record
-- Rollback note: DROP TABLE compliance.travel_rule_record, compliance.suspicious_activity_flag, ...
-- ==============================================================================

-- Enums
CREATE TYPE kyc.case_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'more_info_required',
    'approved',
    'rejected',
    'expired'
);
CREATE TYPE kyc.document_type AS ENUM (
    'national_id',
    'passport',
    'drivers_license',
    'proof_of_residence',
    'incorporation_certificate',
    'source_of_wealth'
);
CREATE TYPE kyc.decision_type AS ENUM ('approve', 'reject', 'request_more_info', 'tier_upgrade');
CREATE TYPE compliance.match_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE compliance.flag_status AS ENUM ('open', 'investigating', 'escalated_to_mlro', 'cleared', 'sar_filed');

-- 1. Table: kyc.kyc_level
CREATE TABLE kyc.kyc_level (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    tier smallint NOT NULL UNIQUE CHECK (tier >= 0 AND tier <= 3), -- 0=Browse, 1=Basic, 2=Full, 3=Institutional
    name varchar(50) NOT NULL,
    daily_withdrawal_limit_usd numeric(38,0) NOT NULL,
    monthly_withdrawal_limit_usd numeric(38,0) NOT NULL,
    can_trade_crypto boolean NOT NULL DEFAULT true,
    can_trade_fiat boolean NOT NULL DEFAULT false,
    requires_residence_proof boolean NOT NULL DEFAULT false,
    requires_source_of_funds boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2. Table: kyc.risk_profile
CREATE TABLE kyc.risk_profile (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL UNIQUE REFERENCES identity.user(id) ON DELETE RESTRICT,
    base_risk_score smallint NOT NULL DEFAULT 10 CHECK (base_risk_score >= 0 AND base_risk_score <= 100),
    is_pep boolean NOT NULL DEFAULT false,
    is_high_risk_country boolean NOT NULL DEFAULT false,
    adverse_media_flag boolean NOT NULL DEFAULT false,
    sanctions_check_passed boolean NOT NULL DEFAULT false,
    last_screened_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_kyc_risk_profile_updated_at
BEFORE UPDATE ON kyc.risk_profile
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 3. Table: kyc.kyc_case
CREATE TABLE kyc.kyc_case (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    target_kyc_level_id uuid NOT NULL REFERENCES kyc.kyc_level(id) ON DELETE RESTRICT,
    status kyc.case_status NOT NULL DEFAULT 'draft',
    provider_session_id text NULL,
    assigned_reviewer_id uuid NULL,
    submitted_at timestamptz NULL,
    decided_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_kyc_case_updated_at
BEFORE UPDATE ON kyc.kyc_case
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_kyc_case_user ON kyc.kyc_case(user_id, status);

-- 4. Table: kyc.kyc_document
CREATE TABLE kyc.kyc_document (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    case_id uuid NOT NULL REFERENCES kyc.kyc_case(id) ON DELETE RESTRICT,
    document_type kyc.document_type NOT NULL,
    storage_path_encrypted text NOT NULL, -- Field-level encryption reference (S3/GCS ciphertext key)
    file_sha256 varchar(64) NOT NULL,
    mime_type varchar(50) NOT NULL,
    expiration_date date NULL,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_kyc_document_case ON kyc.kyc_document(case_id);

-- 5. Table: kyc.kyc_check_result
CREATE TABLE kyc.kyc_check_result (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    case_id uuid NOT NULL REFERENCES kyc.kyc_case(id) ON DELETE RESTRICT,
    provider_name varchar(50) NOT NULL, -- e.g. 'sumsub', 'veriff', 'mock'
    check_type varchar(50) NOT NULL, -- 'liveness', 'id_validity', 'face_match'
    is_passed boolean NOT NULL,
    confidence_score numeric(5,2) NULL,
    raw_response_encrypted text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_kyc_check_result_case ON kyc.kyc_check_result(case_id);

-- 6. Table: kyc.kyc_decision (Append-Only)
CREATE TABLE kyc.kyc_decision (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    case_id uuid NOT NULL REFERENCES kyc.kyc_case(id) ON DELETE RESTRICT,
    decider_admin_id uuid NULL, -- References admin.admin_user(id) or NULL if automated
    decision kyc.decision_type NOT NULL,
    reason text NOT NULL,
    decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_kyc_decision_append_only
BEFORE UPDATE OR DELETE ON kyc.kyc_decision
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_kyc_decision_case ON kyc.kyc_decision(case_id);

-- 7. Table: compliance.screening_result
CREATE TABLE compliance.screening_result (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    provider_name varchar(50) NOT NULL,
    sanction_match boolean NOT NULL DEFAULT false,
    pep_match boolean NOT NULL DEFAULT false,
    adverse_media_match boolean NOT NULL DEFAULT false,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    screened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_compliance_screening_user ON compliance.screening_result(user_id);

-- 8. Table: compliance.sanction_hit
CREATE TABLE compliance.sanction_hit (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    screening_result_id uuid NOT NULL REFERENCES compliance.screening_result(id) ON DELETE RESTRICT,
    matched_list_name text NOT NULL, -- e.g. 'OFAC SDN', 'UN Sanctions', 'EU Consolidated'
    matched_name text NOT NULL,
    severity compliance.match_severity NOT NULL,
    is_false_positive boolean NOT NULL DEFAULT false,
    resolution_notes text NULL,
    resolved_by_admin_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_compliance_sanction_hit_user ON compliance.sanction_hit(user_id);

-- 9. Table: compliance.suspicious_activity_flag
CREATE TABLE compliance.suspicious_activity_flag (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NOT NULL REFERENCES identity.user(id) ON DELETE RESTRICT,
    flag_type varchar(50) NOT NULL, -- 'smurfing', 'rapid_movement', 'sanction_address_interaction'
    risk_score smallint NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    status compliance.flag_status NOT NULL DEFAULT 'open',
    evidence jsonb NOT NULL,
    assigned_mlro_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_compliance_flag_updated_at
BEFORE UPDATE ON compliance.suspicious_activity_flag
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX idx_compliance_flag_user ON compliance.suspicious_activity_flag(user_id, status);

-- 10. Table: compliance.travel_rule_record
CREATE TABLE compliance.travel_rule_record (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    withdrawal_id uuid NULL REFERENCES custody.onchain_withdrawal(id) ON DELETE SET NULL,
    originator_name text NOT NULL,
    originator_account text NOT NULL,
    originator_vasp text NOT NULL,
    beneficiary_name text NOT NULL,
    beneficiary_account text NOT NULL,
    beneficiary_vasp text NOT NULL,
    ivms101_payload text NOT NULL, -- Encrypted IVMS101 XML or JSON
    status varchar(30) NOT NULL DEFAULT 'dispatched',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_compliance_travel_rule_withdrawal ON compliance.travel_rule_record(withdrawal_id);


-- >>> 000008_admin_and_audit.sql <<<
-- ==============================================================================
-- Migration: 000008_admin_and_audit.sql
-- Domains: admin, audit
-- Required Tables:
--   admin: admin_user, admin_role, admin_permission, admin_role_permission,
--          admin_session, approval_request, approval_step, admin_setting_change
--   audit: audit_event (hash-chained), audit_anchor
-- Rollback note: DROP TABLE audit.audit_anchor, audit.audit_event, admin.admin_setting_change, ...
-- ==============================================================================

-- Enums
CREATE TYPE admin.admin_status AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE admin.approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE admin.approval_action_type AS ENUM (
    'fiat_withdrawal',
    'hot_wallet_change',
    'market_halt',
    'market_resume',
    'fee_change',
    'role_change',
    'manual_account_unfreeze',
    'global_kill_switch'
);
CREATE TYPE audit.actor_type AS ENUM ('admin', 'system', 'user');

-- 1. Table: admin.admin_role
CREATE TABLE admin.admin_role (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    name varchar(50) NOT NULL UNIQUE, -- e.g. 'SuperAdmin', 'ComplianceOfficer', 'FinancePayments', etc.
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2. Table: admin.admin_permission
CREATE TABLE admin.admin_permission (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    slug varchar(100) NOT NULL UNIQUE, -- e.g. 'kyc.approve', 'fiat.withdrawal.approve', 'market.halt'
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 3. Table: admin.admin_role_permission
CREATE TABLE admin.admin_role_permission (
    role_id uuid NOT NULL REFERENCES admin.admin_role(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES admin.admin_permission(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Table: admin.admin_user
CREATE TABLE admin.admin_user (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    email varchar(255) NOT NULL UNIQUE,
    full_name varchar(100) NOT NULL,
    role_id uuid NOT NULL REFERENCES admin.admin_role(id) ON DELETE RESTRICT,
    status admin.admin_status NOT NULL DEFAULT 'active',
    webauthn_credential_id text NOT NULL, -- Hardware token (YubiKey) ID only
    webauthn_public_key text NOT NULL,
    webauthn_sign_counter bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_admin_user_updated_at
BEFORE UPDATE ON admin.admin_user
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 5. Table: admin.admin_session
CREATE TABLE admin.admin_session (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    admin_user_id uuid NOT NULL REFERENCES admin.admin_user(id) ON DELETE RESTRICT,
    token_hash varchar(64) NOT NULL UNIQUE,
    ip_address inet NOT NULL,
    user_agent text NOT NULL,
    expires_at timestamptz NOT NULL, -- Short-lived (max 60 minutes)
    revoked_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_admin_session_lookup ON admin.admin_session(admin_user_id, token_hash);

-- 6. Table: admin.approval_request (Four-Eyes / Maker-Checker Core)
CREATE TABLE admin.approval_request (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    action_type admin.approval_action_type NOT NULL,
    entity_id uuid NOT NULL,
    requester_admin_id uuid NOT NULL REFERENCES admin.admin_user(id) ON DELETE RESTRICT,
    status admin.approval_status NOT NULL DEFAULT 'pending',
    required_approvals smallint NOT NULL DEFAULT 2 CHECK (required_approvals >= 2),
    payload jsonb NOT NULL,
    reason text NOT NULL,
    expires_at timestamptz NOT NULL,
    decided_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_admin_approval_request_status ON admin.approval_request(status);

-- 7. Table: admin.approval_step
CREATE TABLE admin.approval_step (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    approval_request_id uuid NOT NULL REFERENCES admin.approval_request(id) ON DELETE RESTRICT,
    step_number smallint NOT NULL,
    admin_user_id uuid NOT NULL REFERENCES admin.admin_user(id) ON DELETE RESTRICT,
    decision admin.approval_status NOT NULL CHECK (decision IN ('approved', 'rejected')),
    notes text NOT NULL,
    ip_address inet NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_admin_approval_step UNIQUE (approval_request_id, admin_user_id)
);

-- Maker-Checker Invariant Trigger: Approver cannot be the same admin as the original requester
CREATE OR REPLACE FUNCTION verify_maker_checker_distinct()
RETURNS trigger
AS $$
DECLARE
    v_requester_id uuid;
BEGIN
    SELECT requester_admin_id INTO v_requester_id
    FROM admin.approval_request
    WHERE id = NEW.approval_request_id;

    IF NEW.admin_user_id = v_requester_id THEN
        RAISE EXCEPTION 'Four-eyes violation: The maker (requester %) cannot act as checker on the same approval request',
            NEW.admin_user_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maker_checker_distinct
BEFORE INSERT ON admin.approval_step
FOR EACH ROW EXECUTE FUNCTION verify_maker_checker_distinct();

-- 8. Table: admin.admin_setting_change
CREATE TABLE admin.admin_setting_change (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    setting_key varchar(100) NOT NULL,
    old_value jsonb NOT NULL,
    new_value jsonb NOT NULL,
    approval_request_id uuid NOT NULL REFERENCES admin.approval_request(id) ON DELETE RESTRICT,
    applied_by_admin_id uuid NOT NULL REFERENCES admin.admin_user(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 9. Table: audit.audit_event (Cryptographically Hash-Chained & Append-Only)
CREATE TABLE audit.audit_event (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    sequence_number bigserial NOT NULL UNIQUE,
    prev_hash varchar(64) NOT NULL,
    hash varchar(64) NOT NULL,
    actor_id uuid NOT NULL,
    actor_type audit.actor_type NOT NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    ip_address inet NOT NULL,
    user_agent text NOT NULL,
    reason text NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_audit_event_append_only
BEFORE UPDATE OR DELETE ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

CREATE INDEX idx_audit_event_sequence ON audit.audit_event(sequence_number);
CREATE INDEX idx_audit_event_entity ON audit.audit_event(entity_type, entity_id);
CREATE INDEX idx_audit_event_actor ON audit.audit_event(actor_id, created_at DESC);

-- Hash chain verification and generator trigger function
CREATE OR REPLACE FUNCTION audit_event_generate_hash()
RETURNS trigger
AS $$
DECLARE
    v_last_hash varchar(64);
    v_computed_hash text;
BEGIN
    -- Retrieve hash of the immediately preceding audit row (or genesis hash for row 1)
    SELECT hash INTO v_last_hash
    FROM audit.audit_event
    ORDER BY sequence_number DESC
    LIMIT 1;

    IF v_last_hash IS NULL THEN
        -- Genesis hash (64 zeros)
        v_last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.prev_hash := v_last_hash;

    -- Compute SHA-256 over canonical string concatenation of immutable row fields
    v_computed_hash := encode(digest(
        NEW.prev_hash ||
        NEW.id::text ||
        NEW.actor_id::text ||
        NEW.actor_type::text ||
        NEW.action ||
        NEW.entity_type ||
        NEW.entity_id::text ||
        NEW.ip_address::text ||
        COALESCE(NEW.reason, '') ||
        NEW.details::text ||
        NEW.created_at::text,
        'sha256'
    ), 'hex');

    NEW.hash := v_computed_hash;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_event_hash_chain
BEFORE INSERT ON audit.audit_event
FOR EACH ROW EXECUTE FUNCTION audit_event_generate_hash();

-- 10. Table: audit.audit_anchor (Periodic on-chain or external timestamp anchor)
CREATE TABLE audit.audit_anchor (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    sequence_from bigint NOT NULL,
    sequence_to bigint NOT NULL,
    head_hash varchar(64) NOT NULL,
    chain_id integer NOT NULL,
    tx_hash varchar(66) NOT NULL,
    anchored_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_audit_anchor_append_only
BEFORE UPDATE OR DELETE ON audit.audit_anchor
FOR EACH ROW EXECUTE FUNCTION enforce_append_only();


-- >>> 000009_notify.sql <<<
-- ==============================================================================
-- Migration: 000009_notify.sql
-- Domain: notify
-- Required Tables: notification_template, notification_dispatch
-- Rollback note: DROP TABLE notify.notification_dispatch, notify.notification_template;
-- ==============================================================================

-- Enums
CREATE TYPE notify.channel_type AS ENUM ('email', 'sms', 'push', 'webhook');
CREATE TYPE notify.dispatch_status AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- 1. Table: notify.notification_template
CREATE TABLE notify.notification_template (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    template_code varchar(100) NOT NULL UNIQUE, -- e.g. 'LOGIN_SECURITY_ALERT', 'WITHDRAWAL_CONFIRMED'
    channel notify.channel_type NOT NULL,
    subject_template text NULL,
    body_template text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER trg_notify_template_updated_at
BEFORE UPDATE ON notify.notification_template
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 2. Table: notify.notification_dispatch (Append-Only)
CREATE TABLE notify.notification_dispatch (
    id uuid PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id uuid NULL REFERENCES identity.user(id) ON DELETE SET NULL,
    template_id uuid NOT NULL REFERENCES notify.notification_template(id) ON DELETE RESTRICT,
    channel notify.channel_type NOT NULL,
    recipient_destination text NOT NULL, -- Email address, phone number, or webhook URL
    status notify.dispatch_status NOT NULL DEFAULT 'queued',
    provider_response jsonb NULL,
    attempts smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    sent_at timestamptz NULL
);

CREATE INDEX idx_notify_dispatch_user ON notify.notification_dispatch(user_id, status);


-- >>> Supabase Role Permissions and Realtime Setup <<<
GRANT USAGE ON SCHEMA identity, kyc, ledger, trading, custody, fiat, risk, compliance, market, admin, audit, notify TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA identity, kyc, ledger, trading, custody, fiat, risk, compliance, market, admin, audit, notify TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA market, trading TO anon, authenticated;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trading.trade, market.ticker_snapshot;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
