# Auxilo setup

Every external setting Auxilo needs, in one place, with the symptom each
missing piece produces. Nothing here is code — it is all dashboard work, and
the app cannot substitute for any of it.

## Already done

| Thing | State |
|---|---|
| Domain | `auxilo.app` (Porkbun, renews 2027-09-10) |
| Hosting | OpenAI Sites, custom domain live with HTTPS |
| Supabase project | `kuibmkfcuqffreewqvdn`, URL + publishable key served by the worker |
| App Store Connect | record exists for `com.digitalsandboxlabs.auxilo`; build 2 uploaded |

## 1. Supabase — sign-in

The single most important setting. **One missing entry breaks Google sign-in,
magic links and sign-up confirmations all at once.**

**Authentication → URL Configuration**

| Field | Value |
|---|---|
| Site URL | `https://auxilo.app` |
| Redirect URLs | `https://auxilo.app` **and** `auxilo://auth-callback` |

`auxilo://auth-callback` is what the iPhone app registers. Without it Supabase
ignores the requested redirect and falls back to the Site URL, so sign-in
finishes **in the browser** and the app never receives a session — you end up
using the website inside an in-app browser sheet.

### Getting an account without waiting for email

Supabase's built-in mailer is rate limited to a couple of messages an hour and
is meant only for testing, so confirmation emails often never arrive.

Fastest route — **Authentication → Users → Add user**:
- email, password, and tick **Auto Confirm User**

Then sign in with the **Password** tab in the app. That path uses no redirect,
no browser and no email, so it works even with everything else unconfigured.

Alternatively **Authentication → Providers → Email** → turn off **Confirm
email**. Before real users, configure **custom SMTP**.

## 2. Google Calendar and Contacts

Separate from signing in with Google. Sign-in is Supabase's OAuth; this is the
browser talking to Google's APIs directly with its own client ID.

**Google Cloud Console → APIs & Services**

1. **Enable** the *Google Calendar API* and the *People API*.
2. **Credentials → Create OAuth client ID → Web application**.
3. **Authorized JavaScript origins**: `https://auxilo.app`
   Missing this gives `Access blocked: Authorization Error — no registered
   origin — Error 401: invalid_client`.
4. If the consent screen is in **Testing**, add your own Google account under
   **Test users**, or every sign-in is blocked.
5. Put the client ID in the Sites environment as `GOOGLE_CLIENT_ID`.
   Until then `/api/google/config` returns `{"clientId":""}` and the connect
   button stays disabled. It is a *public* client ID — never the client secret.

## 3. Work-tool connectors

No project configuration. Each person pastes their own key and it is used only
in that tab. See [connectors](CONNECTORS.md) for scopes and what each reads.

| Connector | Key | Notes |
|---|---|---|
| GitHub | fine-grained token, read-only Issues | direct from the browser |
| Linear | personal API key `lin_api_…` | direct from the browser |
| Notion | internal integration token | via the worker proxy |
| Slack | **user** token `xoxp-…` with `search:read` | via the worker proxy; bot tokens are rejected |

## 4. iPhone app

Signing is configured (team `4873VMS3TY`). To run on a device see
[mobile](MOBILE.md); the build prerequisites matter, since a fresh clone cannot
build until `pnpm install`, `mobile:build` and `cap sync` have run.

For TestFlight, [TESTFLIGHT.md](TESTFLIGHT.md) has the archive and upload
commands. The Capacitor app currently uses a **different** bundle id
(`…auxilo.mobile`) from the companion already on TestFlight (`…auxilo`), and
has no App Store Connect record of its own yet.

## Symptom lookup

| What you see | What is missing |
|---|---|
| Sign-in finishes in Safari, app still logged out | `auxilo://auth-callback` in Supabase redirect URLs |
| Magic link opens the website, not the app | same |
| No confirmation email | Supabase built-in mailer; use Auto Confirm, or custom SMTP |
| `Access blocked … no registered origin` | `https://auxilo.app` not an authorized JS origin in Google Cloud |
| Google connect button disabled | `GOOGLE_CLIENT_ID` not set in the Sites environment |
| Reminder never fires | set in a browser, not the app — the web build cannot schedule OS notifications |
| No contact picker, panel says "Requires the Auxilo iPhone companion" | you are in a browser, not the app |
