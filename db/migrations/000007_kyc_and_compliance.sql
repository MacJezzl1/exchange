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
