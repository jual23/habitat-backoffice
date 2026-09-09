import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './supabase/database.types';

/**
 * FR-038 / Constitution Principle IV: every server action that creates, edits,
 * deletes, approves, declines, or discards a resource calls this after the
 * mutation succeeds. Writes go through the `log_audit()` SECURITY DEFINER RPC
 * (research.md item 7) rather than a direct table insert — `audit_log` grants no
 * role a direct INSERT — so `actorId` MUST be the caller's own auth.uid(); the
 * RPC itself re-validates this server-side and throws if it doesn't match.
 */
export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  entry: {
    actorId: string;
    buildingId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata?: Json;
  },
) {
  const { error } = await supabase.rpc('log_audit', {
    _actor_id: entry.actorId,
    _building_id: entry.buildingId as unknown as string,
    _action: entry.action,
    _entity_type: entry.entityType,
    _entity_id: entry.entityId as unknown as string,
    _metadata: entry.metadata ?? null,
  });

  if (error) {
    // Audit-log failure must not silently vanish, but it also shouldn't be
    // allowed to mask the fact that the underlying mutation already succeeded.
    // Callers surface this via their own error handling / logging.
    throw new Error(`writeAuditLog failed: ${error.message}`);
  }
}
