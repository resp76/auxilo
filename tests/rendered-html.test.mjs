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
  assert.match(html, /Good morning, Rold\./);
  assert.match(html, /Today’s focus/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Add as many accounts as you need/);
  for (const provider of ["Gmail", "Outlook", "Yahoo", "Private Email", "Other email"]) assert.match(page, new RegExp(provider));
  for (const integration of ["Slack", "Linear", "Notion", "Apple Notes"]) assert.match(page, new RegExp(integration));
  assert.match(page, /Search iPhone Notes/);
  assert.match(page, /Relay for iPhone/);
});
