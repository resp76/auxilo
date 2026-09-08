"use client";

import { useMemo, useState } from "react";
import { ConnectedCalendar, PeopleWorkspace, SourceConnections, useConnectedWorkspace } from "./connected-workspace";
import type { Person } from "./people-calendar";

type Task = {
  id: number;
  title: string;
  meta: string;
  source: "GitHub" | "Gmail" | "Personal" | "Calendar";
  done: boolean;
  priority?: boolean;
};

type EmailAccount = { id: number; provider: string; address: string };

const notes = [
  { id: 1, title: "Q4 launch ideas", folder: "Work", updated: "Today, 8:42 AM", preview: "Homepage story, customer proof, launch checklist…", body: "Q4 launch ideas\n\n• Tighten the homepage story\n• Ask Maya for two customer quotes\n• Draft the launch checklist\n• Schedule the final review" },
  { id: 2, title: "Books to read", folder: "Personal", updated: "Yesterday", preview: "The Creative Act, Tomorrow and Tomorrow…", body: "Books to read\n\nThe Creative Act\nTomorrow, and Tomorrow, and Tomorrow\nThe Design of Everyday Things" },
  { id: 3, title: "Client kickoff notes", folder: "Client work", updated: "Sep 5", preview: "Primary goal: reduce onboarding time…", body: "Client kickoff notes\n\nPrimary goal: reduce onboarding time.\nDecision makers: Maya and Jordan.\nNext step: send revised scope by Friday." },
  { id: 4, title: "Weekend errands", folder: "Personal", updated: "Sep 3", preview: "Dentist, groceries, return package…", body: "Weekend errands\n\nDentist appointment\nGroceries\nReturn package\nPick up dry cleaning" },
];

const emailProviders = [
  ["Gmail", "M", "Google", "Gmail and Google Workspace"],
  ["Outlook", "O", "Microsoft", "Outlook, Hotmail, and Microsoft 365"],
  ["Yahoo", "Y!", "Yahoo", "Yahoo Mail accounts"],
  ["Private Email", "P", "Namecheap", "Private Email accounts"],
  ["Other email", "@", "IMAP / SMTP", "iCloud, Fastmail, and other providers"],
];

const initialTasks: Task[] = [
  { id: 1, title: "Review homepage pull request", meta: "Launch project · Due 10:30 AM", source: "GitHub", done: false, priority: true },
  { id: 2, title: "Send revised proposal to Maya", meta: "Client work · Due 1:00 PM", source: "Gmail", done: false, priority: true },
  { id: 3, title: "Outline Q4 planning doc", meta: "Studio · Today", source: "Personal", done: false, priority: true },
  { id: 4, title: "Book dentist appointment", meta: "Personal · This week", source: "Personal", done: false },
  { id: 5, title: "Triage repository notifications", meta: "8 unread mentions", source: "GitHub", done: false },
];

