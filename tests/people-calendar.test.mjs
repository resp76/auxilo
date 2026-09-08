import test from "node:test";
import assert from "node:assert/strict";
import { duplicatesFor, findPeople, googlePages, googleRequest, parseIPhoneExport, readPeople, saveEvent, validateEvent } from "../app/people-calendar.ts";

const session = { id: "google-1", email: "owner@example.com", token: "test-token", expiresAt: Date.now() + 600000, contacts: true, calendars: true };
const fixture = { version: 1, exportedAt: "2026-09-08T15:00:00Z", contacts: [{ id: "p1", name: "Jane Doe", email: "jane@example.com", phone: "+1 212 555 0100", organization: "Example" }], events: [{ id: "e1", title: "All day", start: "2026-09-09", end: "2026-09-10", calendarId: "cal1", calendarName: "Personal", allDay: true }] };

test("validates selected iPhone export and never trusts provider fields from the file", () => {
  const data = parseIPhoneExport(JSON.stringify(fixture));
  assert.equal(data.people[0].source, "iPhone");
  assert.equal(data.events[0].source, "iPhone");
  assert.equal(data.events[0].start, "2026-09-09");
  assert.equal(data.events[0].allDay, true);
  assert.throws(() => parseIPhoneExport(JSON.stringify({ ...fixture, version: 2 })), /valid Relay/);
  assert.throws(() => parseIPhoneExport(JSON.stringify({ ...fixture, contacts: [fixture.contacts[0], fixture.contacts[0]] })), /Duplicate/);
  assert.throws(() => parseIPhoneExport(JSON.stringify({ ...fixture, events: [{ ...fixture.events[0], end: "invalid" }] })), /dates/);
  assert.throws(() => parseIPhoneExport(JSON.stringify({ ...fixture, contacts: [{ ...fixture.contacts[0], email: {} }] })), /email/);
  assert.throws(() => parseIPhoneExport("x".repeat(5000001)), /5 MB/);
});

test("search and duplicate suggestions retain separate source identities", () => {
  const iphone = parseIPhoneExport(JSON.stringify(fixture)).people[0];
  const google = { ...iphone, id: "g:p1", source: "Google", account: "work@example.com" };
  const contacts = [iphone, google];
  assert.equal(findPeople(contacts, " JANE ", "Google").length, 1);
  assert.equal(findPeople(contacts, "work@example.com", "All").length, 1);
  assert.equal(findPeople(contacts, "nonexistent", "All").length, 0);
  assert.deepEqual(duplicatesFor(iphone, contacts), [google]);
  assert.equal(contacts.length, 2);
  assert.equal(duplicatesFor({ ...iphone, email: "", phone: "" }, [google]).length, 0);
});

test("Google reads pagination and labels each record with its owning account", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-token");
    calls++;
    if (calls === 1) return Response.json({ connections: [{ resourceName: "people/1", names: [{ displayName: "First" }] }], nextPageToken: "page2" });
    assert.equal(new URL(url).searchParams.get("pageToken"), "page2");
    return Response.json({ connections: [{ resourceName: "people/2", names: [{ displayName: "Second" }] }] });
  });
  const people = await readPeople(session);
  assert.equal(people.length, 2);
  assert.equal(people[1].id, "google-1:people/2");
  assert.equal(people[1].account, session.email);
});

test("expired access and untrusted endpoints cannot send a bearer token", async t => {
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; return Response.json({}); });
  await assert.rejects(googleRequest(session, "https://attacker.example/"), /Invalid/);
  await assert.rejects(googleRequest({ ...session, expiresAt: 0 }, "https://people.googleapis.com/v1/people/me"), /expired/);
  assert.equal(called, false);
});

test("writes require valid dates and use If-Match to protect concurrent edits", async t => {
  assert.throws(() => validateEvent("Meeting", "2026-09-10T15:00", "2026-09-10T14:00"), /after/);
  const event = { id: "event-1", etag: "v1", attendees: [], recurring: false, allDay: false };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers["If-Match"], "v1");
    assert.equal(JSON.parse(options.body).summary, "Moved meeting");
    return new Response(null, { status: 412 });
  });
  await assert.rejects(saveEvent(session, "work@example.com", "Moved meeting", "2026-09-10T15:00Z", "2026-09-10T16:00Z", event), /changed in Google/);
  await assert.rejects(saveEvent(session, "work", "Meeting", "2026-09-10T15:00Z", "2026-09-10T16:00Z", { ...event, attendees: ["jane@example.com"] }), /source|Google Calendar/);
});

test("pagination guards against repeated cursors", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ items: [], nextPageToken: "loop" }));
  await assert.rejects(googlePages(session, "https://www.googleapis.com/calendar/v3/users/me/calendarList", "items"), /repeated page/);
});
