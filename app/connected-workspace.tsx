"use client";

import { useEffect, useRef, useState } from "react";
import { duplicatesFor, findPeople, parseIPhoneExport, readCalendars, readEvents, readPeople, saveEvent } from "./people-calendar";
import type { Calendar, Event, Person, Session } from "./people-calendar";
import { apiUrl, isNativeShell } from "./api-base.ts";
import { readDeviceSnapshot } from "./native-device.ts";

type TokenResponse = { access_token: string; expires_in: number; scope: string; error?: string };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; include_granted_scopes: boolean; callback: (response: TokenResponse) => void; error_callback: () => void }) => { requestAccessToken: (options: { prompt: string }) => void }; revoke: (token: string, callback: () => void) => void } } };
declare global { interface Window { google?: GoogleIdentity } }

const contactScope = "https://www.googleapis.com/auth/contacts.readonly";
const calendarScope = "https://www.googleapis.com/auth/calendar.events";
const listScope = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const demoPeople: Person[] = [
  { id: "demo-maya", name: "Maya Chen", email: "maya@example.com", phone: "", organization: "Studio • Client work", account: "Sample Google account", source: "Demo" },
  { id: "demo-jordan", name: "Jordan Lee", email: "jordan@example.com", phone: "", organization: "Website launch", account: "Sample iPhone contacts", source: "Demo" },
  { id: "demo-maya-phone", name: "Maya Chen", email: "maya@example.com", phone: "", organization: "Studio", account: "Sample iPhone contacts", source: "Demo" },
];

