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
