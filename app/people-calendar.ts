export type Person = { id: string; name: string; email: string; phone: string; organization: string; account: string; source: "Google" | "iPhone" | "Demo" };
export type Calendar = { id: string; name: string; account: string; writable: boolean };
export type Event = { id: string; title: string; start: string; end: string; calendarId: string; account: string; source: "Google" | "iPhone"; etag?: string; allDay: boolean; attendees: string[]; recurring: boolean };
export type Session = { id: string; email: string; token: string; expiresAt: number; contacts: boolean; calendars: boolean };
type GooglePerson = { resourceName: string; names?: { displayName: string }[]; emailAddresses?: { value: string }[]; phoneNumbers?: { value: string }[]; organizations?: { name: string }[] };
type GoogleEvent = { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; etag: string; attendees?: { email: string }[]; recurringEventId?: string };

export async function googleRequest<T>(session: Session, url: string, init: RequestInit = {}): Promise<T> {
  const endpoint = new URL(url);
  if (!["www.googleapis.com", "people.googleapis.com"].includes(endpoint.hostname) || endpoint.protocol !== "https:") throw new Error("Invalid Google endpoint.");
  if (session.expiresAt <= Date.now()) throw new Error("Google access expired. Reconnect this account to continue.");
  const response = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(20000), redirect: "error", headers: { ...init.headers, Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" } });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Google access expired. Reconnect this account.");
    if (response.status === 403) throw new Error("Google denied access. Check granted permissions and that the Calendar and People APIs are enabled.");
    if (response.status === 412) throw new Error("This event changed in Google Calendar. Refresh events and review the latest version before editing.");
    if (response.status === 429) throw new Error("Google is receiving too many requests. Try again shortly.");
    throw new Error(`Google request failed (${response.status}). Try refreshing.`);
  }
  return response.json() as Promise<T>;
}

export async function googlePages<T>(session: Session, url: string, key: string): Promise<T[]> {
  const results: T[] = [];
  let pageToken: string | undefined;
  const seen = new Set<string>();
  do {
    const pageUrl = new URL(url);
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);
    const data = await googleRequest<Record<string, unknown>>(session, pageUrl.href);
    const items = data[key];
    if (Array.isArray(items)) results.push(...items as T[]);
    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : undefined;
    if (pageToken && seen.has(pageToken)) throw new Error("Google returned a repeated page. Retry the import.");
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return results;
}

export async function readPeople(session: Session): Promise<Person[]> {
  const people = await googlePages<GooglePerson>(session, "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000", "connections");
  return people.map(p => ({ id: `${session.id}:${p.resourceName}`, name: p.names?.[0]?.displayName || p.emailAddresses?.[0]?.value || "Unnamed contact", email: p.emailAddresses?.[0]?.value || "", phone: p.phoneNumbers?.[0]?.value || "", organization: p.organizations?.[0]?.name || "", account: session.email, source: "Google" }));
}

export async function readCalendars(session: Session): Promise<Calendar[]> {
  const calendars = await googlePages<{ id: string; summary: string; accessRole: string }>(session, "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", "items");
  return calendars.filter(c => c.accessRole !== "freeBusyReader").map(c => ({ id: c.id, name: c.summary, account: session.email, writable: ["owner", "writer"].includes(c.accessRole) }));
}

export async function readEvents(session: Session, calendarId: string): Promise<Event[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 30);
  const params = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "2500" });
  const events = await googlePages<GoogleEvent>(session, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, "items");
  return events.map(e => ({ id: e.id, title: e.summary || "Untitled event", start: e.start.dateTime || e.start.date!, end: e.end.dateTime || e.end.date!, calendarId, account: session.email, source: "Google", etag: e.etag, allDay: !e.start.dateTime, attendees: e.attendees?.map(a => a.email.toLowerCase()) || [], recurring: !!e.recurringEventId }));
}

export function validateEvent(title: string, start: string, end: string) {
  if (!title.trim() || title.length > 500) throw new Error("Enter an event title of 1–500 characters.");
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) throw new Error("Choose a valid end time after the start time.");
  return { summary: title.trim(), start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } };
}

export async function saveEvent(session: Session, calendarId: string, title: string, start: string, end: string, existing?: Event) {
  const body = validateEvent(title, start, end);
  if (existing && (!existing.etag || existing.attendees.length || existing.recurring || existing.allDay)) throw new Error("Edit shared, recurring, or all-day events in Google Calendar.");
  const path = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  // Stable for this request; no automatic retry of a write with an uncertain outcome.
  const id = crypto.randomUUID().replaceAll("-", "");
  return googleRequest(session, existing ? `${path}/${encodeURIComponent(existing.id)}` : path, {
    method: existing ? "PATCH" : "POST",
    headers: existing ? { "If-Match": existing.etag! } : {},
    body: JSON.stringify(existing ? body : { ...body, id }),
  });
}

export function parseIPhoneExport(text: string): { people: Person[]; events: Event[]; exportedAt: string } {
  if (text.length > 5_000_000) throw new Error("Choose an export smaller than 5 MB.");
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || typeof data.exportedAt !== "string" || !Number.isFinite(Date.parse(data.exportedAt)) || !Array.isArray(data.contacts) || !Array.isArray(data.events) || data.contacts.length > 10000 || data.events.length > 10000) throw new Error("Choose a valid Relay iPhone export.");
  function string(obj: Record<string, unknown>, key: string, limit = 1000) { if (typeof obj?.[key] !== "string" || (obj[key] as string).length > limit) throw new Error(`Invalid ${key} in iPhone export.`); return obj[key] as string; }
  const people = data.contacts.map((p: Record<string, unknown>): Person => ({ id: `iphone:${string(p, "id")}`, name: string(p, "name"), email: string(p, "email"), phone: string(p, "phone"), organization: string(p, "organization"), account: "Selected iPhone contacts", source: "iPhone" }));
  const events = data.events.map((e: Record<string, unknown>): Event => {
    const start = string(e, "start"), end = string(e, "end");
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start) || typeof e.allDay !== "boolean") throw new Error("Invalid event dates in iPhone export.");
    return { id: string(e, "id"), title: string(e, "title"), start, end, allDay: e.allDay, calendarId: string(e, "calendarId"), account: string(e, "calendarName"), source: "iPhone", attendees: [], recurring: false };
  });
  if (new Set(people.map((p: Person) => p.id)).size !== people.length) throw new Error("Duplicate contact IDs in this export.");
  return { people, events, exportedAt: data.exportedAt };
}

export function findPeople(people: Person[], query: string, source: string) { const needle = query.trim().toLowerCase(); return people.filter(p => (source === "All" || p.source === source) && `${p.name} ${p.email} ${p.phone} ${p.organization} ${p.account}`.toLowerCase().includes(needle)); }
export function duplicatesFor(person: Person, people: Person[]) { return people.filter(p => p.id !== person.id && ((person.email && p.email.toLowerCase() === person.email.toLowerCase()) || (person.phone.replace(/\D/g, "").length >= 7 && p.phone.replace(/\D/g, "") === person.phone.replace(/\D/g, "")))); }