const iconFor: Record<Task["source"], string> = {
  GitHub: "⌘",
  Gmail: "M",
  Personal: "✓",
  Calendar: "□",
};

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [nav, setNav] = useState("Today");
  const [customizing, setCustomizing] = useState(false);
  const [compact, setCompact] = useState(false);
  const [connections, setConnections] = useState<Record<string, boolean>>({ Calendar: false, GitHub: false });
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailProvider, setEmailProvider] = useState("Gmail");
  const [emailAddress, setEmailAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const sources = useConnectedWorkspace();
  function followUp(person: Person) {
    setTasks(current => [...current, { id: Date.now(), title: `Follow up with ${person.name}`, meta: `${person.email || person.organization || person.account} · Local task${person.source === "Demo" ? " · Sample contact" : ""}`, source: "Personal", done: false, priority: true }]);
  }
  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setTasks((current) => [...current, { id: Date.now(), title, meta: "Personal · Added just now", source: "Personal", done: false, priority: true }]);
    setNewTask("");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="Relay home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Relay</span>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {["Today", "Inbox", "Calendar", "Tasks", "Projects", "People", "Notes", "Integrations"].map((item) => (
            <button key={item} className={nav === item ? "nav-item active" : "nav-item"} onClick={() => setNav(item)}>
              <span className="nav-icon" aria-hidden="true">{item === "Today" ? "☀" : item === "Inbox" ? "↙" : item === "Calendar" ? "□" : item === "Tasks" ? "✓" : item === "Projects" ? "◇" : item === "Notes" ? "▤" : "⇄"}</span>
              {item}
              {item === "Inbox" && <span className="nav-count">7</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-label">Spaces</div>
        <nav className="spaces" aria-label="Spaces">
          <button><span className="space-dot purple" />Studio</button>
          <button><span className="space-dot coral" />Client work</button>
          <button><span className="space-dot green" />Personal</button>
        </nav>

        <div className="sidebar-footer">
          <button className="sync-status" onClick={() => setNav("Integrations")}><span className="live-dot" />{sources.sessions.length ? `${sources.sessions.length} Google account(s)` : "Demo workspace · View sources"}</button>
          <div className="profile">
            <div className="avatar">RE</div>
            <div><strong>Rold</strong><span>Personal workspace</span></div>
            <button aria-label="Workspace menu">•••</button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation"><span className="brand-mark small"><i /><i /><i /></span></button>
          <div className="search"><span>⌕</span><input aria-label="Search notes or people" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={nav === "People" ? "Search people…" : nav === "Notes" ? "Search iPhone Notes…" : "Search people…"} onKeyDown={e => { if (e.key === "Enter" && nav !== "Notes") setNav("People"); }} /></div>
          <div className="top-actions">
            <button className={customizing ? "customize-button active" : "customize-button"} onClick={() => setCustomizing((value) => !value)}>Customize</button>
            <button className="icon-button" aria-label="Notifications">♢<span className="notice-dot" /></button>
            <button className="add-button" onClick={() => document.getElementById("quick-add")?.focus()}><span>＋</span> Add task</button>
          </div>
        </header>

        {customizing && (
          <section className="customize-strip" aria-label="Dashboard customization">
            <div><strong>Make Relay yours</strong><span>Choose how much you see at a glance.</span></div>
            <label><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /> Compact task rows</label>
            <button onClick={() => setCustomizing(false)}>Done</button>
          </section>
        )}

        {nav === "People" && <section className="module-page"><header className="module-header"><p className="eyebrow">Workspace</p><h1>People</h1><p>Find a person. See what connects you. Make time to follow up.</p></header><PeopleWorkspace sources={sources} query={searchQuery} onFollowUp={followUp} onCalendar={() => setNav("Calendar")} onSetup={() => setNav("Integrations")} /></section>}
        {nav !== "Today" && nav !== "People" && (
          <ModuleView
            name={nav}
            tasks={tasks}
            toggleTask={toggleTask}
            connections={connections}
            toggleConnection={(name) => setConnections((current) => ({ ...current, [name]: !current[name] }))}
            emailAccounts={emailAccounts}
            emailProvider={emailProvider}
            emailAddress={emailAddress}
            setEmailProvider={setEmailProvider}
            setEmailAddress={setEmailAddress}
            addEmailAccount={(event) => {
              event.preventDefault();
              const address = emailAddress.trim().toLowerCase();
              if (!address || emailAccounts.some((account) => account.address === address)) return;
              setEmailAccounts((current) => [...current, { id: Date.now(), provider: emailProvider, address }]);
              setEmailAddress("");
            }}
            removeEmailAccount={(id) => setEmailAccounts((current) => current.filter((account) => account.id !== id))}
            searchQuery={searchQuery}
            sources={sources}
            onSetup={() => setNav("Integrations")}
          />
        )}

        <div className={nav === "Today" ? `content-grid${compact ? " compact" : ""}` : "content-grid is-hidden"}>
          <section className="primary-column">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">Tuesday, September 8</p>
                <h1>Good morning, Rold.</h1>
                <p className="lede">Sample day · Open People or Calendar for connected data.</p>
              </div>
              <div className="day-score"><strong>{tasks.length - completed}</strong><span>open today</span></div>
            </div>

            <section className="focus-card">
              <div className="focus-top">
                <div><span className="section-kicker">Today’s focus</span><h2>Three things move everything forward.</h2></div>
                <span className="progress-label">{completed}/{tasks.length} complete</span>
              </div>
              <div className="progress-track"><span style={{ width: `${Math.max(8, completed / tasks.length * 100)}%` }} /></div>
              <div className="task-list">
                {tasks.filter((task) => task.priority).map((task) => (
                  <article key={task.id} className={task.done ? "task-row is-done" : "task-row"}>
                    <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}>{task.done ? "✓" : ""}</button>
                    <div className="task-copy"><h3>{task.title}</h3><p>{task.meta}</p></div>
                    <span className={`source-badge ${task.source.toLowerCase()}`}><b>{iconFor[task.source]}</b>{task.source}</span>
                    <button className="row-menu" aria-label={`More options for ${task.title}`}>•••</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="agenda-section">
              <div className="section-heading"><div><span className="section-kicker">Up next</span><h2>Your schedule</h2></div><button>Open calendar <span>→</span></button></div>
              <div className="agenda-card">
                <div className="time-column"><span>9 AM</span><span>10 AM</span><span>11 AM</span><span>12 PM</span></div>
                <div className="events-column">
                  <article className="event purple-event"><span className="event-time">9:30</span><div><strong>Weekly product sync</strong><small>Studio team · Google Meet</small></div><div className="mini-avatars"><i>JS</i><i>AM</i><i>+2</i></div></article>
                  <article className="event sand-event"><span className="event-time">11:00</span><div><strong>Deep work: Q4 planning</strong><small>Focus time · 60 min</small></div><span className="focus-pill">Focus</span></article>
                </div>
              </div>
            </section>
          </section>

          <aside className="right-rail">
            <section className="rail-card quick-add">
              <div className="rail-title"><h2>Quick add</h2><span>⌘ ↵</span></div>
              <div className="quick-input"><input id="quick-add" value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="What needs doing?" /><button onClick={addTask} aria-label="Add quick task">↑</button></div>
              <div className="quick-meta"><button><span className="space-dot purple" />Today</button><button>＋ Details</button></div>
            </section>

            <section className="rail-card inbox-card">
              <div className="rail-title"><div><span className="section-kicker">Needs a look</span><h2>Inbox</h2></div><button>View all</button></div>
              <article className="inbox-item"><span className="source-icon gmail">M</span><div><strong>Maya replied to “Project scope”</strong><small>Gmail · 18 min ago</small></div><span className="unread" /></article>
              <article className="inbox-item"><span className="source-icon github">⌘</span><div><strong>You were requested on #184</strong><small>GitHub · 43 min ago</small></div><span className="unread" /></article>
              <article className="inbox-item"><span className="source-icon calendar">□</span><div><strong>Design review moved to 3:30</strong><small>Calendar · 1 hr ago</small></div></article>
            </section>

            <section className="rail-card projects-card">
              <div className="rail-title"><div><span className="section-kicker">In motion</span><h2>Projects</h2></div><button>View all</button></div>
              <article className="project-row"><div className="project-symbol purple">L</div><div><strong>Website launch</strong><span className="mini-progress"><i style={{ width: "72%" }} /></span></div><b>72%</b></article>
              <article className="project-row"><div className="project-symbol coral">C</div><div><strong>Client onboarding</strong><span className="mini-progress"><i style={{ width: "48%" }} /></span></div><b>48%</b></article>
              <article className="project-row"><div className="project-symbol green">Q</div><div><strong>Q4 planning</strong><span className="mini-progress"><i style={{ width: "31%" }} /></span></div><b>31%</b></article>
            </section>
          </aside>
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {["Today", "Calendar", "Tasks", "People", "Notes", "Integrations"].map((item) => <button key={item} className={nav === item ? "active" : ""} onClick={() => setNav(item)}><span>{item === "Today" ? "☀" : item === "Calendar" ? "□" : item === "Tasks" ? "✓" : item === "People" ? "♧" : item === "Notes" ? "▤" : "⇄"}</span>{item === "Integrations" ? "Connect" : item}</button>)}
        </nav>
      </section>
    </main>
  );
}

function ModuleView({
  name,
  tasks,
  toggleTask,
  connections,
  toggleConnection,
  emailAccounts,
  emailProvider,
  emailAddress,
  setEmailProvider,
  setEmailAddress,
  addEmailAccount,
  removeEmailAccount,
  searchQuery,
  sources,
  onSetup,
}: {
  name: string;
  tasks: Task[];
  toggleTask: (id: number) => void;
  connections: Record<string, boolean>;
  toggleConnection: (name: string) => void;
  emailAccounts: EmailAccount[];
  emailProvider: string;
  emailAddress: string;
  setEmailProvider: (provider: string) => void;
  setEmailAddress: (address: string) => void;
  addEmailAccount: (event: React.FormEvent<HTMLFormElement>) => void;
  removeEmailAccount: (id: number) => void;
  searchQuery: string;
  sources: ReturnType<typeof useConnectedWorkspace>;
  onSetup: () => void;
}) {
  const descriptions: Record<string, string> = {
    Inbox: "Everything that needs a decision, gathered from your connected tools.",
    Calendar: "One schedule across work and personal calendars.",
    Tasks: "Plan, prioritize, and complete work from one reliable list.",
    Projects: "See momentum, ownership, and the next milestone at a glance.",
    Notes: "Explore the sample Notes search experience.",
    Integrations: "Choose the accounts and information you want in Relay.",
  };

  return (
    <section className="module-page">
      <header className="module-header">
        <p className="eyebrow">Workspace</p>
        <h1>{name}</h1>
        <p>{descriptions[name]}</p>
      </header>

      {name === "Integrations" && (
        <div className="integration-layout">
          <SourceConnections sources={sources} />
          <section className="module-card integration-intro">
            <span className="section-kicker">Integration roadmap</span>
            <h2>Your tools stay the source of truth.</h2>
            <p>Google Calendar and Contacts use account authorization above. The email, GitHub, Slack, Linear, Notion, and Notes controls below are demo flows; they do not connect to your accounts yet.</p>
            <div className="sync-flow"><span>Email</span><i>⇄</i><span>Relay</span><i>⇄</i><span>Calendar</span><i>⇄</i><span>GitHub</span><i>⇄</i><span>Notes</span></div>
          </section>

          <section className="module-card email-connector">
            <div className="email-connector-heading"><div><span className="section-kicker">Email accounts · Demo</span><h2>Add as many accounts as you need</h2></div><span>{emailAccounts.length} demo accounts</span></div>
            <form className="email-form" onSubmit={addEmailAccount}>
              <label><span>Provider</span><select value={emailProvider} onChange={(event) => setEmailProvider(event.target.value)}>{emailProviders.map(([provider]) => <option key={provider}>{provider}</option>)}</select></label>
              <label><span>Email address</span><input id="email-address" type="email" required value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="you@example.com" /></label>
              <button type="submit" disabled={emailAccounts.some((account) => account.address === emailAddress.trim().toLowerCase())}>Add account</button>
            </form>
            {emailAccounts.length > 0 && <div className="email-account-list">{emailAccounts.map((account) => <article key={account.id}><span className="connection-logo">{account.provider[0]}</span><div><strong>{account.address}</strong><small>{account.provider} · Demo account, not authorized</small></div><button onClick={() => removeEmailAccount(account.id)} aria-label={`Remove ${account.address}`}>Remove</button></article>)}</div>}
          </section>

          <div className="connections-grid">
            {emailProviders.map(([service, mark, type, copy]) => (
              <article className="module-card connection-card" key={service}>
                <div className={`connection-logo ${service.toLowerCase().replace(" ", "-")}`}>{mark}</div>
                <div className="connection-copy"><small>{type}</small><h2>{service}</h2><p>{copy}</p></div>
                <button className="connect-button" onClick={() => { setEmailProvider(service); document.getElementById("email-address")?.focus(); }}>{emailAccounts.some((account) => account.provider === service) ? "Add another" : "Add account"}</button>
              </article>
            ))}
          </div>

          <div className="connections-grid">
            {[["GitHub", "⌘", "Repositories · Demo", "Track issues, pull requests, and mentions."]].map(([service, mark, type, copy]) => <article className="module-card connection-card" key={service}><div className={`connection-logo ${service.toLowerCase()}`}>{mark}</div><div className="connection-copy"><small>{type}</small><h2>{service}</h2><p>{copy}</p></div><button className="connect-button" onClick={() => toggleConnection(service)}>{connections[service] ? "Demo enabled" : "Try demo"}</button></article>)}
          </div>
          <div className="connections-grid">
            {[["Slack", "S", "Team messages", "Track mentions, saved messages, and follow-ups."], ["Linear", "L", "Product work", "Sync issues, cycles, projects, and due dates."], ["Notion", "N", "Docs & databases", "Bring action items, decisions, and project pages into Relay."], ["Apple Notes", "▤", "Planned bridge", "Explore sample notes. Device access is not available yet."]].map(([service, mark, type, copy]) => <article className="module-card connection-card" key={service}><div className={`connection-logo ${service.toLowerCase().replace(" ", "-")}`}>{mark}</div><div className="connection-copy"><small>{type} · Demo</small><h2>{service}</h2><p>{copy}</p></div><button className="connect-button" onClick={() => toggleConnection(service)}>{connections[service] ? "Demo enabled" : "Try demo"}</button></article>)}
          </div>
          <div className="permission-note"><span>◎</span><div><strong>You stay in control</strong><p>Connections use the minimum permissions needed. You can pause syncing or disconnect a service at any time.</p></div></div>
        </div>
      )}

      {name === "Tasks" && (
        <section className="module-card full-list">
          <div className="list-toolbar"><div><button className="filter-active">All</button><button>Today</button><button>Upcoming</button></div><span>{tasks.filter((task) => !task.done).length} open</span></div>
          {tasks.map((task) => (
            <article className={task.done ? "task-row is-done" : "task-row"} key={task.id}>
              <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}>{task.done ? "✓" : ""}</button>
              <div className="task-copy"><h3>{task.title}</h3><p>{task.meta}</p></div>
              <span className={`source-badge ${task.source.toLowerCase()}`}><b>{iconFor[task.source]}</b>{task.source}</span>
            </article>
          ))}
        </section>
      )}

      {name === "Inbox" && (
        <div className="module-columns">
          <section className="module-card large-inbox">
            {["Maya replied to “Project scope”", "Review requested on relay-web #184", "Design review moved to 3:30", "Invoice reminder from Figma", "Sam mentioned you in launch-notes"].map((item, index) => (
              <article className="large-inbox-row" key={item}><span className={`source-icon ${index % 2 ? "github" : "gmail"}`}>{index % 2 ? "⌘" : "M"}</span><div><strong>{item}</strong><small>{index % 2 ? "GitHub" : "Gmail"} · {18 + index * 12} min ago</small></div><button>Turn into task</button></article>
            ))}
          </section>
          <aside className="module-card calm-zero"><span>7</span><h2>items need you</h2><p>Clear these and Relay will mute the noise until something new needs a decision.</p></aside>
        </div>
      )}

      {name === "Calendar" && <ConnectedCalendar sources={sources} onSetup={onSetup} />}
      {name === "Notes" && <NotesView query={searchQuery} connected={Boolean(connections["Apple Notes"])} connect={() => toggleConnection("Apple Notes")} />}

      {name === "Projects" && (
        <div className="project-grid">
          {[["Website launch", "Ship the new marketing experience", "72", "purple"], ["Client onboarding", "A smoother first 30 days", "48", "coral"], ["Q4 planning", "Set priorities for the next quarter", "31", "green"]].map(([title, copy, progress, color]) => (
            <article className="module-card project-tile" key={title}><div className={`project-symbol ${color}`}>{title[0]}</div><span className="section-kicker">Active project</span><h2>{title}</h2><p>{copy}</p><div className="project-progress"><span style={{ width: `${progress}%` }} /></div><footer><strong>{progress}% complete</strong><span>Next milestone →</span></footer></article>
          ))}
          <button className="new-project">＋<span>New project</span></button>
        </div>
      )}
    </section>
  );
}

function NotesView({ query, connected, connect }: { query: string; connected: boolean; connect: () => void }) {
  const [selected, setSelected] = useState(notes[0].id);
  const matches = notes.filter((note) => `${note.title} ${note.folder} ${note.body}`.toLowerCase().includes(query.trim().toLowerCase()));
  const active = matches.find((note) => note.id === selected) ?? matches[0];

  if (!connected) return <section className="module-card notes-setup"><span className="notes-app-icon">▤</span><div><span className="section-kicker">Relay for iPhone · Planned</span><h2>Explore Apple Notes search</h2><p>These are sample notes. A Notes Shortcut bridge has not been built. The Calendar and Contacts companion does not access Apple Notes.</p></div><button className="connect-button" onClick={connect}>View sample notes</button></section>;

  return <div className="notes-browser">
    <aside className="module-card notes-list">
      <div className="notes-list-heading"><span>{matches.length} sample notes</span><strong>Demo data</strong></div>
      {matches.length ? matches.map((note) => <button key={note.id} className={active?.id === note.id ? "note-result active" : "note-result"} onClick={() => setSelected(note.id)}><span><strong>{note.title}</strong><small>{note.preview}</small></span><time>{note.updated}</time></button>) : <div className="notes-empty"><strong>No notes found</strong><span>Try another word or phrase.</span></div>}
    </aside>
    <article className="module-card note-preview">
      {active ? <><header><div><span>{active.folder}</span><time>{active.updated}</time></div><span>Sample note</span></header><pre>{active.body}</pre><footer>Demo only · Apple Notes access is not connected</footer></> : <div className="notes-empty"><strong>Nothing to preview</strong></div>}
    </article>
  </div>;
}
