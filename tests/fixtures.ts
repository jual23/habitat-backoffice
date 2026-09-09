import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * T017: service-role test-fixture helpers, bypassing RLS to set up rows no UI
 * role can insert directly (per spec.md Assumptions: reservations, visitors,
 * feedback are created out-of-band by residents/other systems). Extended by
 * later user stories with createTestReservation(), createTestVisitor(),
 * createTestSuggestionComplaint() per tasks.md's T017 pattern.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment — this key must NEVER
 * be used from application code, only from this test-only module. Tests using
 * these helpers create their own throw-away users/buildings per run rather
 * than depending on a fixed seed, so they're safe to run repeatedly against a
 * shared project.
 */

let serviceClient: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'tests/fixtures.ts requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
    );
  }

  serviceClient = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}

export type TestRole = 'app_admin' | 'building_admin' | 'staff' | 'resident' | 'renter';

/**
 * Creates a real auth.users row (via the admin API) plus the corresponding
 * user_roles/profiles rows for the given role, and returns credentials a test
 * can use to sign in as that user with the anon client.
 *
 * 007-finance-ops-expansion (T003): 'renter' is apartment-scoped exactly like
 * 'resident' (no user_roles row) — only `profiles.tenant_type` differs.
 */
export async function createTestUser(opts: {
  role: TestRole;
  buildingId?: string | null;
  apartmentId?: string | null;
  emailPrefix?: string;
}) {
  const svc = getServiceClient();
  const email = `${opts.emailPrefix ?? opts.role}+${crypto.randomUUID()}@test.habitat.invalid`;
  const password = `Test-${crypto.randomUUID()}`;

  const { data: created, error: createError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`createTestUser: ${createError?.message}`);
  }

  const userId = created.user.id;

  if (opts.role === 'resident' || opts.role === 'renter') {
    await svc
      .from('profiles')
      .update({
        building_id: opts.buildingId ?? null,
        apartment_id: opts.apartmentId ?? null,
        tenant_type: opts.role,
      })
      .eq('id', userId);
  } else {
    const { error: roleError } = await svc.from('user_roles').insert({
      user_id: userId,
      role: opts.role,
      building_id: opts.role === 'app_admin' ? null : (opts.buildingId ?? null),
    });
    if (roleError) throw new Error(`createTestUser role insert: ${roleError.message}`);
  }

  return { userId, email, password };
}

export async function deleteTestUser(userId: string) {
  const svc = getServiceClient();
  await svc.auth.admin.deleteUser(userId).catch(() => undefined);
}

export async function createTestBuilding(overrides: Partial<{ name: string }> = {}) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('buildings')
    .insert({ name: overrides.name ?? `Test Building ${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestBuilding: ${error?.message}`);
  return data.id as string;
}

