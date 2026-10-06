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
