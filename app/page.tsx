"use client";

import { useMemo, useState } from "react";

type Task = {
  id: number;
  title: string;
  meta: string;
  source: "GitHub" | "Gmail" | "Personal" | "Calendar";
  done: boolean;
  priority?: boolean;
};

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
  const [connections, setConnections] = useState<Record<string, boolean>>({ Gmail: false, Outlook: false, Calendar: false, GitHub: false });
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
          {["Today", "Inbox", "Calendar", "Tasks", "Projects", "Integrations"].map((item) => (
            <button key={item} className={nav === item ? "nav-item active" : "nav-item"} onClick={() => setNav(item)}>
              <span className="nav-icon" aria-hidden="true">{item === "Today" ? "☀" : item === "Inbox" ? "↙" : item === "Calendar" ? "□" : item === "Tasks" ? "✓" : item === "Projects" ? "◇" : "⇄"}</span>
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
          <button className="sync-status"><span className="live-dot" />All systems synced</button>
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
          <div className="search"><span>⌕</span><input aria-label="Search" placeholder="Search everything…" /><kbd>⌘ K</kbd></div>
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

        {nav !== "Today" && (
          <ModuleView
            name={nav}
            tasks={tasks}
            toggleTask={toggleTask}
            connections={connections}
            toggleConnection={(name) => setConnections((current) => ({ ...current, [name]: !current[name] }))}
          />
        )}

        <div className={nav === "Today" ? `content-grid${compact ? " compact" : ""}` : "content-grid is-hidden"}>
          <section className="primary-column">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">Tuesday, September 8</p>
                <h1>Good morning, Rold.</h1>
                <p className="lede">Here’s what needs your attention today.</p>
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
          {["Today", "Inbox", "Calendar", "Tasks", "Integrations"].map((item) => <button key={item} className={nav === item ? "active" : ""} onClick={() => setNav(item)}><span>{item === "Today" ? "☀" : item === "Inbox" ? "↙" : item === "Calendar" ? "□" : item === "Tasks" ? "✓" : "⇄"}</span>{item === "Integrations" ? "Connect" : item}</button>)}
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
}: {
  name: string;
  tasks: Task[];
  toggleTask: (id: number) => void;
  connections: Record<string, boolean>;
  toggleConnection: (name: string) => void;
}) {
  const descriptions: Record<string, string> = {
    Inbox: "Everything that needs a decision, gathered from your connected tools.",
    Calendar: "One schedule across work and personal calendars.",
    Tasks: "Plan, prioritize, and complete work from one reliable list.",
    Projects: "See momentum, ownership, and the next milestone at a glance.",
    Integrations: "Connect your tools once. Relay keeps changes moving both ways.",
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
          <section className="module-card integration-intro">
            <span className="section-kicker">Two-way sync</span>
            <h2>Your tools stay the source of truth.</h2>
            <p>Edit a due date, complete an issue, or move a meeting in Relay and the change is sent back to the connected service. Every sync is logged so you can see what changed.</p>
            <div className="sync-flow"><span>Email</span><i>⇄</i><span>Relay</span><i>⇄</i><span>Calendar</span><i>⇄</i><span>GitHub</span></div>
          </section>
          <div className="connections-grid">
            {[
              ["Gmail", "M", "Email", "Turn messages into tasks and sync labels."],
              ["Outlook", "O", "Email + calendar", "Sync Microsoft mail and events."],
              ["Calendar", "31", "Google Calendar", "Create, move, and focus-block events."],
              ["GitHub", "⌘", "Repositories", "Track issues, pull requests, and mentions."],
            ].map(([service, mark, type, copy]) => (
              <article className="module-card connection-card" key={service}>
                <div className={`connection-logo ${service.toLowerCase()}`}>{mark}</div>
                <div className="connection-copy"><small>{type}</small><h2>{service}</h2><p>{copy}</p></div>
                <button className={connections[service] ? "connected-button" : "connect-button"} onClick={() => toggleConnection(service)}>{connections[service] ? "✓ Connected" : "Connect"}</button>
              </article>
            ))}
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

      {name === "Calendar" && (
        <section className="module-card week-card">
          <div className="week-days">{["Mon 7", "Tue 8", "Wed 9", "Thu 10", "Fri 11"].map((day) => <strong className={day.includes("Tue") ? "selected" : ""} key={day}>{day}</strong>)}</div>
          <div className="week-grid">
            <div className="week-times"><span>9 AM</span><span>11 AM</span><span>1 PM</span><span>3 PM</span><span>5 PM</span></div>
            <div className="week-events"><article className="week-event one">Product sync<small>9:30 · Studio</small></article><article className="week-event two">Q4 deep work<small>11:00 · Focus</small></article><article className="week-event three">Design review<small>3:30 · Client</small></article></div>
          </div>
        </section>
      )}

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
