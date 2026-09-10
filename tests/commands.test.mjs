import test from "node:test";
import assert from "node:assert/strict";
import { filterCommands, matchesQuery, nextIndex } from "../app/commands.ts";
import { snoozeInstant, tomorrowAt } from "../app/task-reminders.ts";

const commands = [
  { id: "a", label: "Go to Tasks", group: "Navigate", run() {} },
  { id: "b", label: "Go to Integrations", group: "Navigate", run() {} },
  { id: "c", label: "Sign out", group: "Account", run() {} },
];

test("palette matches by substring, subsequence, and group", () => {
  assert.equal(matchesQuery("Go to Tasks", ""), true);
  assert.equal(matchesQuery("Go to Tasks", "tasks"), true);
  assert.equal(matchesQuery("Go to Tasks", "gtt"), true, "subsequence should match");
  assert.equal(matchesQuery("Go to Tasks", "zzz"), false);
  // multi-word queries fall back to substring only, so they cannot match loosely
  assert.equal(matchesQuery("Go to Tasks", "go tasks"), false);
  assert.deepEqual(filterCommands(commands, "account").map(c => c.id), ["c"]);
  assert.equal(filterCommands(commands, "").length, 3);
});

test("selection wraps in both directions and survives an empty list", () => {
  assert.equal(nextIndex(0, 3, -1), 2);
  assert.equal(nextIndex(2, 3, 1), 0);
  assert.equal(nextIndex(0, 0, 1), 0);
});

test("snooze always moves forward from now and rejects bad lengths", () => {
  const now = Date.parse("2026-09-09T22:00:00.000Z");
  assert.equal(snoozeInstant(60, now), "2026-09-09T23:00:00.000Z");
  assert.ok(Date.parse(snoozeInstant(10, now)) > now);
  assert.throws(() => snoozeInstant(0, now), /snooze length/);
  assert.throws(() => snoozeInstant(Number.NaN, now), /snooze length/);
});

test("tomorrow snooze lands on the next day at the chosen local hour", () => {
  const now = Date.parse("2026-09-09T22:00:00.000Z");
  const result = new Date(tomorrowAt(now, 9));
  assert.equal(result.getHours(), 9);
  assert.equal(result.getMinutes(), 0);
  assert.ok(result.getTime() > now);
  assert.equal(result.getDate(), new Date(now + 86400000).getDate());
});
