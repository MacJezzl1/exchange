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