export function useConnectedWorkspace() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [imported, setImported] = useState("");
  const [clientId, setClientId] = useState("");
  const [sdk, setSdk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [contactsEnabled, setContactsEnabled] = useState(true);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [lastRead, setLastRead] = useState("");
  const operation = useRef(0);

  useEffect(() => {
    void fetch(apiUrl("/api/google/config")).then(r => r.json()).then((r: { clientId?: string }) => { if (r.clientId) setClientId(r.clientId); }).catch(() => {});
  }, []);

  function loadGoogle() {
    if (window.google) { setSdk(true); return; }
    setBusy(true); setMessage("Loading Google sign-in…");
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    const timer = window.setTimeout(() => { setBusy(false); setMessage("Google sign-in took too long. Check your connection and try again."); script.remove(); }, 15000);
    script.onload = () => { clearTimeout(timer); setSdk(true); setBusy(false); setMessage("Google sign-in is ready. Choose your account below."); };
    script.onerror = () => { clearTimeout(timer); setBusy(false); setMessage("Google sign-in could not load. Check your connection and try again."); script.remove(); };
    document.head.appendChild(script);
  }

  function connect() {
    if (!window.google || busy) return;
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) { setMessage("A Google OAuth web client ID is required. See setup instructions below."); return; }
    const permissions = ["openid", "email", ...(contactsEnabled ? [contactScope] : []), ...(calendarEnabled ? [calendarScope, listScope] : [])];
    setBusy(true); setMessage("Waiting for Google authorization…");
    const run = ++operation.current;
    window.google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: permissions.join(" "), include_granted_scopes: false,
      error_callback: () => { setBusy(false); setMessage("Sign-in was closed or blocked. You can try again."); },
      callback: async response => {
        try {
          if (response.error || !response.access_token) throw new Error("Google access was not granted. Your data has not been imported.");
          const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${response.access_token}` } });
          if (!profileResponse.ok) throw new Error("Could not verify the selected Google account.");
          const profile = await profileResponse.json() as { sub: string; email: string };
          if (!profile.sub || !profile.email) throw new Error("Google did not return an account identity.");
          const scopes = response.scope.split(" ");
          const session: Session = { id: profile.sub, email: profile.email, token: response.access_token, expiresAt: Date.now() + Number(response.expires_in) * 1000, contacts: contactsEnabled && scopes.includes(contactScope), calendars: calendarEnabled && scopes.includes(calendarScope) && scopes.includes(listScope) };
          if (run !== operation.current) return;
          setSessions(current => [...current.filter(s => s.id !== session.id), session]);
          setPeople(current => current.filter(p => !(p.source === "Google" && p.account === session.email)));
          setCalendars(current => current.filter(c => c.account !== session.email));
          setEvents(current => current.filter(e => !(e.source === "Google" && e.account === session.email)));
          setMessage(`Authorized ${profile.email}. Choose Refresh contacts or select calendars to fetch data.${!session.contacts && !session.calendars ? " Calendar and Contacts permissions were not granted." : ""}`);
          if (session.calendars) {
            const next = await readCalendars(session);
            if (run === operation.current) setCalendars(current => [...current.filter(c => c.account !== session.email), ...next]);
          }
        } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); }
        finally { setBusy(false); }
      },
    }).requestAccessToken({ prompt: "select_account" });
  }

  async function refresh() {
    const run = ++operation.current;
    setBusy(true); setMessage("Reading selected Google sources…");
    try {
      const nextPeople: Person[] = [], nextEvents: Event[] = [];
      for (const session of sessions) {
        if (session.contacts) nextPeople.push(...await readPeople(session));
        if (session.calendars) {
          for (const calendar of calendars.filter(c => c.account === session.email && selectedCalendars.includes(`${c.account}:${c.id}`))) nextEvents.push(...await readEvents(session, calendar.id));
        }
      }
      if (run !== operation.current) return;
      setPeople(current => [...current.filter(p => p.source !== "Google"), ...nextPeople]);
      setEvents(current => [...current.filter(e => e.source !== "Google"), ...nextEvents]);
      const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); setLastRead(now);
      setMessage(`Updated at ${now}. ${nextPeople.length} Google contacts and ${nextEvents.length} events. Events cover the next 30 days.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Refresh failed. Previous data was preserved."); }
    finally { setBusy(false); }
  }

  function disconnect(session: Session) {
    ++operation.current;
    setSessions(current => current.filter(s => s.id !== session.id));
    setPeople(current => current.filter(p => !(p.source === "Google" && p.account === session.email)));
    setCalendars(current => current.filter(c => c.account !== session.email));
    setEvents(current => current.filter(e => !(e.source === "Google" && e.account === session.email)));
    setSelectedCalendars(current => current.filter(key => !key.startsWith(`${session.email}:`)));
    setMessage(`Removed ${session.email} from this session. Manage Google permissions to revoke Auxilo access.`);
  }

  // One path for both sources: a file the user picked, or the device itself.
  // Everything goes through parseIPhoneExport so validation cannot be skipped.
  function applySnapshot(text: string, origin: string) {
    const data = parseIPhoneExport(text);
    setPeople(current => [...current.filter(p => p.source !== "iPhone"), ...data.people]);
    setEvents(current => [...current.filter(e => e.source !== "iPhone"), ...data.events]);
    setImported(data.exportedAt);
    setMessage(`Imported ${data.people.length} selected iPhone contacts and ${data.events.length} events ${origin}. This replaces the previous iPhone snapshot.`);
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Choose an export smaller than 5 MB.");
      applySnapshot(await file.text(), "from that export");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import this file."); }
  }

  async function importFromPhone() {
    setBusy(true);
    setMessage("Choose the contacts to include, then allow calendar access…");
    try {
      const snapshot = await readDeviceSnapshot();
      if (!snapshot) throw new Error("Reading this device is only available in the Auxilo app.");
      applySnapshot(snapshot, "from this iPhone");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read this device."); }
    finally { setBusy(false); }
  }

  function removeImport() { setPeople(current => current.filter(p => p.source !== "iPhone")); setEvents(current => current.filter(e => e.source !== "iPhone")); setImported(""); setMessage("iPhone import removed from this tab."); }
  return { sessions, people, calendars, events, clientId, setClientId, sdk, loadGoogle, connect, busy, setBusy, message, setMessage, importFromPhone, isNativeShell, contactsEnabled, setContactsEnabled, calendarEnabled, setCalendarEnabled, selectedCalendars, setSelectedCalendars, refresh, disconnect, importFile, imported, removeImport, lastRead };
}
type Sources = ReturnType<typeof useConnectedWorkspace>;

export function SourceConnections({ sources: s }: { sources: Sources }) {
  return <section className="source-connections" aria-label="Calendar and contact connections">
    <div className="section-heading"><div><span className="section-kicker">Calendar & people</span><h2>Your accounts, together</h2></div></div>
    <div className="source-grid">
      <section className="module-card source-panel">
        <div className="source-panel-heading"><span className="connection-logo calendar">G</span><div><h2>Google Calendar & Contacts</h2><p>{s.sessions.length ? `${s.sessions.length} authorized account${s.sessions.length > 1 ? "s" : ""}` : "Not connected"}</p></div></div>
        <p>Read contacts and manage events. Connect each work or personal account separately.</p>
        <div className="source-options"><label><input type="checkbox" checked={s.calendarEnabled} onChange={e => s.setCalendarEnabled(e.target.checked)} /> Calendar events · read and write</label><label><input type="checkbox" checked={s.contactsEnabled} onChange={e => s.setContactsEnabled(e.target.checked)} /> Google Contacts · read only</label></div>
        <details className="setup-details" open={!s.clientId}><summary>Google setup</summary><p>Auxilo needs an OAuth web client ID with this site registered as an authorized JavaScript origin. Enable the Google Calendar and People APIs, and add test users while your consent screen is in testing.</p><label>Public client ID<input value={s.clientId} onChange={e => s.setClientId(e.target.value.trim())} placeholder="…apps.googleusercontent.com" autoComplete="off" /></label><p>A client ID is public. Do not paste a client secret.</p><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud setup ↗</a></details>
        <button className="primary-action" disabled={s.busy || (!s.contactsEnabled && !s.calendarEnabled) || !s.clientId} onClick={s.sdk ? s.connect : s.loadGoogle}>{s.sdk ? "Choose Google account" : "Load Google sign-in"}</button>
        {s.sessions.map(session => <div className="account-line" key={session.id}><div><strong>{session.email}</strong><small>Session access · reconnect after expiry</small></div><button disabled={s.busy} onClick={() => s.disconnect(session)}>Disconnect</button></div>)}
        {s.sessions.length > 0 && <><button className="secondary-action" disabled={s.busy} onClick={s.refresh}>Refresh contacts & selected calendars</button><a className="source-link" href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Manage Google permissions ↗</a></>}
      </section>
      <section className="module-card source-panel">
        <div className="source-panel-heading"><span className="connection-logo apple-notes"></span><div><h2>iPhone Calendar & Contacts</h2><p>{s.imported ? "Snapshot loaded · no automatic sync" : s.isNativeShell ? "Read directly from this iPhone" : "Requires the Auxilo iPhone app"}</p></div></div>
        {s.isNativeShell ? <>
          <p>Pick the contacts to include and allow calendar access. Only what you choose is read, and nothing leaves this device.</p>
          <button className="primary-action" disabled={s.busy} onClick={() => void s.importFromPhone()}>{s.busy ? "Reading\u2026" : "Read contacts & calendar"}</button>
        </> : <>
          <p>Open Auxilo on your iPhone to read contacts and calendars directly. In a browser you can still import a snapshot exported from the companion app.</p>
          <a className="secondary-action" href="/auxilo-iphone-companion.zip" download>Download iPhone companion source</a>
          <label className="file-import">Import iPhone export<input type="file" accept=".json,application/json" onChange={e => { void s.importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </>}
        {s.imported && <div className="account-line"><div><strong>Snapshot from {new Date(s.imported).toLocaleString()}</strong><small>Read only in Auxilo · edit originals on iPhone</small></div><button onClick={s.removeImport}>Remove import</button></div>}
        <p className="muted-copy">Tokens and imported data stay in this browser tab’s memory. Reloading clears them. Import only on a device you trust.</p>
      </section>
    </div>
    {s.calendars.length > 0 && <section className="module-card source-panel"><h2>Choose calendars to read</h2><p>Events are fetched only for checked calendars. Uncheck one to remove its events from view.</p><div className="calendar-choices">{s.calendars.map(c => { const key = `${c.account}:${c.id}`; return <label key={key} aria-label={`${c.name} — ${c.account}`}><input type="checkbox" checked={s.selectedCalendars.includes(key)} onChange={e => s.setSelectedCalendars(current => e.target.checked ? [...current, key] : current.filter(k => k !== key))} /><span><strong>{c.name}</strong><small>{c.account} · {c.writable ? "Can edit" : "Read only"}</small></span></label>; })}</div></section>}
    {s.message && <p className="source-feedback" role="status">{s.message}</p>}
  </section>;
}

export function PeopleWorkspace({ sources: s, query, onFollowUp, onCalendar, onSetup }: { sources: Sources; query: string; onFollowUp: (person: Person) => void; onCalendar: () => void; onSetup: () => void }) {
  const [source, setSource] = useState("All"), [selected, setSelected] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const [demo, setDemo] = useState(false);
  const [feedback, setFeedback] = useState("");
  const people = demo ? demoPeople : s.people;
  const matches = findPeople(findPeople(people, query, source), localQuery, "All");
  const active = matches.find(p => p.id === selected) || matches[0];
  const duplicates = active ? duplicatesFor(active, people) : [];
  const relatedEvents = active?.email ? s.events.filter(e => e.attendees.includes(active.email.toLowerCase()) && (e.source !== "Google" || s.selectedCalendars.includes(`${e.account}:${e.calendarId}`))) : [];
  return <div className="people-workspace">
    <div className="workspace-toolbar"><label className="people-search">Search contacts<input value={localQuery} onChange={e => setLocalQuery(e.target.value)} placeholder="Name, email, phone, or company" /></label><label>Source<select value={source} onChange={e => setSource(e.target.value)}>{["All", "Google", "iPhone", ...(demo ? ["Demo"] : [])].map(value => <option key={value}>{value}</option>)}</select></label><button className="secondary-action" onClick={onSetup}>Manage sources</button></div>
    <div className="workspace-toolbar"><span>{matches.length} contacts · {demo ? "Sample data" : "Current tab only"}</span><button className="text-action" onClick={() => { setDemo(!demo); setSource("All"); setFeedback(""); }}>{demo ? "Return to my contacts" : "Explore sample contacts"}</button></div>
    <div className="people-grid">
      <section className="module-card people-list" aria-label="Contact results">{matches.length ? matches.map(person => <button className={`person-row${active?.id === person.id ? " selected" : ""}`} key={person.id} onClick={() => { setSelected(person.id); setFeedback(""); }} aria-pressed={active?.id === person.id}><span className="person-avatar">{person.name.split(" ").slice(0, 2).map(n => n[0]).join("")}</span><span><strong>{person.name}</strong><small>{person.organization || person.email || "Contact"}</small><small>{person.source} · {person.account}</small></span></button>) : <div className="people-empty"><h2>{people.length ? "No matches" : "Your people belong here"}</h2><p>{people.length ? "Try another name, company, or source." : "Connect Google or import selected iPhone contacts to find the people behind your work."}</p><button className="primary-action" onClick={onSetup}>Add a source</button></div>}</section>
      <section className="module-card person-detail">{active ? <><span className="section-kicker">{active.source === "Demo" ? "Example contact" : active.source}</span><h2>{active.name}</h2><p>{active.organization}</p><dl><dt>Email</dt><dd>{active.email || "Not provided"}</dd><dt>Phone</dt><dd>{active.phone || "Not provided"}</dd><dt>Source account</dt><dd>{active.account}</dd></dl><div className="detail-actions"><button className="primary-action" onClick={() => { onFollowUp(active); setFeedback(`Added a local follow-up task for ${active.name}.`); }}>Create follow-up</button><button className="secondary-action" onClick={onCalendar}>Open calendar</button></div>{feedback && <p role="status">{feedback}</p>}<h3>Upcoming meetings</h3>{relatedEvents.length ? relatedEvents.map(event => <p key={`${event.account}:${event.calendarId}:${event.id}`}>{event.title}<small className="source-link">{new Date(event.start).toLocaleString()}</small></p>) : <p className="muted-copy">No matching attendee email in the calendars you have loaded.</p>}{duplicates.length > 0 && <div className="duplicate-note"><strong>Possible duplicate{duplicates.length > 1 ? "s" : ""}</strong><p>Matching email or phone in {duplicates.map(p => p.account).join(", ")}. Records remain separate; review them in the source app before merging.</p></div>}<p className="muted-copy">Contacts are read only. Email, Notes, and GitHub relationships will appear when those services supply live records.</p></> : <div className="people-empty"><h2>Contact details</h2><p>Select a person to see contact information and related meetings.</p></div>}</section>
    </div>
  </div>;
}

function localInput(value: string) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export function ConnectedCalendar({ sources: s, onSetup }: { sources: Sources; onSetup: () => void }) {
  const [editing, setEditing] = useState<Event | null | undefined>(undefined);
  const [title, setTitle] = useState(""), [start, setStart] = useState(""), [end, setEnd] = useState(""), [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false), [feedback, setFeedback] = useState("");
  const visible = s.events.filter(e => e.source === "iPhone" || s.selectedCalendars.includes(`${e.account}:${e.calendarId}`)).sort((a, b) => a.start.localeCompare(b.start));
  const writable = s.calendars.filter(c => c.writable && s.selectedCalendars.includes(`${c.account}:${c.id}`));
  function edit(event: Event | null) { setEditing(event); setTitle(event?.title || ""); setStart(event ? localInput(event.start) : ""); setEnd(event ? localInput(event.end) : ""); setTarget(event ? JSON.stringify([event.account, event.calendarId]) : writable[0] ? JSON.stringify([writable[0].account, writable[0].id]) : ""); setFeedback(""); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFeedback("");
    try {
      const [account, id] = JSON.parse(target) as string[];
      const calendar = writable.find(c => c.id === id && c.account === account);
      const session = s.sessions.find(accountSession => accountSession.email === account);
      if (!calendar || !session) throw new Error("Select an authorized, writable Google calendar.");
      await saveEvent(session, id, title, start, end, editing || undefined);
      setEditing(undefined); setFeedback("Saved in Google Calendar. Refreshing the event list…");
      await s.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Could not save. Refresh to check whether Google received the change before retrying."); }
    finally { setSaving(false); }
  }
  return <section className="connected-calendar">
    <div className="workspace-toolbar"><div><h2>Connected calendars</h2><p className="muted-copy">Next 30 days · {s.lastRead ? `Google last read ${s.lastRead}` : "Choose calendars in Integrations"}</p></div><button className="secondary-action" onClick={onSetup}>Manage sources</button><button className="primary-action" disabled={!writable.length || saving || s.busy} onClick={() => edit(null)}>New event</button><button className="secondary-action" disabled={!s.sessions.length || s.busy || saving} onClick={s.refresh}>Refresh</button></div>
    {s.message && <p className="source-feedback" role="status">{s.message}</p>}
    {editing !== undefined && <form className="module-card event-form" onSubmit={submit}><h2>{editing ? "Edit event" : "New event"}</h2><label>Calendar<select required disabled={!!editing || saving} value={target} onChange={e => setTarget(e.target.value)}>{writable.map(c => <option key={`${c.account}:${c.id}`} value={JSON.stringify([c.account, c.id])}>{c.name} · {c.account}</option>)}</select></label><label>Title<input required maxLength={500} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Start<input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label>End<input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label><p>Times use this device’s timezone. This saves a personal event without sending invitations.</p><div className="detail-actions"><button className="primary-action" disabled={saving || s.busy} type="submit">{saving ? "Saving…" : "Save to Google Calendar"}</button><button className="secondary-action" disabled={saving} type="button" onClick={() => setEditing(undefined)}>Cancel</button></div></form>}
    {feedback && <p role="status" className="source-feedback">{feedback}</p>}
    <section className="module-card event-list">{visible.length ? visible.map(event => <article key={`${event.source}:${event.account}:${event.calendarId}:${event.id}`}><div><strong>{event.title}</strong><p>{event.allDay ? `${event.start.slice(0, 10)} · All day` : new Date(event.start).toLocaleString()} · {event.source}</p><small>{event.account}{event.source === "iPhone" ? " · Imported snapshot" : ""}</small></div>{event.source === "Google" && !event.allDay && !event.recurring && !event.attendees.length && writable.some(c => c.id === event.calendarId && c.account === event.account) ? <button className="secondary-action" disabled={saving || s.busy} onClick={() => edit(event)}>Edit</button> : <span className="muted-copy">Edit in source app</span>}</article>) : <div className="people-empty"><h2>No connected events to show</h2><p>Authorize Google, select calendars, and refresh—or import a snapshot from your iPhone.</p></div>}</section>
  </section>;
}
