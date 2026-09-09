# Contract: Scheduled Edge Functions

Per research.md item 4, the two time-based rules in this feature are periodic sweeps, not
per-row jobs. Both run with the Supabase service role (bypassing RLS, since they act across all
buildings) and write to `audit_log` for every row they change.

## `visitor-expiry`

- **Trigger**: Cron schedule, every 10 minutes.
- **Input**: none (reads directly from the database).
- **Behavior**:
  ```sql
  UPDATE visitors
  SET status = 'expired'
  WHERE status = 'expected'
    AND created_at < now() - interval '8 hours';
  ```
  Because the `WHERE` clause only matches `status = 'expected'`, a visitor already marked
  `arrived` is never touched (FR-025) regardless of how much time has passed.
- **Output**: one `audit_log` row per visitor transitioned, `action = 'visitor.auto_expire'`,
  `actor_id` = a system/service account id reserved for automated actions.
- **Idempotent**: yes — re-running finds no matching rows once a batch has been processed.
- **Realizes**: FR-024, SC-003.

## `discard-cleanup`

- **Trigger**: Cron schedule, every 10 minutes.
- **Input**: none.
- **Behavior**:
  ```sql
  DELETE FROM suggestions_complaints
  WHERE discarded_at IS NOT NULL
    AND discarded_at < now() - interval '24 hours';
  ```
- **Output**: one `audit_log` row per row deleted, `action = 'suggestion_complaint.auto_delete'`,
  recording `entity_id`, `building_id`, and `type` in `metadata` before the row disappears (the
  audit row is the only remaining trace, by design).
- **Idempotent**: yes.
- **Realizes**: FR-033, SC-004.

## Not modeled as Edge Functions

- **Facility soft-delete → decline pending reservations** (FR-009): a synchronous database
  trigger (see data-model.md Triggers), not a scheduled function — it must take effect
  immediately when a Building Administrator deletes a facility, not on the next sweep.
- **Folder/document Storage object cleanup** (FR-029): performed by the server action that
  handles the delete request (it already has the folder's full document list before issuing the
  DB delete), not a background sweep.
- **Logo square-aspect validation** (FR-035): performed synchronously in the upload server action
  before the file is accepted, so the Building Administrator gets immediate feedback (Acceptance
  Scenario 3) rather than a delayed rejection.
