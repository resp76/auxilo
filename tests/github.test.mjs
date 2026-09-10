import test from "node:test";
import assert from "node:assert/strict";
import { githubRequest, isLikelyToken, mapGitHubIssue, readGitHubTasks } from "../app/github.ts";

const token = "github_pat_" + "a".repeat(30);

test("token shape is validated before any request", async t => {
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; return Response.json([]); });
  await assert.rejects(readGitHubTasks("not-a-token"), /GitHub token/);
  assert.equal(called, false);
  assert.equal(isLikelyToken(token), true);
  assert.equal(isLikelyToken("hello"), false);
});

test("untrusted endpoints and empty tokens never send a bearer header", async t => {
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; return Response.json([]); });
  await assert.rejects(githubRequest("ghp_x", "https://attacker.example/issues"), /Invalid/);
  await assert.rejects(githubRequest("", "https://api.github.com/issues"), /token/);
  assert.equal(called, false);
});

test("assigned issues and pull requests map to tasks and de-duplicate", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(new URL(url).searchParams.get("filter"), "assigned");
    return Response.json([
      { id: 1, number: 184, title: "Review homepage", html_url: "https://github.com/acme/web/pull/184", pull_request: {}, repository: { full_name: "acme/web" } },
      { id: 2, number: 12, title: "Fix crash", html_url: "https://github.com/acme/api/issues/12", repository: { full_name: "acme/api" } },
      { id: 1, number: 184, title: "dup", html_url: "https://github.com/acme/web/pull/184", pull_request: {}, repository: { full_name: "acme/web" } },
    ]);
  });
  const tasks = await readGitHubTasks(token);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].source, "GitHub");
  assert.equal(tasks[0].meta, "acme/web #184 · Pull request");
  assert.equal(tasks[1].meta, "acme/api #12 · Issue");
});

test("mapper falls back to the html url when repository is absent", () => {
  const task = mapGitHubIssue({ id: 5, number: 7, title: "X", html_url: "https://github.com/o/r/issues/7" });
  assert.equal(task.meta, "o/r #7 · Issue");
});
