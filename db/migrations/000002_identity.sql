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
