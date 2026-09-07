// Typed data access for the AI assistant's conversation memory
// (assistant_threads / assistant_messages). Thin wrappers over supabase; RLS
// (policies at_rw / am_rw) does the authorization — these just shape the calls.

import { requireSupabase } from '@/lib/saath/client';
import type { AssistantMessage, AssistantMeta, AssistantRole, AssistantThread } from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** The farmer's most recently active thread, or null if they've never chatted. */
export async function getLatestThread(farmerId: string): Promise<AssistantThread | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('assistant_threads')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AssistantThread | null;
}

/** All of the farmer's threads, most recent first. */
export async function listThreads(farmerId: string): Promise<AssistantThread[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('assistant_threads')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('last_message_at', { ascending: false }),
  );
}

export async function createThread(farmerId: string, title?: string): Promise<AssistantThread> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('assistant_threads')
      .insert({ farmer_id: farmerId, title: title ?? null })
      .select()
      .single(),
  );
}

export async function getThreadMessages(threadId: string): Promise<AssistantMessage[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('assistant_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
  );
}

export async function appendMessage(m: {
  threadId: string;
  role: AssistantRole;
  content: string;
  meta?: AssistantMeta | null;
}): Promise<AssistantMessage> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('assistant_messages')
      .insert({
        thread_id: m.threadId,
        role: m.role,
        content: m.content,
        meta: m.meta ?? null,
      })
      .select()
      .single(),
  );
}

/** Patch an already-stored message's meta (e.g. mark an action as sent). */
export async function updateMessageMeta(
  messageId: string,
  meta: AssistantMeta,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('assistant_messages')
    .update({ meta })
    .eq('id', messageId);
  if (error) throw new Error(error.message);
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('assistant_threads')
    .update({ title })
    .eq('id', threadId);
  if (error) throw new Error(error.message);
}
