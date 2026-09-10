"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ConnectedCalendar, PeopleWorkspace, SourceConnections, useConnectedWorkspace } from "./connected-workspace";
import type { Person } from "./people-calendar";
import { AuthGate, useAuxiloAuth } from "./auth-gate";

import { dueReminders, filterTasks, parseTasks, reminderInstant, snoozeInstant, tomorrowAt, type Task } from "./task-reminders";
import { filterCommands, nextIndex, type Command } from "./commands";
import { readGitHubTasks } from "./github";
import { readLinearTasks, readNotionTasks, readSlackTasks } from "./connectors";

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
  Linear: "L",
  Notion: "N",
  Slack: "S",
};

function formatReminder(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function Home() {
  return <AuthGate><AuxiloDashboard /></AuthGate>;
}

function AuxiloDashboard() {
  const { user, signOut } = useAuxiloAuth();
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "there";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
  // Key deliberately keeps the old "relay." prefix through the Auxilo rename:
  // changing it would orphan every task already saved in someone's browser.
  const taskStorageKey = `relay.tasks.${user?.id || user?.email || "demo"}`;
  const [savedTasks] = useState(() => {
    if (typeof window === "undefined") return { tasks: initialTasks, error: "" };
    try {
      const raw = window.localStorage.getItem(taskStorageKey);
      return { tasks: raw ? parseTasks(raw) : initialTasks, error: "" };
    } catch {
      return { tasks: initialTasks, error: "Saved tasks could not be read. Your original data has been preserved. Changes in this tab will not be saved; restore browser storage and reload." };
    }
  });
  const [tasks, setTasks] = useState<Task[]>(savedTasks.tasks);
  const [clock, setClock] = useState(() => Date.now());
  const [storageError, setStorageError] = useState(savedTasks.error);
  const reminderDialog = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskReminder, setNewTaskReminder] = useState("");
  const [quickDetails, setQuickDetails] = useState(false);
  const [reminderTaskId, setReminderTaskId] = useState<number | null>(null);
  const [reminderValue, setReminderValue] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const alertedReminders = useRef(new Set<string>());
  const [nav, setNav] = useState("Today");
  const [customizing, setCustomizing] = useState(false);
  const [compact, setCompact] = useState(false);
  const [connections, setConnections] = useState<Record<string, boolean>>({ Calendar: false, GitHub: false });
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailProvider, setEmailProvider] = useState("Gmail");
  const [emailAddress, setEmailAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteDialog = useRef<HTMLDialogElement>(null);
  const paletteInput = useRef<HTMLInputElement>(null);
  const sources = useConnectedWorkspace();

  useEffect(() => {
    if (savedTasks.error) return;
    try { window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks)); }
    catch { queueMicrotask(() => setStorageError("Tasks could not be saved on this device. Keep this tab open and check browser storage.")); }
  }, [savedTasks.error, taskStorageKey, tasks]);

  useEffect(() => {
    // ponytail: tab timers only; server push is needed for delivery with Auxilo closed.
    function showDueReminder() {
      const now = Date.now();
      setClock(now);
      const due = dueReminders(tasks, alertedReminders.current, now);
      if (!due.length) return;
      setReminderNotice(`Reminder: ${due.map(task => task.title).join("; ")}`);
      for (const task of due) {
        alertedReminders.current.add(`${task.id}:${task.reminderAt}`);
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Auxilo reminder", { body: task.title });
          }
        } catch { /* In-app alerts still work when desktop notifications are unavailable. */ }
      }
    }
    const initial = window.setTimeout(showDueReminder, 0);
    const timer = window.setInterval(showDueReminder, 1000);
    window.addEventListener("focus", showDueReminder);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", showDueReminder); };
  }, [tasks]);

  useEffect(() => {
    if (reminderTaskId !== null) reminderDialog.current?.showModal();
    else reminderDialog.current?.close();
  }, [reminderTaskId]);

  useEffect(() => {
    if (paletteOpen) { paletteDialog.current?.showModal(); paletteInput.current?.focus(); }
    else paletteDialog.current?.close();
  }, [paletteOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteQuery("");
        setPaletteIndex(0);
        setPaletteOpen(open => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function requestNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => setReminderNotice("Reminder saved. Desktop notifications are unavailable; keep Auxilo open for in-app alerts."));
    }
  }

  function followUp(person: Person) {
    setTasks(current => [...current, { id: Date.now(), title: `Follow up with ${person.name}`, meta: `${person.email || person.organization || person.account} · Local task${person.source === "Demo" ? " · Sample contact" : ""}`, source: "Personal", done: false, priority: true }]);
  }
  function mergeSourceTasks(source: Task["source"], incoming: Task[]) {
    setTasks(current => [...current.filter(task => task.source !== source), ...incoming]);
  }
  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);
  const reminderTasks = useMemo(() => tasks.filter((task) => !task.done && task.reminderAt), [tasks]);
  const reminderTask = tasks.find((task) => task.id === reminderTaskId);

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) return;
    let reminderAt: string | undefined;
    try { reminderAt = newTaskReminder ? reminderInstant(newTaskReminder, Date.now()) : undefined; }
    catch { setReminderNotice("Choose a future time for your reminder."); return; }
    setTasks((current) => [...current, { id: Date.now(), title, meta: "Personal · Added just now", source: "Personal", done: false, priority: true, reminderAt }]);
    if (newTaskReminder) {
      setReminderNotice(`Reminder set for ${title}.`);
      requestNotifications();
    }
    setNewTask("");
    setNewTaskReminder("");
    setQuickDetails(false);
  }

  function openReminder(task: Task) {
    setReminderTaskId(task.id);
    setReminderValue(localDateTimeValue(new Date(task.reminderAt || Date.now() + 60 * 60_000)));
  }

  function saveReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reminderTask) return;
    let reminderAt: string;
    try { reminderAt = reminderInstant(reminderValue, Date.now()); }
    catch { setReminderNotice("Choose a future time for your reminder."); return; }
    setTasks((current) => current.map((task) => task.id === reminderTask.id ? { ...task, reminderAt } : task));
    setReminderNotice(`Reminder set for ${reminderTask.title}.`);
    setReminderTaskId(null);
    requestNotifications();
  }

  function removeReminder() {
    if (!reminderTask) return;
    setTasks((current) => current.map((task) => task.id === reminderTask.id ? { ...task, reminderAt: undefined } : task));
    setReminderNotice(`Reminder removed from ${reminderTask.title}.`);
    setReminderTaskId(null);
  }

  function snoozeTask(task: Task, minutes: number | "tomorrow") {
    // `clock` ticks every second, so it stands in for now without an impure read.
    const reminderAt = minutes === "tomorrow" ? tomorrowAt(clock) : snoozeInstant(minutes, clock);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, reminderAt } : item));
    setReminderNotice(`Snoozed ${task.title} until ${formatReminder(reminderAt)}.`);
    setReminderTaskId(null);
  }

  const commands: Command[] = [
    ...["Today", "Inbox", "Calendar", "Tasks", "Projects", "People", "Notes", "Integrations"].map((item) => ({
      id: `nav-${item}`, label: `Go to ${item}`, group: "Navigate", run: () => { setNav(item); setMenuOpen(false); },
    })),
    { id: "add", label: "Add a task", group: "Actions", hint: "focuses quick add", run: () => { setNav("Today"); setTimeout(() => document.getElementById("quick-add")?.focus(), 0); } },
    { id: "compact", label: compact ? "Turn off compact task rows" : "Turn on compact task rows", group: "Actions", run: () => setCompact((value) => !value) },
    { id: "customize", label: "Customize dashboard", group: "Actions", run: () => setCustomizing(true) },
    ...reminderTasks.flatMap((task) => [
      { id: `snooze-hour-${task.id}`, label: `Snooze “${task.title}” for 1 hour`, group: "Snooze", run: () => snoozeTask(task, 60) },
      { id: `snooze-tomorrow-${task.id}`, label: `Snooze “${task.title}” until tomorrow 9am`, group: "Snooze", run: () => snoozeTask(task, "tomorrow") },
    ]),
    { id: "signout", label: "Sign out", group: "Account", run: () => void signOut() },
  ];
  const paletteResults = filterCommands(commands, paletteQuery);

  function runCommand(command: Command) {
    setPaletteOpen(false);
    command.run();
  }

  return (
    <main className="app-shell">
      <aside className={menuOpen ? "sidebar mobile-open" : "sidebar"}>
        <div className="brand" aria-label="Auxilo home">
          <span className="brand-mark" />
          <span>Auxilo</span>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {["Today", "Inbox", "Calendar", "Tasks", "Projects", "People", "Notes", "Integrations"].map((item) => (
            <button key={item} className={nav === item ? "nav-item active" : "nav-item"} onClick={() => { setNav(item); setMenuOpen(false); }}>
              <span className="nav-icon" aria-hidden="true">{item === "Today" ? "☀" : item === "Inbox" ? "↙" : item === "Calendar" ? "□" : item === "Tasks" ? "✓" : item === "Projects" ? "◇" : item === "Notes" ? "▤" : "⇄"}</span>
              {item}
              {item === "Inbox" && <span className="nav-count">7</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-label">Spaces</div>
        <nav className="spaces" aria-label="Spaces">
          <button disabled title="Spaces are a preview"><span className="space-dot purple" />Studio</button>
          <button disabled title="Spaces are a preview"><span className="space-dot coral" />Client work</button>
          <button disabled title="Spaces are a preview"><span className="space-dot green" />Personal</button>
        </nav>

        <div className="sidebar-footer">
          <button className="sync-status" onClick={() => setNav("Integrations")}><span className="live-dot" />{sources.sessions.length ? `${sources.sessions.length} Google account(s)` : "Demo workspace · View sources"}</button>
          <div className="profile">
            <div className="avatar">{initials}</div>
            <div><strong>{displayName}</strong><span>{user?.email}</span></div>
            <button aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>↗</button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span className="brand-mark small" /></button>
          <div className="search"><span>⌕</span><input aria-label="Search notes or people" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={nav === "People" ? "Search people…" : nav === "Notes" ? "Search iPhone Notes…" : "Search people…"} onKeyDown={e => { if (e.key === "Enter" && nav !== "Notes") setNav("People"); }} /></div>
          <div className="top-actions">
            <button className={customizing ? "customize-button active" : "customize-button"} onClick={() => setCustomizing((value) => !value)}>Customize</button>
            <button className="icon-button" aria-label={`${reminderTasks.length} active reminders`} title="View task reminders" onClick={() => setNav("Tasks")}>♢{reminderTasks.length > 0 && <span className="notice-count">{reminderTasks.length}</span>}</button>
            <button className="add-button" onClick={() => { setNav("Today"); setMenuOpen(false); setTimeout(() => document.getElementById("quick-add")?.focus(), 0); }}><span>＋</span> Add task</button>
          </div>
        </header>

        {storageError && <p className="source-feedback" role="alert">{storageError}</p>}
        {reminderNotice && <div className="reminder-toast" role="status"><span>◷</span><strong>{reminderNotice}</strong><button onClick={() => setReminderNotice("")} aria-label="Dismiss reminder">×</button></div>}

        {customizing && (
          <section className="customize-strip" aria-label="Dashboard customization">
            <div><strong>Make Auxilo yours</strong><span>Choose how much you see at a glance.</span></div>
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
            openReminder={openReminder}
            clock={clock}
            addFromInbox={(title) => { setTasks(current => [...current, { id: Date.now(), title, meta: "Personal · From sample inbox", source: "Personal", done: false, priority: true }]); setNav("Tasks"); }}
            onSourceTasks={mergeSourceTasks}
          />
        )}

        <div className={nav === "Today" ? `content-grid${compact ? " compact" : ""}` : "content-grid is-hidden"}>
          <section className="primary-column">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">{new Date(clock).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
                <h1>Good {new Date(clock).getHours() < 12 ? "morning" : new Date(clock).getHours() < 18 ? "afternoon" : "evening"}, {displayName}.</h1>
                <p className="lede">Tasks and reminders are saved on this device. Schedule, inbox, and projects below are samples.</p>
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
                    <div className="task-copy"><h3>{task.title}</h3><p>{task.meta}{task.reminderAt && <span className={Date.parse(task.reminderAt) <= clock && !task.done ? "reminder-time due" : "reminder-time"}> · ◷ {formatReminder(task.reminderAt)}</span>}</p></div>
                    <span className={`source-badge ${task.source.toLowerCase()}`}><b>{iconFor[task.source]}</b>{task.source}</span>
                    <button className={task.reminderAt ? "reminder-button active" : "reminder-button"} onClick={() => openReminder(task)} aria-label={`${task.reminderAt ? "Edit" : "Set"} reminder for ${task.title}`} title={task.reminderAt ? "Edit reminder" : "Set reminder"}>◷</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="agenda-section">
              <div className="section-heading"><div><span className="section-kicker">Up next</span><h2>Your schedule</h2></div><button onClick={() => setNav("Calendar")}>Open calendar <span>→</span></button></div>
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
              <div className="rail-title"><h2>Quick add</h2><button type="button" className="palette-trigger" title="Open the command palette" onClick={() => { setPaletteQuery(""); setPaletteIndex(0); setPaletteOpen(true); }}>⌘K</button></div>
              <div className="quick-input"><input id="quick-add" value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="What needs doing?" /><button onClick={addTask} aria-label="Add quick task">↑</button></div>
              <div className="quick-meta"><span><span className="space-dot purple" />Personal task</span><button aria-expanded={quickDetails} onClick={() => setQuickDetails((value) => !value)}>＋ Details</button></div>
              {quickDetails && <label className="quick-reminder"><span>Remind me</span><input type="datetime-local" min={localDateTimeValue(new Date(clock))} value={newTaskReminder} onChange={(event) => setNewTaskReminder(event.target.value)} /></label>}
            </section>

            <section className="rail-card inbox-card">
              <div className="rail-title"><div><span className="section-kicker">Needs a look</span><h2>Inbox</h2></div><button onClick={() => setNav("Inbox")}>View all</button></div>
              <article className="inbox-item"><span className="source-icon gmail">M</span><div><strong>Maya replied to “Project scope”</strong><small>Gmail · 18 min ago</small></div><span className="unread" /></article>
              <article className="inbox-item"><span className="source-icon github">⌘</span><div><strong>You were requested on #184</strong><small>GitHub · 43 min ago</small></div><span className="unread" /></article>
              <article className="inbox-item"><span className="source-icon calendar">□</span><div><strong>Design review moved to 3:30</strong><small>Calendar · 1 hr ago</small></div></article>
            </section>

            <section className="rail-card projects-card">
              <div className="rail-title"><div><span className="section-kicker">In motion</span><h2>Projects</h2></div><button onClick={() => setNav("Projects")}>View all</button></div>
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

      <dialog ref={reminderDialog} className="reminder-dialog" aria-labelledby="reminder-title" onCancel={() => setReminderTaskId(null)} onClose={() => setReminderTaskId(null)}>
        {reminderTask && <form onSubmit={saveReminder}>
          <button className="reminder-close" type="button" onClick={() => setReminderTaskId(null)} aria-label="Close reminder">×</button>
          <span className="reminder-mark">◷</span>
          <p className="section-kicker">Task reminder</p>
          <h2 id="reminder-title">{reminderTask.title}</h2>
          <label htmlFor="reminder-at">Remind me at</label>
          <input id="reminder-at" type="datetime-local" required min={localDateTimeValue(new Date(clock))} value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} />
          <div className="snooze-row">
            <span>Snooze</span>
            <button type="button" onClick={() => snoozeTask(reminderTask, 10)}>10 min</button>
            <button type="button" onClick={() => snoozeTask(reminderTask, 60)}>1 hour</button>
            <button type="button" onClick={() => snoozeTask(reminderTask, "tomorrow")}>Tomorrow 9am</button>
          </div>
          <div className="reminder-actions">
            {reminderTask.reminderAt && <button className="remove-reminder" type="button" onClick={removeReminder}>Remove</button>}
            <button className="save-reminder" type="submit">Save reminder</button>
          </div>
          <small>Saved on this device. Keep Auxilo open for reminders; closed tabs cannot send alerts.</small>
          {reminderNotice && <p role="status">{reminderNotice}</p>}
        </form>}
      </dialog>

      <dialog ref={paletteDialog} className="command-palette" aria-label="Command palette" onCancel={() => setPaletteOpen(false)} onClose={() => setPaletteOpen(false)}>
        <div className="palette-input">
          <span aria-hidden="true">⌘</span>
          <input
            ref={paletteInput}
            aria-label="Run a command"
            placeholder="Search commands…"
            value={paletteQuery}
            onChange={(event) => { setPaletteQuery(event.target.value); setPaletteIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setPaletteIndex((index) => nextIndex(index, paletteResults.length, 1)); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setPaletteIndex((index) => nextIndex(index, paletteResults.length, -1)); }
              else if (event.key === "Enter") { event.preventDefault(); const command = paletteResults[paletteIndex]; if (command) runCommand(command); }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="palette-results">
          {paletteResults.length ? paletteResults.map((command, index) => (
            <li key={command.id}>
              <button type="button" className={index === paletteIndex ? "palette-item active" : "palette-item"} onMouseEnter={() => setPaletteIndex(index)} onClick={() => runCommand(command)}>
                <span className="palette-group">{command.group}</span>
                <span className="palette-label">{command.label}</span>
                {command.hint && <span className="palette-hint">{command.hint}</span>}
              </button>
            </li>
          )) : <li className="palette-empty">No matching command.</li>}
        </ul>
      </dialog>
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
  openReminder,
  clock,
  addFromInbox,
  onSourceTasks,
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
  openReminder: (task: Task) => void;
  clock: number;
  addFromInbox: (title: string) => void;
  onSourceTasks: (source: Task["source"], tasks: Task[]) => void;
}) {
  const [taskFilter, setTaskFilter] = useState("All");
  const descriptions: Record<string, string> = {
    Inbox: "Sample inbox · Live email sync is not connected yet. Connected GitHub, Linear, Notion, and Slack items appear under Tasks.",
    Calendar: "One schedule across work and personal calendars.",
    Tasks: "Plan, prioritize, and complete work from one reliable list.",
    Projects: "Sample projects · Project editing is not available yet.",
    Notes: "Explore the sample Notes search experience.",
    Integrations: "Choose the accounts and information you want in Auxilo.",
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
            <p>Google Calendar and Contacts use account authorization above. GitHub, Linear, Notion, and Slack are live: paste a key and your real items load into Tasks. The email and Apple Notes controls below are still demo flows and do not connect to your accounts.</p>
            <div className="sync-flow"><span>Email</span><i>⇄</i><span>Auxilo</span><i>⇄</i><span>Calendar</span><i>⇄</i><span>GitHub</span><i>⇄</i><span>Notes</span></div>
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

          <div className="live-connectors">
            {liveConnectors.map(connector => (
              <ConnectCard key={connector.source} {...connector} onTasks={tasks => onSourceTasks(connector.source, tasks)} />
            ))}
          </div>
          <div className="connections-grid">
            {[["Apple Notes", "▤", "Planned bridge", "Explore sample notes. Device access is not available yet."]].map(([service, mark, type, copy]) => <article className="module-card connection-card" key={service}><div className={`connection-logo ${service.toLowerCase().replace(" ", "-")}`}>{mark}</div><div className="connection-copy"><small>{type} · Demo</small><h2>{service}</h2><p>{copy}</p></div><button className="connect-button" onClick={() => toggleConnection(service)}>{connections[service] ? "Demo enabled" : "Try demo"}</button></article>)}
          </div>
          <div className="permission-note"><span>◎</span><div><strong>You stay in control</strong><p>Connections use the minimum permissions needed. You can pause syncing or disconnect a service at any time.</p></div></div>
        </div>
      )}

      {name === "Tasks" && (
        <section className="module-card full-list">
          <div className="list-toolbar"><div>{["All", "Today", "Upcoming"].map(filter => <button key={filter} className={taskFilter === filter ? "filter-active" : ""} onClick={() => setTaskFilter(filter)}>{filter}</button>)}</div><span>{tasks.filter((task) => !task.done).length} open</span></div>
          {filterTasks(tasks, taskFilter, clock).map((task) => (
            <article className={task.done ? "task-row is-done" : "task-row"} key={task.id}>
              <button className="task-check" onClick={() => toggleTask(task.id)} aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}>{task.done ? "✓" : ""}</button>
              <div className="task-copy"><h3>{task.title}</h3><p>{task.meta}{task.reminderAt && <span className={Date.parse(task.reminderAt) <= clock && !task.done ? "reminder-time due" : "reminder-time"}> · ◷ {formatReminder(task.reminderAt)}</span>}</p></div>
              <span className={`source-badge ${task.source.toLowerCase()}`}><b>{iconFor[task.source]}</b>{task.source}</span>
              <button className={task.reminderAt ? "reminder-button active" : "reminder-button"} onClick={() => openReminder(task)} aria-label={`${task.reminderAt ? "Edit" : "Set"} reminder for ${task.title}`} title={task.reminderAt ? "Edit reminder" : "Set reminder"}>◷</button>
            </article>
          ))}
        </section>
      )}

      {name === "Inbox" && (
        <div className="module-columns">
          <section className="module-card large-inbox">
            {["Maya replied to “Project scope”", "Review requested on auxilo-web #184", "Design review moved to 3:30", "Invoice reminder from Figma", "Sam mentioned you in launch-notes"].map((item, index) => (
              <article className="large-inbox-row" key={item}><span className={`source-icon ${index % 2 ? "github" : "gmail"}`}>{index % 2 ? "⌘" : "M"}</span><div><strong>{item}</strong><small>{index % 2 ? "GitHub" : "Gmail"} · {18 + index * 12} min ago</small></div><button onClick={() => addFromInbox(item)}>Turn into task</button></article>
            ))}
          </section>
          <aside className="module-card calm-zero"><span>7</span><h2>items need you</h2><p>Clear these and Auxilo will mute the noise until something new needs a decision.</p></aside>
        </div>
      )}

      {name === "Calendar" && <ConnectedCalendar sources={sources} onSetup={onSetup} />}
      {name === "Notes" && <NotesView query={searchQuery} connected={Boolean(connections["Apple Notes"])} connect={() => toggleConnection("Apple Notes")} />}

      {name === "Projects" && (
        <div className="project-grid">
          {[["Website launch", "Ship the new marketing experience", "72", "purple"], ["Client onboarding", "A smoother first 30 days", "48", "coral"], ["Q4 planning", "Set priorities for the next quarter", "31", "green"]].map(([title, copy, progress, color]) => (
            <article className="module-card project-tile" key={title}><div className={`project-symbol ${color}`}>{title[0]}</div><span className="section-kicker">Active project</span><h2>{title}</h2><p>{copy}</p><div className="project-progress"><span style={{ width: `${progress}%` }} /></div><footer><strong>{progress}% complete</strong><span>Next milestone →</span></footer></article>
          ))}
          <button className="new-project" disabled title="Project editing is coming later">＋<span>New project</span></button>
        </div>
      )}
    </section>
  );
}

