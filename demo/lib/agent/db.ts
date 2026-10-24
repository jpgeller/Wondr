// The agent's writes to the plans table, with the service role key (bypasses RLS).
// Server only. Kept here instead of lib/supabase/ so A and B do not edit the same file;
// switch to B's admin client once it lands.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Plan, PlanRow, ProgressMessage } from '../types';

let client: SupabaseClient | null = null;

export function adminDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function getPlanRow(planId: string): Promise<PlanRow | null> {
  const { data, error } = await adminDb().from('plans').select('*').eq('id', planId).maybeSingle();
  if (error) throw new Error(`Load plan: ${error.message}`);
  return data as PlanRow | null;
}

/** Appends one progress message. One writer per plan at a time, so read-modify-write is fine. */
export async function appendProgress(planId: string, message: string, step?: string): Promise<void> {
  const row = await getPlanRow(planId);
  const progress: ProgressMessage[] = [...(row?.progress ?? []), { at: new Date().toISOString(), message, step }];
  const { error } = await adminDb().from('plans').update({ progress }).eq('id', planId);
  if (error) console.error('[agent] progress write failed', error.message);
}

export async function saveResult(planId: string, result: Plan, status: 'planning' | 'ready' = 'ready'): Promise<void> {
  const { error } = await adminDb().from('plans').update({ result, status, error: null }).eq('id', planId);
  if (error) throw new Error(`Save plan: ${error.message}`);
}

export async function markFailed(planId: string, message: string): Promise<void> {
  const { error } = await adminDb().from('plans').update({ status: 'failed', error: message }).eq('id', planId);
  if (error) console.error('[agent] failed-status write failed', error.message);
}
