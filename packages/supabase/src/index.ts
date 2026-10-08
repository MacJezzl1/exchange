import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string;
}

/**
 * Creates a browser/client-side Supabase client with public anon key.
 * Used in Trader Terminal, Transparency Center, and client SDKs.
 */
export function createExchangeSupabaseClient(
  url = process.env['SUPABASE_URL'] || 'https://hvayastdrwippkaltrbt.supabase.co',
  anonKey = process.env['SUPABASE_ANON_KEY'] || 'sb_publishable_MaLAEpbCKGi70x1_KTgmkw_YEFEFGwv'
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 50,
      },
    },
  });
}

/**
 * Creates an administrative backend Supabase client using the service role key.
 * Bypasses Row Level Security for settlement, matching engine, and admin audit logging.
 */
export function createAdminSupabaseClient(
  url = process.env['SUPABASE_URL'] || 'https://placeholder-project.supabase.co',
  serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'service-role-key-placeholder'
): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Subscribes to Supabase Realtime broadcast or postgres_changes for live trade feeds.
 */
export function subscribeToMarketTrades(
  supabase: SupabaseClient,
  marketSymbol: string,
  onTrade: (payload: any) => void
) {
  return supabase
    .channel(`market:${marketSymbol}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'trading',
        table: 'trade',
      },
      (payload) => {
        onTrade(payload.new);
      }
    )
    .subscribe();
}

/**
 * Subscribes to user-specific balance changes in the double-entry ledger.
 */
export function subscribeToUserBalanceUpdates(
  supabase: SupabaseClient,
  userId: string,
  onBalanceUpdate: (payload: any) => void
) {
  return supabase
    .channel(`user-balances:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'ledger',
        table: 'account',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onBalanceUpdate(payload.new);
      }
    )
    .subscribe();
}
