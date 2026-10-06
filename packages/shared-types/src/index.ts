/**
 * Unified Domain Types for Hybrid Exchange Platform
 * All numeric currency amounts/quantities are represented as strings of integers in smallest atomic units (e.g. wei, satoshis).
 */

export type UUID = string;
export type TimestampISO = string;
export type AtomicAmount = string; // Integer string in smallest units (NUMERIC(38,0))
export type HexString = `0x${string}`;

// ==========================================
// 1. IDENTITY DOMAIN
// ==========================================
export type UserStatus = 'active' | 'suspended' | 'frozen' | 'closed';

export interface User {
  id: UUID;
  email: string | null;
  wallet_address: HexString | null;
  status: UserStatus;
  kyc_level_id: UUID;
  created_at: TimestampISO;
  updated_at: TimestampISO;
}

export type CredentialType = 'passkey' | 'siwe' | 'totp' | 'recovery_code';

export interface UserCredential {
  id: UUID;
  user_id: UUID;
  credential_type: CredentialType;
  external_id: string; // WebAuthn Credential ID or public key
  public_key: string;
  counter: number;
  transports: string[] | null;
  nickname: string;
  created_at: TimestampISO;
  last_used_at: TimestampISO | null;
}

export interface Session {
  id: UUID;
  user_id: UUID;
  token_hash: string;
  ip_address: string;
  user_agent: string;
  expires_at: TimestampISO;
  revoked_at: TimestampISO | null;
  created_at: TimestampISO;
}

// ==========================================
// 2. LEDGER DOMAIN (Double-Entry Core)
// ==========================================
export type AssetClass = 'crypto' | 'fiat' | 'stablecoin';

export interface Asset {
  id: UUID;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  decimals: number;
  contract_address: HexString | null;
  chain_id: number | null;
  is_active: boolean;
  min_withdrawal: AtomicAmount;
  withdrawal_fee: AtomicAmount;
  created_at: TimestampISO;
  updated_at: TimestampISO;
}

export type AccountType =
  | 'user_available'
  | 'user_held'
  | 'system_fee'
  | 'system_insurance'
  | 'system_hot_wallet'
  | 'system_settlement_clearing';

export interface Account {
  id: UUID;
  user_id: UUID | null; // null for system accounts
  asset_id: UUID;
  account_type: AccountType;
  created_at: TimestampISO;
}

export interface JournalEntry {
  id: UUID;
  sequence_number: number;
  reference_type: 'trade' | 'deposit' | 'withdrawal' | 'hold' | 'release' | 'fee' | 'reconciliation';
  reference_id: UUID;
  description: string;
  created_at: TimestampISO;
}

export interface JournalLine {
  id: UUID;
  journal_entry_id: UUID;
  account_id: UUID;
  debit: AtomicAmount;  // Either debit > 0 or credit > 0
  credit: AtomicAmount;
  created_at: TimestampISO;
}

export interface BalanceSnapshot {
  id: UUID;
  account_id: UUID;
  balance: AtomicAmount;
  sequence_number: number;
  created_at: TimestampISO;
}

// ==========================================
// 3. TRADING & MATCHING ENGINE DOMAIN
// ==========================================
export type OrderSide = 'buy' | 'sell';
export type OrderType =
  | 'limit'
  | 'market'
  | 'stop'
  | 'stop_limit'
  | 'post_only'
  | 'ioc'
  | 'fok'
  | 'twap'
  | 'iceberg';

export type OrderStatus =
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface Market {
  id: UUID;
  symbol: string; // e.g., 'BTC-USDT', 'USDT-ZAR'
  base_asset_id: UUID;
  quote_asset_id: UUID;
  tick_size: AtomicAmount;
  lot_size: AtomicAmount;
  min_order_size: AtomicAmount;
  max_order_size: AtomicAmount;
  maker_fee_bps: number;
  taker_fee_bps: number;
  is_active: boolean;
  is_halted: boolean;
  created_at: TimestampISO;
  updated_at: TimestampISO;
}

