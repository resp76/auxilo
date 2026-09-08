# Relay iPhone Calendar and Contacts companion

Source for an iOS 17+ SwiftUI companion. This is not a signed app or an App Store/TestFlight release. It uses native EventKit and ContactsUI, with no third-party dependencies. It does not access Apple Notes.

## Build on a Mac with Xcode

1. Create a new **iOS App**, interface **SwiftUI**, language **Swift**, minimum iOS **17.0**. Name it RelayCompanion and choose a unique bundle identifier and your signing team.
2. Delete the generated app and ContentView Swift files from that new project. Add `RelayCompanionApp.swift` to the application target.
3. In Target → Info, add `NSCalendarsFullAccessUsageDescription` with: “Relay reads calendars you select and lets you edit events. Only selected calendar snapshots are exported when you choose Export.”
4. Add `NSContactsUsageDescription` with: “Relay uses contacts you select for search and an export you control.” Selection currently uses the system contact picker; it does not enumerate the entire contact store.
5. Build and run on your own iPhone. Review the system permission prompts.

## What works in the source

- Explicit selection of contacts through the iOS picker, local contact search, and clearing that selection.
- Calendar full-access permission request, then per-calendar selection (none selected by default).
- Read selected events for the next 30 days; native event editor for creation and edits. Saving through EventKit updates the calendar provider subject to iOS/account permissions and connectivity.
- Permission rechecks and event refresh on app activation and EventKit changes.
- JSON export to Files of the selected contacts and calendar snapshots, and matching import in the Relay web app.

The web import is read only and held in the current tab's memory. Re-export and re-import to update it. The companion does not receive edits from Relay web and has no background cloud sync, device pairing, or push service. Selection is session-only. The export is a regular unencrypted file containing personal data; save it somewhere appropriate and delete it after import if no longer needed.

## Validation status and device checklist

The authoring environment has Command Line Tools but no iOS SDK or simulator. This source has not been built, signed, or tested on an iPhone. Before distribution:

- Build in Xcode and test picker cancellation, selected contacts, empty selection, and calendar permission denied/revoked.
- Select calendars from more than one account and check that unselected events are excluded.
- Test all-day events, recurring occurrences, timezone changes, read-only calendars, and the native event editor's Save/Cancel paths.
- Export and import on iPhone Safari and desktop; verify event dates and that a new snapshot replaces old iPhone records without affecting Google records.
- Disconnect/remove imports and reload the browser; no imported records should remain.

## Export format (version 1)

`version: 1`, `exportedAt: ISO-8601`, `contacts: []`, `events: []`.

Each contact: `id`, `name`, `email`, `phone`, `organization` (strings).
Each event: `id`, `title`, `start`, `end`, `calendarId`, `calendarName` (strings), `allDay` (boolean). All-day dates use YYYY-MM-DD with an exclusive end date. Timed events use ISO-8601 instants. Maximum 5 MB and 10,000 records in each collection.

References: [EventKit permissions](https://developer.apple.com/documentation/eventkit/accessing-the-event-store), [ContactsUI](https://developer.apple.com/documentation/contactsui).
