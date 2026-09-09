import assert from "node:assert/strict";
import test from "node:test";
import { dueReminders, filterTasks, parseTasks, reminderInstant } from "../app/task-reminders.ts";

const now = Date.parse("2026-09-09T12:00:00Z");
const task = { id: 1, title: "Call", meta: "Personal", source: "Personal", done: false, reminderAt: "2026-09-09T11:00:00Z" };

test("already alerted reminders cannot starve other due tasks", () => {
  const next = { ...task, id: 2 };
  const done = { ...task, id: 3, done: true };
  const future = { ...task, id: 4, reminderAt: "2026-09-10T12:00:00Z" };
  const alerted = new Set([`${task.id}:${task.reminderAt}`]);
  assert.deepEqual(dueReminders([task, next, done, future], alerted, now), [next]);
  assert.deepEqual(dueReminders([task, next], new Set(), now), [task, next]);
});

test("both reminder entry points reject invalid/past times and preserve the instant", () => {
  for (const input of ["", "invalid", "2026-09-09T11:59Z"]) assert.throws(() => reminderInstant(input, now), /future/);
  assert.equal(reminderInstant("2026-09-09T10:00:00-04:00", now), "2026-09-09T14:00:00.000Z");
});

test("saved tasks are validated before rendering and upcoming excludes completed tasks", () => {
  assert.deepEqual(parseTasks(JSON.stringify([task])), [task]);
  for (const value of [[null], [{ ...task, reminderAt: "bad" }], [task, task], [{ ...task, source: {} }], {}]) {
    assert.throws(() => parseTasks(JSON.stringify(value)), /Invalid/);
  }
  const upcoming = { ...task, id: 2, reminderAt: "2026-09-10T12:00:00Z" };
  assert.deepEqual(filterTasks([task, upcoming, { ...upcoming, id: 3, done: true }], "Upcoming", now), [upcoming]);
});
