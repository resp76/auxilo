import test from "node:test";
import assert from "node:assert/strict";
import { isLikelyKey, mapLinearIssue, mapNotionPage, mapSlackMatch, notionTitle, readLinearTasks, readNotionTasks, readSlackTasks, stableId } from "../app/connectors.ts";

const linearKey = "lin_api_" + "a".repeat(24);
const notionKey = "ntn_" + "b".repeat(24);
const slackKey = "xoxp-" + "1".repeat(20);

test("key shapes are validated before any request leaves the tab", async t => {
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; return Response.json({}); });
  await assert.rejects(readLinearTasks("nope"), /Linear personal API key/);
  await assert.rejects(readNotionTasks("nope"), /Notion integration token/);
  await assert.rejects(readSlackTasks("nope"), /Slack user token/);
  assert.equal(called, false);
  assert.equal(isLikelyKey("linear", linearKey), true);
  assert.equal(isLikelyKey("notion", notionKey), true);
  assert.equal(isLikelyKey("slack", slackKey), true);
  assert.equal(isLikelyKey("slack", "xoxb-bot-token-not-user"), false);
});

test("ids are stable per source and do not collide across sources", () => {
  assert.equal(stableId("linear:abc"), stableId("linear:abc"));
  assert.notEqual(stableId("linear:abc"), stableId("notion:abc"));
  assert.ok(Number.isSafeInteger(stableId("linear:abc")));
});

test("Linear reads issues assigned to the viewer and surfaces API errors", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://api.linear.app/graphql");
    assert.equal(options.headers.Authorization, linearKey);
    assert.match(JSON.parse(options.body).query, /assignedIssues/);
    return Response.json({ data: { viewer: { assignedIssues: { nodes: [
      { id: "i1", identifier: "ENG-12", title: "Fix login" },
      { id: "i1", identifier: "ENG-12", title: "duplicate" },
    ] } } } });
  });
  const tasks = await readLinearTasks(linearKey);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].source, "Linear");
  assert.equal(tasks[0].meta, "ENG-12 · Linear");

  t.mock.method(globalThis, "fetch", async () => Response.json({ errors: [{ message: "Authentication required" }] }));
  await assert.rejects(readLinearTasks(linearKey), /Authentication required/);
});

test("Notion routes through the allowlisted proxy and reads page titles", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "/api/connector");
    assert.equal(options.headers["x-relay-provider"], "notion");
    assert.equal(options.headers["x-relay-path"], "/v1/search");
    assert.equal(options.headers["x-relay-key"], notionKey);
    return Response.json({ results: [{ id: "p1", properties: { Name: { type: "title", title: [{ plain_text: "Launch " }, { plain_text: "plan" }] } } }] });
  });
  const tasks = await readNotionTasks(notionKey);
  assert.equal(tasks[0].title, "Launch plan");
  assert.equal(tasks[0].source, "Notion");
  assert.equal(notionTitle({ id: "x", properties: {} }), "Untitled page");
});

test("Slack surfaces ok:false errors and truncates long messages", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error: "not_allowed_token_type" }));
  await assert.rejects(readSlackTasks(slackKey), /not_allowed_token_type/);

  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, messages: { matches: [{ ts: "1.1", text: "x".repeat(200), channel: { name: "general" } }] } }));
  const tasks = await readSlackTasks(slackKey);
  assert.equal(tasks[0].title.length, 118);
  assert.equal(tasks[0].meta, "#general · Slack");
});

test("mappers degrade safely on missing fields", () => {
  assert.equal(mapLinearIssue({ id: "a", identifier: "A-1", title: "" }).title, "Untitled issue");
  assert.equal(mapNotionPage({ id: "b" }).title, "Untitled page");
  assert.equal(mapSlackMatch({ ts: "1", text: "hi" }).meta, "Direct message · Slack");
});
