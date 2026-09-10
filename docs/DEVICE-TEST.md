# Physical-device test pass

Everything so far has been simulator plus an accepted archive. These are the
paths that genuinely behave differently on real hardware, so this is the list
worth actually walking before inviting anyone to TestFlight.

Install build 2 from TestFlight on your own iPhone first.

## Why the simulator does not settle these

| Area | Simulator | Real device |
|---|---|---|
| Contacts | a handful of seeded sample contacts | thousands, groups, no-name and duplicate records, iCloud vs On My iPhone |
| Contacts access | rarely exercised | iOS 18 offers **limited** selection as well as full access |
| Calendar | usually one empty local calendar | iCloud/Google/Exchange accounts, shared and read-only calendars, delegated ones |
| Calendar writes | write to nothing | actually sync to a provider, and can fail offline |
| Files export | tidy simulated container | iCloud Drive, On My iPhone, third-party providers, sharing |

## Checklist

### Permissions — the highest-risk area
- [ ] First launch shows the intro; contacts are **not** requested until Get started
- [ ] Choose contacts → pick a few → they appear, and nothing else does
- [ ] **Deny** contacts access, then reopen the picker: the app explains rather than hangs
- [ ] Grant calendar **Full Access**; confirm calendars list
- [ ] Choose **Add Only** or deny instead: the app says so clearly and does not silently show nothing
- [ ] Revoke both in iOS Settings while the app is backgrounded, return: state refreshes without a crash
- [ ] Re-grant: data comes back

### Calendar behaviour
- [ ] Only calendars you tick are read; unticking removes those events
- [ ] Read-only / subscribed calendars are not offered as writable
- [ ] Create an event, confirm it appears in Apple Calendar and syncs to its provider
- [ ] Edit an event; confirm the change lands
- [ ] Airplane mode: a write fails with a clear message, no data loss
- [ ] All-day and recurring events are handled or refused deliberately, never silently mangled

### Export and the round trip
- [ ] Export with a realistic selection (say 100+ contacts and a busy month)
- [ ] Save to Files, then to iCloud Drive
- [ ] Import that file at <https://auxilo.app> → Integrations → Import iPhone export
- [ ] Names with accents, emoji, and very long fields survive intact
- [ ] A contact with no email, and one with no phone, both import
- [ ] Re-export and re-import replaces the previous snapshot rather than duplicating

### Fit and finish
- [ ] Dynamic Island / notch: nothing clipped
- [ ] Dark mode
- [ ] Largest Dynamic Type size: intro text and form remain readable
- [ ] VoiceOver can reach Get started, Choose contacts and Export
- [ ] iPad, since `TARGETED_DEVICE_FAMILY` still includes it — if it looks poor there, drop iPad rather than ship it

## Record results

Note anything that fails here or as a GitHub issue. Anything touching
permissions or data loss should block external testing; cosmetic issues need
not.
