# Shipping RelayCompanion to TestFlight

The companion is the **Contacts/Calendar export utility**, not the Relay
dashboard. The dashboard stays on the web. Distributing this to TestFlight puts
the exporter on your phone properly instead of side-loading it from Xcode.

## Already done in this repo

| Requirement | State |
|---|---|
| Team | `DEVELOPMENT_TEAM = 4873VMS3TY` (Sandbox Digital Labs LLC) |
| Signing style | `CODE_SIGN_STYLE = Automatic` |
| Bundle id | `com.resp76.relay.companion` |
| Version / build | `MARKETING_VERSION = 1.0`, `CURRENT_PROJECT_VERSION = 1` |
| Export options | `method: app-store-connect`, `destination: upload`, team set |
| App icon | 1024×1024 present |
| Deployment target | iOS 17.0, iPhone + iPad |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` — accurate: the app makes no network connections, it only opens Safari via a `Link` |
| Release archive | Verified: `ARCHIVE SUCCEEDED` unsigned |

## Steps only you can do

These need your Apple ID, so they can't be scripted here.

1. **Create the app record** in App Store Connect → Apps → **+** → New App.
   - Platform iOS, Bundle ID `com.resp76.relay.companion` (pick it from the list;
     if it is absent, archiving once with automatic signing registers it, or add
     it under Certificates, Identifiers & Profiles → Identifiers)
   - SKU: anything unique, e.g. `relay-companion`
   - Name must be unique across the App Store; "Relay Companion" may be taken.

2. **Create an App Store Connect API key** (Users and Access → Integrations →
   App Store Connect API → **+**), role *App Manager*. Download the `.p8`
   **once** and note the Key ID and Issuer ID. Store it at
   `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`.

   You currently have no API key and no local provisioning profiles, so this and
   step 1 are the actual blockers.

## Archive and upload

```sh
xcodebuild -project ios/RelayCompanion/RelayCompanion.xcodeproj \
  -scheme RelayCompanion -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/RelayCompanion.xcarchive \
  -allowProvisioningUpdates archive
```

```sh
xcodebuild -exportArchive \
  -archivePath build/RelayCompanion.xcarchive \
  -exportOptionsPlist ios/RelayCompanion/ExportOptions.plist \
  -exportPath build/export \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 \
  -authenticationKeyID <KEYID> \
  -authenticationKeyIssuerID <ISSUER-UUID>
```

`ExportOptions.plist` sets `destination: upload`, so the export step uploads
straight to App Store Connect — there is no separate `altool` call.

## Then in TestFlight

- **Internal testing** (you and up to 100 people on your team) needs **no Beta
  App Review**. The build is usable minutes after processing. This is the path
  you want.
- **External testing** does require Beta App Review, and needs a description,
  test notes, and a privacy policy URL. Relay has one at `/privacy`.

## Every subsequent upload

`CURRENT_PROJECT_VERSION` must increase or App Store Connect rejects the build:

```sh
xcrun agvtool next-version -all   # run inside ios/RelayCompanion
```

## Known gaps before external testing

- The app targets iPhone **and** iPad (`TARGETED_DEVICE_FAMILY = "1,2"`), so
  external review expects iPad screenshots. Drop iPad support if you don't want
  to maintain them.
- No physical-device run has been done — only simulator and an unsigned device
  build. Verify contacts, calendar permission, and export on real hardware
  before inviting anyone.
- The bundle id prefix `com.resp76.*` doesn't match your other app's
  `com.digitalsandboxlabs.*`. Harmless, but rename now if you want consistency —
  it cannot change after the app record exists.