export async function createTestApartment(
  buildingId: string,
  overrides: Partial<{ tower: string | null; unit_number: string; floor: number | null }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('apartments')
    .insert({
      building_id: buildingId,
      tower: overrides.tower ?? null,
      unit_number: overrides.unit_number ?? `T-${crypto.randomUUID().slice(0, 8)}`,
      floor: overrides.floor ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestApartment: ${error?.message}`);
  return data.id as string;
}

export async function createTestProfile(
  userId: string,
  overrides: Partial<{ full_name: string; email: string; building_id: string; apartment_id: string }>,
) {
  const svc = getServiceClient();
  const { error } = await svc.from('profiles').update(overrides).eq('id', userId);
  if (error) throw new Error(`createTestProfile: ${error.message}`);
}

/** Deletes a building and everything under it (service role bypasses RLS/FKs are CASCADE). */
export async function cleanupTestBuilding(buildingId: string) {
  const svc = getServiceClient();
  await svc.from('buildings').delete().eq('id', buildingId);
}

/** US2: a reservable (or not) facility, for reservation/RLS tests. */
export async function createTestFacility(
  buildingId: string,
  overrides: Partial<{ name: string; reservable: boolean; image_url: string | null }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('facilities')
    .insert({
      building_id: buildingId,
      name: overrides.name ?? `Test Facility ${crypto.randomUUID().slice(0, 8)}`,
      reservable: overrides.reservable ?? true,
      // 003-upload-display-fix (T018): lets a test point a fixture facility at
      // a specific Storage path, without needing a real file upload.
      image_url: overrides.image_url ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestFacility: ${error?.message}`);
  return data.id as string;
}

/**
 * US2: a "requested" reservation. No UI role can insert reservations in this
 * feature (spec.md Assumptions — resident-facing creation is out of scope), so
 * this bypasses RLS like every other out-of-band fixture.
 */
/** US7: a resident-submitted suggestion/complaint (`feedback` table). */
export async function createTestSuggestionComplaint(
  buildingId: string,
  userId: string,
  overrides: Partial<{
    type: 'suggestion' | 'complaint';
    subject: string;
    discardedAt: Date | null;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('feedback')
    .insert({
      building_id: buildingId,
      user_id: userId,
      type: overrides.type ?? 'suggestion',
      subject: overrides.subject ?? `Test entry ${crypto.randomUUID().slice(0, 8)}`,
      discarded_at: overrides.discardedAt === undefined ? null : overrides.discardedAt?.toISOString() ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestSuggestionComplaint: ${error?.message}`);
  return data.id as string;
}

/**
 * US5: an expected/arrived visitor. `expiresAt` lets tests simulate a visitor
 * whose 8h window has already passed (for the visitor-expiry sweep test).
 */
export async function createTestVisitor(
  buildingId: string,
  createdBy: string,
  overrides: Partial<{ status: 'pending' | 'arrived' | 'expired'; expiresAt: Date; fullName: string }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('visitors')
    .insert({
      building_id: buildingId,
      created_by: createdBy,
      full_name: overrides.fullName ?? `Test Visitor ${crypto.randomUUID().slice(0, 8)}`,
      status: overrides.status ?? 'pending',
      expires_at: (overrides.expiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000)).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestVisitor: ${error?.message}`);
  return data.id as string;
}

/**
 * 004-facilities-incidencias-packages (T003): a resident-reported ticket
 * ("Incidencia"). Ticket creation is out of this feature's scope (spec.md
 * Assumptions), so this bypasses RLS like every other out-of-band fixture.
 */
export async function createTestTicket(
  buildingId: string,
  reportedBy: string,
  overrides: Partial<{
    apartment_id: string | null;
    title: string;
    description: string | null;
    status: 'pending' | 'in_progress' | 'rejected' | 'resolved' | 'duplicate';
    rejection_reason: string | null;
    duplicate_of_ticket_id: string | null;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('tickets')
    .insert({
      building_id: buildingId,
      reported_by: reportedBy,
      apartment_id: overrides.apartment_id ?? null,
      title: overrides.title ?? `Test Ticket ${crypto.randomUUID().slice(0, 8)}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'pending',
      rejection_reason: overrides.rejection_reason ?? null,
      duplicate_of_ticket_id: overrides.duplicate_of_ticket_id ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestTicket: ${error?.message}`);
  return data.id as string;
}

/** 004-facilities-incidencias-packages (T003): a comment on a ticket. */
export async function createTestTicketComment(
  ticketId: string,
  authorId: string,
  overrides: Partial<{ body: string }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      author_id: authorId,
      body: overrides.body ?? `Test comment ${crypto.randomUUID().slice(0, 8)}`,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestTicketComment: ${error?.message}`);
  return data.id as string;
}

/** 004-facilities-incidencias-packages (T018): a registered package. */
export async function createTestPackage(
  buildingId: string,
  apartmentId: string,
  registeredBy: string,
  overrides: Partial<{
    description: string;
    photo_url: string | null;
    status: 'pending' | 'picked_up';
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('packages')
    .insert({
      building_id: buildingId,
      apartment_id: apartmentId,
      registered_by: registeredBy,
      description: overrides.description ?? `Test Package ${crypto.randomUUID().slice(0, 8)}`,
      photo_url: overrides.photo_url ?? null,
      status: overrides.status ?? 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestPackage: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T010): a payment record for an apartment. */
export async function createTestPayment(
  buildingId: string,
  apartmentId: string,
  overrides: Partial<{
    amount: number;
    status: 'pending' | 'submitted' | 'received' | 'overdue';
    available_date: string;
    due_date: string;
    late_fee_amount: number | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
  }> = {},
) {
  const svc = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await svc
    .from('payments')
    .insert({
      building_id: buildingId,
      apartment_id: apartmentId,
      amount: overrides.amount ?? 100,
      status: overrides.status ?? 'pending',
      available_date: overrides.available_date ?? today,
      due_date: overrides.due_date ?? today,
      late_fee_amount: overrides.late_fee_amount ?? null,
      reviewed_by: overrides.reviewed_by ?? null,
      reviewed_at: overrides.reviewed_at ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestPayment: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T027): a maintenance task. */
export async function createTestMaintenanceTask(
  buildingId: string,
  createdBy: string,
  overrides: Partial<{
    name: string;
    frequency: 'once' | 'weekly' | 'monthly' | 'every_n_months';
    interval_months: number | null;
    next_due_date: string | null;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('maintenance_tasks')
    .insert({
      building_id: buildingId,
      name: overrides.name ?? `Test Task ${crypto.randomUUID().slice(0, 8)}`,
      frequency: overrides.frequency ?? 'monthly',
      interval_months: overrides.interval_months ?? null,
      next_due_date: overrides.next_due_date === undefined ? new Date().toISOString().slice(0, 10) : overrides.next_due_date,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestMaintenanceTask: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T027): a maintenance task completion (append-only). */
export async function createTestMaintenanceCompletion(
  taskId: string,
  buildingId: string,
  completedBy: string,
  overrides: Partial<{ photo_url: string | null }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('maintenance_completions')
    .insert({
      task_id: taskId,
      building_id: buildingId,
      completed_by: completedBy,
      photo_url: overrides.photo_url ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestMaintenanceCompletion: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T040): a poll. */
export async function createTestPoll(
  buildingId: string,
  createdBy: string,
  overrides: Partial<{
    title: string;
    allow_multiple: boolean;
    anonymous: boolean;
    closes_at: string;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('polls')
    .insert({
      building_id: buildingId,
      title: overrides.title ?? `Test Poll ${crypto.randomUUID().slice(0, 8)}`,
      allow_multiple: overrides.allow_multiple ?? false,
      anonymous: overrides.anonymous ?? false,
      closes_at: overrides.closes_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestPoll: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T040): a poll answer option. */
export async function createTestPollOption(
  pollId: string,
  overrides: Partial<{ label: string; sort_order: number }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('poll_options')
    .insert({
      poll_id: pollId,
      label: overrides.label ?? `Option ${crypto.randomUUID().slice(0, 8)}`,
      sort_order: overrides.sort_order ?? 0,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestPollOption: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T040): a poll vote, attributed to an apartment. */
export async function createTestPollVote(
  pollId: string,
  apartmentId: string,
  optionId: string,
  voterId: string,
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('poll_votes')
    .insert({ poll_id: pollId, apartment_id: apartmentId, option_id: optionId, voter_id: voterId })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestPollVote: ${error?.message}`);
  return data.id as string;
}

/** 007-finance-ops-expansion (T052): a resident-reported emergency. */
export async function createTestEmergency(
  buildingId: string,
  reportedBy: string,
  overrides: Partial<{
    apartment_id: string | null;
    description: string | null;
    status: 'unhandled' | 'resolved';
    resolved_by: string | null;
    resolved_at: string | null;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('emergencies')
    .insert({
      building_id: buildingId,
      reported_by: reportedBy,
      apartment_id: overrides.apartment_id ?? null,
      description: overrides.description ?? `Test emergency ${crypto.randomUUID().slice(0, 8)}`,
      status: overrides.status ?? 'unhandled',
      resolved_by: overrides.resolved_by ?? null,
      resolved_at: overrides.resolved_at ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestEmergency: ${error?.message}`);
  return data.id as string;
}

/** 008-broadcast-message-persistence (T003): a broadcast alert. */
export async function createTestBroadcast(
  buildingId: string,
  sentBy: string,
  overrides: Partial<{
    message: string;
    icon: string | null;
    template_id: string | null;
    status: 'active' | 'deactivated';
    deactivated_by: string | null;
    deactivated_at: string | null;
  }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('broadcasts')
    .insert({
      building_id: buildingId,
      message: overrides.message ?? `Test broadcast ${crypto.randomUUID().slice(0, 8)}`,
      icon: overrides.icon ?? null,
      template_id: overrides.template_id ?? null,
      status: overrides.status ?? 'active',
      sent_by: sentBy,
      deactivated_by: overrides.deactivated_by ?? null,
      deactivated_at: overrides.deactivated_at ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestBroadcast: ${error?.message}`);
  return data.id as string;
}

/** 008-broadcast-message-persistence (T003): a reusable predetermined broadcast message. */
export async function createTestBroadcastTemplate(
  buildingId: string,
  createdBy: string,
  overrides: Partial<{ message: string; icon: string | null }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('broadcast_templates')
    .insert({
      building_id: buildingId,
      message: overrides.message ?? `Test template ${crypto.randomUUID().slice(0, 8)}`,
      icon: overrides.icon ?? null,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestBroadcastTemplate: ${error?.message}`);
  return data.id as string;
}

export async function createTestReservation(
  buildingId: string,
  facilityId: string,
  userId: string,
  overrides: Partial<{ reserved_date: string; start_time: string; end_time: string }> = {},
) {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('reservations')
    .insert({
      building_id: buildingId,
      facility_id: facilityId,
      user_id: userId,
      reserved_date: overrides.reserved_date ?? new Date().toISOString().slice(0, 10),
      start_time: overrides.start_time ?? '10:00',
      end_time: overrides.end_time ?? '11:00',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestReservation: ${error?.message}`);
  return data.id as string;
}
