import { isNativeShell } from "./api-base.ts";
import type { Task } from "./task-reminders.ts";

/**
 * Mirror pending reminders into iOS local notifications.
 *
 * The web build can only alert while a tab is open — its reminder loop is a
 * setInterval. Scheduling with the OS is the whole point of the native shell:
 * reminders fire with the app closed.
 *
 * This re-syncs wholesale (cancel all, reschedule what is pending) rather than
 * diffing, so add, edit, snooze, complete and delete all flow through one path
 * and cannot drift out of step with the task list.
 */

// iOS notification ids must fit in a 32-bit int; task ids are timestamps or
// 32-bit hashes. ponytail: a collision would drop one reminder, which is
// acceptable at task-list scale — revisit with a per-task id map if it bites.
const notificationId = (taskId: number) => Math.abs(taskId) % 2147483647;

const IOS_PENDING_LIMIT = 60; // iOS keeps only ~64 pending notifications per app

export async function syncReminderNotifications(tasks: Task[], now = Date.now()): Promise<void> {
  if (!isNativeShell) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    let granted = (await LocalNotifications.checkPermissions()).display === "granted";
    if (!granted) granted = (await LocalNotifications.requestPermissions()).display === "granted";
    if (!granted) return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel(pending);

    const upcoming = pendingReminders(tasks, now);
    if (!upcoming.length) return;

    await LocalNotifications.schedule({
      notifications: upcoming.map(task => ({
        id: notificationId(task.id),
        title: "Auxilo reminder",
        body: task.title,
        schedule: { at: new Date(task.reminderAt!) },
      })),
    });
  } catch {
    // In-app reminders still work; never let notification plumbing break the UI.
  }
}

/** Exported for tests: reminders still ahead of `now`, soonest first, capped. */
export function pendingReminders(tasks: Task[], now: number): Task[] {
  return tasks
    .filter(task => !task.done && task.reminderAt && Date.parse(task.reminderAt) > now)
    .sort((a, b) => Date.parse(a.reminderAt!) - Date.parse(b.reminderAt!))
    .slice(0, IOS_PENDING_LIMIT);
}