export interface Order {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  client_order_id: string | null;
  side: OrderSide;
  order_type: OrderType;
  price: AtomicAmount;
  quantity: AtomicAmount;
  filled_quantity: AtomicAmount;
  remaining_quantity: AtomicAmount;
  status: OrderStatus;
  nonce: number;
  expiry: number; // UNIX timestamp
  signature: HexString; // EIP-712 user signature
  created_at: TimestampISO;
  updated_at: TimestampISO;
}

export interface Trade {
  id: UUID;
  sequence_number: number;
  market_id: UUID;
  maker_order_id: UUID;
  taker_order_id: UUID;
  maker_user_id: UUID;
  taker_user_id: UUID;
  side: OrderSide;
  price: AtomicAmount;
  quantity: AtomicAmount;
  maker_fee: AtomicAmount;
  taker_fee: AtomicAmount;
  fee_asset_id: UUID;
  created_at: TimestampISO;
}

export interface SettlementBatch {
  id: UUID;
  batch_number: number;
  merkle_root: HexString;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  tx_hash: HexString | null;
  submitted_at: TimestampISO | null;
  confirmed_at: TimestampISO | null;
  created_at: TimestampISO;
}

// ==========================================
// 4. CUSTODY & ON-CHAIN DOMAIN
// ==========================================
export interface Chain {
  id: number; // e.g. 8453 (Base), 42161 (Arbitrum)
  name: string;
  is_evm: boolean;
  vault_address: HexString;
  settlement_address: HexString;
  required_confirmations: number;
  is_active: boolean;
}

export interface DepositAddress {
  id: UUID;
  user_id: UUID;
  chain_id: number;
  address: HexString;
  created_at: TimestampISO;
}

export interface OnchainDeposit {
  id: UUID;
  user_id: UUID;
  chain_id: number;
  asset_id: UUID;
  tx_hash: HexString;
  log_index: number;
  from_address: HexString;
  to_address: HexString;
  amount: AtomicAmount;
  status: 'pending' | 'confirming' | 'credited' | 'failed';
  confirmations: number;
  block_number: number;
  created_at: TimestampISO;
  credited_at: TimestampISO | null;
}

export interface OnchainWithdrawal {
  id: UUID;
  user_id: UUID;
  chain_id: number;
  asset_id: UUID;
  to_address: HexString;
  amount: AtomicAmount;
  fee_amount: AtomicAmount;
  status: 'pending_risk' | 'pending_approval' | 'processing' | 'submitted' | 'confirmed' | 'rejected' | 'failed';
  tx_hash: HexString | null;
  risk_score: number;
  created_at: TimestampISO;
  confirmed_at: TimestampISO | null;
}

// ==========================================
// 5. AUDIT & ADMIN DOMAIN
// ==========================================
export interface AuditEvent {
  id: UUID;
  sequence_number: number;
  prev_hash: string;
  hash: string;
  actor_id: UUID;
  actor_type: 'admin' | 'system' | 'user';
  action: string;
  entity_type: string;
  entity_id: UUID;
  ip_address: string;
  user_agent: string;
  reason?: string;
  details: Record<string, unknown>;
  created_at: TimestampISO;
}

export interface ApprovalRequest {
  id: UUID;
  action_type: 'fiat_withdrawal' | 'hot_wallet_change' | 'market_halt' | 'fee_change' | 'role_change' | 'account_unfreeze';
  entity_id: UUID;
  requester_id: UUID;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  required_approvals: number;
  expires_at: TimestampISO;
  created_at: TimestampISO;
}

// ==========================================
// 6. EIP-712 TYPED DATA DEFINITIONS
// ==========================================
export const EIP712_ORDER_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  Order: [
    { name: 'user', type: 'address' },
    { name: 'market', type: 'string' },
    { name: 'side', type: 'uint8' },
    { name: 'price', type: 'uint128' },
    { name: 'quantity', type: 'uint128' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
} as const;