type LiveConnector = {
  source: Task["source"];
  mark: string;
  heading: string;
  keyLabel: string;
  placeholder: string;
  reading: string;
  help: ReactNode;
  link: string;
  read: (key: string) => Promise<Task[]>;
};

const liveConnectors: LiveConnector[] = [
  {
    source: "GitHub", mark: "⌘", heading: "Bring your assigned issues and PRs into Tasks",
    keyLabel: "Fine-grained token", placeholder: "github_pat_…", reading: "Reading the issues and pull requests assigned to you…",
    help: <>Create a fine-grained token with read-only <strong>Issues</strong> access. It is sent only to api.github.com from this tab.</>,
    link: "https://github.com/settings/personal-access-tokens/new", read: readGitHubTasks,
  },
  {
    source: "Linear", mark: "L", heading: "Pull your active Linear issues into Tasks",
    keyLabel: "Personal API key", placeholder: "lin_api_…", reading: "Reading the Linear issues assigned to you…",
    help: <>Create a personal API key in Linear settings. Linear allows browser requests, so this key goes straight to api.linear.app.</>,
    link: "https://linear.app/settings/account/security", read: readLinearTasks,
  },
  {
    source: "Notion", mark: "N", heading: "Bring your recent Notion pages into Tasks",
    keyLabel: "Integration token", placeholder: "ntn_…", reading: "Reading your most recently edited Notion pages…",
    help: <>Create an internal integration and share the pages you want with it. Notion blocks browser calls, so this request is forwarded by Auxilo&apos;s own worker, which stores nothing.</>,
    link: "https://www.notion.so/my-integrations", read: readNotionTasks,
  },
  {
    source: "Slack", mark: "S", heading: "Turn messages sent to you into Tasks",
    keyLabel: "User token", placeholder: "xoxp-…", reading: "Searching for messages sent to you…",
    help: <>Needs a <strong>user</strong> token (xoxp-) with <code>search:read</code>. Slack refuses browser auth headers, so this is forwarded by Auxilo&apos;s own worker, which stores nothing.</>,
    link: "https://api.slack.com/apps", read: readSlackTasks,
  },
];

