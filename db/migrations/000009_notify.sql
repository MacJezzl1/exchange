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
