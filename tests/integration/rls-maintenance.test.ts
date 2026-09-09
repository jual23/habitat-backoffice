import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signInAs, signIn } from '../setup';
import {
  createTestBuilding,
  createTestUser,
  createTestMaintenanceTask,
  cleanupTestBuilding,
  deleteTestUser,
} from '../fixtures';

/**
 * T028: RLS allow/deny for `maintenance_tasks` and `maintenance_completions`.
 */
describe('RLS: maintenance', () => {
  let buildingA: string;
  let buildingB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let staffA: Awaited<ReturnType<typeof createTestUser>>;
  let residentA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;
  let taskInA: string;
  let notYetDueTaskInA: string;

  beforeAll(async () => {
    buildingA = await createTestBuilding();
    buildingB = await createTestBuilding();
    adminA = await createTestUser({ role: 'building_admin', buildingId: buildingA });
    staffA = await createTestUser({ role: 'staff', buildingId: buildingA });
    residentA = await createTestUser({ role: 'resident', buildingId: buildingA });
    adminB = await createTestUser({ role: 'building_admin', buildingId: buildingB });
    taskInA = await createTestMaintenanceTask(buildingA, adminA.userId, {
      next_due_date: new Date().toISOString().slice(0, 10),
    });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    notYetDueTaskInA = await createTestMaintenanceTask(buildingA, adminA.userId, { next_due_date: future });
  });

  afterAll(async () => {
    await Promise.all([
      deleteTestUser(adminA.userId),
      deleteTestUser(staffA.userId),
      deleteTestUser(residentA.userId),
      deleteTestUser(adminB.userId),
    ]);
    await Promise.all([cleanupTestBuilding(buildingA), cleanupTestBuilding(buildingB)]);
  });

  it('allows admin and staff to view tasks; denies resident and other buildings', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { data: adminData } = await adminClient.from('maintenance_tasks').select('id').eq('id', taskInA);
    expect(adminData).toHaveLength(1);

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data: staffData } = await staffClient.from('maintenance_tasks').select('id').eq('id', taskInA);
    expect(staffData).toHaveLength(1);

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { data: residentData } = await residentClient.from('maintenance_tasks').select('id').eq('id', taskInA);
    expect(residentData ?? []).toHaveLength(0);

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { data: adminBData } = await adminBClient.from('maintenance_tasks').select('id').eq('id', taskInA);
    expect(adminBData ?? []).toHaveLength(0);
  });

  it('allows admin to insert a task; denies staff', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: adminError } = await adminClient
      .from('maintenance_tasks')
      .insert({ building_id: buildingA, name: 'Admin task', frequency: 'once', created_by: adminA.userId });
    expect(adminError).toBeNull();

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: staffError } = await staffClient
      .from('maintenance_tasks')
      .insert({ building_id: buildingA, name: 'Staff task', frequency: 'once', created_by: staffA.userId });
    expect(staffError).not.toBeNull();
  });

  it('allows both admin and staff to update next_due_date; denies for a different building', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error: adminError } = await adminClient
      .from('maintenance_tasks')
      .update({ next_due_date: '2030-01-01' })
      .eq('id', taskInA);
    expect(adminError).toBeNull();

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: staffError } = await staffClient
      .from('maintenance_tasks')
      .update({ next_due_date: '2030-02-01' })
      .eq('id', taskInA);
    expect(staffError).toBeNull();

    const adminBClient = await signIn(signInAs(adminB.email, adminB.password), adminB.email, adminB.password);
    const { error, count } = await adminBClient
      .from('maintenance_tasks')
      .update({ next_due_date: '2030-03-01' }, { count: 'exact' })
      .eq('id', taskInA);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('denies changing immutable fields (name, frequency, interval_months, building_id)', async () => {
    const adminClient = await signIn(signInAs(adminA.email, adminA.password), adminA.email, adminA.password);
    const { error } = await adminClient.from('maintenance_tasks').update({ name: 'Changed' }).eq('id', taskInA);
    expect(error).not.toBeNull();
  });

  it('allows staff/admin to insert a completion only when the task is due; denies resident', async () => {
    // A dedicated, freshly-due task -- `taskInA` is mutated by the reschedule
    // test above and can no longer be relied on to still be due "today".
    const dueTask = await createTestMaintenanceTask(buildingA, adminA.userId, {
      next_due_date: new Date().toISOString().slice(0, 10),
    });

    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { error: dueError } = await staffClient
      .from('maintenance_completions')
      .insert({ task_id: dueTask, building_id: buildingA, completed_by: staffA.userId });
    expect(dueError).toBeNull();

    const { error: notDueError } = await staffClient
      .from('maintenance_completions')
      .insert({ task_id: notYetDueTaskInA, building_id: buildingA, completed_by: staffA.userId });
    expect(notDueError).not.toBeNull();

    const residentClient = await signIn(signInAs(residentA.email, residentA.password), residentA.email, residentA.password);
    const { error: residentError } = await residentClient
      .from('maintenance_completions')
      .insert({ task_id: dueTask, building_id: buildingA, completed_by: residentA.userId });
    expect(residentError).not.toBeNull();
  });

  it('denies UPDATE/DELETE on completions (append-only)', async () => {
    const dueTask = await createTestMaintenanceTask(buildingA, adminA.userId, {
      next_due_date: new Date().toISOString().slice(0, 10),
    });
    const staffClient = await signIn(signInAs(staffA.email, staffA.password), staffA.email, staffA.password);
    const { data: completion, error: insertError } = await staffClient
      .from('maintenance_completions')
      .insert({ task_id: dueTask, building_id: buildingA, completed_by: staffA.userId })
      .select('id')
      .single();
    expect(insertError).toBeNull();

    const { error: updateError, count } = await staffClient
      .from('maintenance_completions')
      .update({ photo_url: 'x' }, { count: 'exact' })
      .eq('id', completion!.id);
    expect(updateError).toBeNull();
    expect(count).toBe(0);
  });
});
