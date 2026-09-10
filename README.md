# Relay — Your day, in sync

Relay is a productivity dashboard for local tasks and reminders, with Google/email sign-in, contacts and calendar tools, and an iPhone companion for selected Contacts and Calendar exports.

## Run locally

Requires Node.js 22.13+ and pnpm.

```sh
pnpm install
cp .env.example .env.local
# Fill in your public Supabase configuration; see docs/AUTH.md.
pnpm dev
```

Open http://localhost:3000. A demo workspace is available without authentication configuration. Never commit `.env.local` or OAuth secrets.

## Keyboard

Press **⌘K** (Ctrl+K) anywhere to open the command palette: jump to any module,
add a task, toggle compact rows, or snooze an active reminder. Matching is
fuzzy, so `gtt` finds "Go to Tasks". ↑/↓ move, Enter runs, Esc closes.

Reminders can be snoozed by 10 minutes, 1 hour, or until tomorrow 9am from the
reminder dialog or the palette.

## Check the web app

```sh
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` builds the production web bundle and runs the regression suite. `pnpm build` builds without running tests.

## iPhone app

Open `ios/RelayCompanion/RelayCompanion.xcodeproj` in Xcode. Select the shared **RelayCompanion** scheme and an iPhone simulator, then Run. See [native build instructions](ios/RelayCompanion/README.md) for signing and device checks.

The native app is a Calendar/Contacts companion. The productivity dashboard runs on the web. See [readiness report](docs/READINESS.md) for verified behavior and remaining release work.

## Data and integrations

- Supabase authenticates users. Setup: [docs/AUTH.md](docs/AUTH.md).
- Tasks and reminder times are stored in this browser per account. Reminders need Relay open; background delivery and cross-device task sync are not implemented.
- Google Calendar/People access uses separate OAuth setup from Google sign-in. Imported iPhone records are read-only and held in the current tab's memory.
- GitHub, Linear, Notion, and Slack are live paste-a-key connectors. See [docs/CONNECTORS.md](docs/CONNECTORS.md).
- Inbox, email accounts, projects, spaces, and Apple Notes are previews. They do not represent live provider sync.
- Hosting uses vinext and Sites configuration in `.openai/hosting.json`. Database schema is currently empty.
