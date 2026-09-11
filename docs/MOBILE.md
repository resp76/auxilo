# Auxilo for iPhone

A Capacitor shell around the same dashboard the web serves. The web assets are
**bundled into the app**, not loaded from a URL — `capacitor.config.json` sets
`webDir` and deliberately has no `server.url`. That is the difference between
an app and a bookmark, and it is what keeps this clear of App Store guideline
4.2; the native capabilities below are the rest of the argument.

## Why native at all

Two things the web build cannot do:

- **Reminders fire with the app closed.** The web version can only alert while
  a tab is open, because its reminder loop is a `setInterval`.
- **Contacts and calendar are read directly.** No export-a-file-then-import-it
  round trip.

## Layout

| Path | What it is |
|---|---|
| `mobile/` | Small static Vite entry that mounts the existing dashboard |
| `ios-app/` | Generated native project (kept out of `ios/`, which holds the older standalone companion) |
| `ios-app/App/App/AuxiloNativePlugin.swift` | Our own Contacts/Calendar plugin |
| `app/api-base.ts` | Points `/api/*` at the deployed worker when running natively |
| `app/mobile-notifications.ts` | Mirrors pending reminders into iOS notifications |
| `app/durable-storage.ts` | Backs task JSON up outside web storage |
| `app/native-device.ts` | Bridge to the Contacts/Calendar plugin |

Nothing in the dashboard was forked. The component tree has no framework
imports, so `mobile/main.tsx` mounts the very same code the worker renders.

## Build and run

```sh
pnpm install                 # required: the native project's SPM packages
                             # resolve into node_modules by absolute path
pnpm mobile:build            # static bundle -> mobile/dist
pnpm exec cap sync ios       # copies assets AND generates config into ios-app
pnpm exec cap open ios       # open in Xcode
```

**A fresh clone cannot build the iOS app until those run.** Four inputs are
generated and none are committed: `node_modules`, `mobile/dist`,
`ios-app/App/App/public/`, and `ios-app/App/App/{config.xml,capacitor.config.json}`
— the last two are excluded by Capacitor's own `ios-app/.gitignore`. Copying
`public/` alone is not enough; Xcode fails with "The file config.xml couldn't
be opened".

Note `pnpm` may not be on PATH — this repo pins it via corepack, so use
`corepack pnpm …` if the bare command is not found.

## Deliberate choices worth knowing

- **Bundle id `com.digitalsandboxlabs.auxilo`** is distinct from the
  companion already on TestFlight (`…auxilo`), so this cannot disturb it. Merge
  them only once this app supersedes the exporter.
- **The Contacts/Calendar plugin is ours**, lifted from `ios/AuxiloCompanion`,
  rather than a community plugin — Contacts and Calendar have no official
  Capacitor plugin, and this keeps a third party out of the supply chain.
- **The plugin emits the companion's export shapes**, so the web layer feeds
  them through the existing `parseIPhoneExport` validation. Data from our own
  plugin gets checked exactly like a file the user picked.
- **`CapacitorHttp` is enabled.** Cross-origin calls from `capacitor://localhost`
  were blocked by CORS; native networking sidesteps it, and it also means the
  Notion and Slack connectors do not need the worker proxy on device.
- **Minimum iOS 17**, because `requestFullAccessToEvents()` requires it. This
  matches the companion.
- **`localStorage` stays authoritative** for tasks; Preferences is a backup
  read only when web storage comes back empty.

## Not yet verified on hardware

Simulator only so far, and the dashboard itself needs a signed-in account to
reach, so these are open:

- a reminder actually firing while the app is closed
- the contact picker and calendar permission prompts, including denial and
  later revocation in iOS Settings
- reading a realistic address book and a provider-backed calendar

See [device test pass](DEVICE-TEST.md); the permission sections apply here too.

Also outstanding: keyboard avoidance is untuned, the webview still rubber-band
scrolls, and there is no offline or signed-out state — if `auxilo.app` cannot be
reached, sign-in simply fails.
