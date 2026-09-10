import test from "node:test";
import assert from "node:assert/strict";
import { pendingReminders, syncReminderNotifications } from "../app/mobile-notifications.ts";

const now = Date.parse("2026-09-10T12:00:00.000Z");
const at = (offsetMinutes) => new Date(now + offsetMinutes * 60_000).toISOString();

const task = (id, overrides = {}) => ({
  id, title: `Task ${id}`, meta: "", source: "Personal", done: false, ...overrides,
});

test("only future reminders on open tasks are scheduled", () => {
  const tasks = [
    task(1, { reminderAt: at(30) }),
    task(2, { reminderAt: at(-30) }),          // already passed
    task(3, { reminderAt: at(60), done: true }), // completed
    task(4),                                     // no reminder
  ];
  assert.deepEqual(pendingReminders(tasks, now).map(t => t.id), [1]);
});

test("soonest reminder is scheduled first", () => {
  const tasks = [task(1, { reminderAt: at(90) }), task(2, { reminderAt: at(10) }), task(3, { reminderAt: at(45) })];
  assert.deepEqual(pendingReminders(tasks, now).map(t => t.id), [2, 3, 1]);
});

test("scheduling stays within the iOS pending-notification limit", () => {
  const many = Array.from({ length: 200 }, (_, i) => task(i + 1, { reminderAt: at(i + 1) }));
  const scheduled = pendingReminders(many, now);
  assert.equal(scheduled.length, 60);
  // the cap must keep the SOONEST reminders, not an arbitrary 60
  assert.equal(scheduled[0].id, 1);
  assert.equal(scheduled[59].id, 60);
});

test("syncing is a no-op off-device and never throws", async () => {
  // Node is not the Capacitor shell, so this must return without touching the
  // plugin — the web build imports this module too.
  await assert.doesNotReject(syncReminderNotifications([task(1, { reminderAt: at(5) })], now));
});