function ConnectCard({ source, mark, heading, keyLabel, placeholder, reading, help, link, read, onTasks }: LiveConnector & { onTasks: (tasks: Task[]) => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(reading);
    try {
      const loaded = await read(token.trim());
      onTasks(loaded);
      setMessage(`Loaded ${loaded.length} ${source} item${loaded.length === 1 ? "" : "s"} into Tasks. Your key stays in this browser tab only.`);
      setToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not reach ${source}.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`module-card live-connector ${source.toLowerCase()}-connector`}>
      <div className="email-connector-heading"><div><span className="section-kicker">{source} · Live</span><h2>{heading}</h2></div><span className={`connection-logo ${source.toLowerCase()}`}>{mark}</span></div>
      <form className="email-form" onSubmit={connect}>
        <label><span>{keyLabel}</span><input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={placeholder} disabled={busy} /></label>
        <button type="submit" disabled={busy || !token.trim()}>{busy ? "Connecting…" : `Connect ${source}`}</button>
      </form>
      <p className="muted-copy">{help} Keys are never stored or uploaded. <a className="source-link" href={link} target="_blank" rel="noreferrer">Create a key ↗</a></p>
      {message && <p className="source-feedback" role="status">{message}</p>}
    </section>
  );
}

function NotesView({ query, connected, connect }: { query: string; connected: boolean; connect: () => void }) {
  const [selected, setSelected] = useState(notes[0].id);
  const matches = notes.filter((note) => `${note.title} ${note.folder} ${note.body}`.toLowerCase().includes(query.trim().toLowerCase()));
  const active = matches.find((note) => note.id === selected) ?? matches[0];

  if (!connected) return <section className="module-card notes-setup"><span className="notes-app-icon">▤</span><div><span className="section-kicker">Auxilo for iPhone · Planned</span><h2>Explore Apple Notes search</h2><p>These are sample notes. A Notes Shortcut bridge has not been built. The Calendar and Contacts companion does not access Apple Notes.</p></div><button className="connect-button" onClick={connect}>View sample notes</button></section>;

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
