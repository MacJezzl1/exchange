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
