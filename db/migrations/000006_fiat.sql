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
