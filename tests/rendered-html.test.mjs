import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Relay dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Relay — Your day, in sync<\/title>/i);
  assert.match(html, /Preparing Relay/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8");
  assert.match(auth, /Continue with Google/);
  assert.match(auth, /Email me a sign-in link/);
  assert.match(auth, /Create an account/);
  assert.match(auth, /Continue with demo workspace/);
  assert.match(auth, /signInWithOAuth/);
  assert.match(auth, /signInWithOtp/);
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /auth\.signUp/);
  assert.match(page, /Add as many accounts as you need/);
  for (const provider of ["Gmail", "Outlook", "Yahoo", "Private Email", "Other email"]) assert.match(page, new RegExp(provider));
  for (const integration of ["Slack", "Linear", "Notion", "Apple Notes"]) assert.match(page, new RegExp(integration));
  assert.match(page, /Search iPhone Notes/);
  assert.match(page, /Relay for iPhone/);
});

test("serves only the public authentication configuration", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("auth-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/auth/config"),
    {
      SUPABASE_URL: "https://relay.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    url: "https://relay.supabase.co",
    publishableKey: "sb_publishable_test",
  });
});
