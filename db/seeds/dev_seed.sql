-- ==============================================================================
-- SEED DATA: Local Development Environment ONLY
-- WARNING: NEVER EXECUTE IN STAGING OR PRODUCTION!
-- ==============================================================================

-- 1. Supported Chains
INSERT INTO custody.chain (id, name, is_evm, vault_address, settlement_address, required_confirmations, block_time_seconds, rpc_endpoint_url, is_active)
VALUES
  (84532, 'Base Sepolia Testnet', true, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 5, 2.0, 'https://sepolia.base.org', true),
  (31337, 'Local Anvil L2', true, '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', 1, 1.0, 'http://127.0.0.1:8545', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Core Assets (Atomic Units)
-- USDT: 6 decimals (1 USDT = 1,000,000)
-- BTC: 8 decimals (1 BTC = 100,000,000)
-- ETH: 18 decimals (1 ETH = 1,000,000,000,000,000,000)
-- ZAR: 2 decimals (1 ZAR = 100 cents)
INSERT INTO ledger.asset (id, symbol, name, asset_class, decimals, chain_id, contract_address, is_active, min_withdrawal, withdrawal_fee)
VALUES
  ('018e0000-0000-7000-8000-000000000001', 'USDT', 'Tether USD', 'stablecoin', 6, 84532, '0x0000000000000000000000000000000000000001', true, 10000000, 1000000),
  ('018e0000-0000-7000-8000-000000000002', 'BTC', 'Bitcoin', 'crypto', 8, 84532, '0x0000000000000000000000000000000000000002', true, 100000, 10000),
  ('018e0000-0000-7000-8000-000000000003', 'ETH', 'Ethereum', 'crypto', 18, 84532, NULL, true, 10000000000000000, 1000000000000000),
  ('018e0000-0000-7000-8000-000000000004', 'ZAR', 'South African Rand', 'fiat', 2, NULL, NULL, true, 10000, 500)
ON CONFLICT (symbol) DO NOTHING;

-- 3. System Accounts in Double-Entry Ledger
INSERT INTO ledger.account (id, user_id, asset_id, account_type)
VALUES
  ('018e0000-0001-7000-8000-000000000001', NULL, '018e0000-0000-7000-8000-000000000001', 'system_fee'),
  ('018e0000-0001-7000-8000-000000000002', NULL, '018e0000-0000-7000-8000-000000000001', 'system_insurance'),
  ('018e0000-0001-7000-8000-000000000003', NULL, '018e0000-0000-7000-8000-000000000001', 'system_hot_wallet'),
  ('018e0000-0001-7000-8000-000000000004', NULL, '018e0000-0000-7000-8000-000000000001', 'system_settlement_clearing'),
  ('018e0000-0001-7000-8000-000000000005', NULL, '018e0000-0000-7000-8000-000000000002', 'system_fee'),
  ('018e0000-0001-7000-8000-000000000006', NULL, '018e0000-0000-7000-8000-000000000002', 'system_hot_wallet'),
  ('018e0000-0001-7000-8000-000000000007', NULL, '018e0000-0000-7000-8000-000000000004', 'system_hot_wallet')
ON CONFLICT DO NOTHING;

-- 4. Markets (Trading Pairs)
INSERT INTO market.market (id, symbol, base_asset_id, quote_asset_id, tick_size, lot_size, min_order_size, max_order_size, maker_fee_bps, taker_fee_bps, price_band_pct, is_active, is_halted)
VALUES
  ('018e0000-0002-7000-8000-000000000001', 'BTC-USDT', '018e0000-0000-7000-8000-000000000002', '018e0000-0000-7000-8000-000000000001', 10000, 1000, 10000, 5000000000, 10, 20, 10.00, true, false),
  ('018e0000-0002-7000-8000-000000000002', 'ETH-USDT', '018e0000-0000-7000-8000-000000000003', '018e0000-0000-7000-8000-000000000001', 1000, 10000000000000, 100000000000000, 5000000000000000000, 10, 20, 10.00, true, false),
  ('018e0000-0002-7000-8000-000000000003', 'USDT-ZAR', '018e0000-0000-7000-8000-000000000001', '018e0000-0000-7000-8000-000000000004', 1, 100000, 1000000, 10000000000, 15, 25, 10.00, true, false)
ON CONFLICT (symbol) DO NOTHING;

-- 5. KYC Levels
INSERT INTO kyc.kyc_level (id, tier, name, daily_withdrawal_limit_usd, monthly_withdrawal_limit_usd, can_trade_crypto, can_trade_fiat, requires_residence_proof, requires_source_of_funds)
VALUES
  ('018e0000-0003-7000-8000-000000000000', 0, 'L0: Browse', 0, 0, false, false, false, false),
  ('018e0000-0003-7000-8000-000000000001', 1, 'L1: Basic Crypto', 5000000000, 50000000000, true, false, false, false),
  ('018e0000-0003-7000-8000-000000000002', 2, 'L2: Full Fiat & Crypto', 50000000000, 500000000000, true, true, true, false),
  ('018e0000-0003-7000-8000-000000000003', 3, 'L3: Institutional', 500000000000, 5000000000000, true, true, true, true)
ON CONFLICT (tier) DO NOTHING;

-- 6. Payment Providers
INSERT INTO fiat.payment_provider (id, name, provider_type, supported_currencies, is_active, min_amount, max_amount, fee_fixed, fee_percentage_bps)
VALUES
  ('018e0000-0004-7000-8000-000000000001', 'Stitch Instant EFT', 'instant_eft', ARRAY['ZAR'], true, 5000, 50000000, 500, 100),
  ('018e0000-0004-7000-8000-000000000002', 'M-Pesa Express', 'mobile_money', ARRAY['KES'], true, 1000, 15000000, 200, 150)
ON CONFLICT (name) DO NOTHING;

-- 7. Admin Roles and Permissions
INSERT INTO admin.admin_role (id, name, description)
VALUES
  ('018e0000-0005-7000-8000-000000000001', 'SuperAdmin', 'Unrestricted administrative access with maker-checker constraints'),
  ('018e0000-0005-7000-8000-000000000002', 'ComplianceOfficer', 'AML, sanctions, and Travel Rule management'),
  ('018e0000-0005-7000-8000-000000000003', 'FinancePayments', 'Fiat reconciliation and withdrawal approval'),
  ('018e0000-0005-7000-8000-000000000004', 'KYCReviewer', 'KYC document verification queue')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin.admin_permission (id, slug, description)
VALUES
  ('018e0000-0006-7000-8000-000000000001', 'kyc.approve', 'Approve submitted KYC documents and tier changes'),
  ('018e0000-0006-7000-8000-000000000002', 'fiat.withdrawal.approve', 'Authorize fiat withdrawals in the maker-checker queue'),
  ('018e0000-0006-7000-8000-000000000003', 'market.halt', 'Trigger market-level emergency trading circuit breakers'),
  ('018e0000-0006-7000-8000-000000000004', 'system.killswitch', 'Global emergency killswitch')
ON CONFLICT (slug) DO NOTHING;

-- 8. Test Development Admin Users (Hardware WebAuthn tokens simulated for dev)
INSERT INTO admin.admin_user (id, email, full_name, role_id, status, webauthn_credential_id, webauthn_public_key, webauthn_sign_counter)
VALUES
  ('018e0000-0007-7000-8000-000000000001', 'maker.admin@exchange.local', 'Alice Maker (Compliance)', '018e0000-0005-7000-8000-000000000002', 'active', 'dev_cred_maker_yubikey', 'dev_pubkey_mock', 0),
  ('018e0000-0007-7000-8000-000000000002', 'checker.admin@exchange.local', 'Bob Checker (Finance)', '018e0000-0005-7000-8000-000000000003', 'active', 'dev_cred_checker_yubikey', 'dev_pubkey_mock', 0)
ON CONFLICT (email) DO NOTHING;
