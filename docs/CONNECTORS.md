# Live work-tool connectors

GitHub, Linear, Notion, and Slack load your real items into **Tasks**. Each is a
paste-a-key connector: you create the key, paste it into the card on
**Integrations**, and it is used for that tab only.

Keys are never written to `localStorage`, never sent to the database, and are
cleared on reload. Existing sample tasks for a source are replaced when that
source syncs.

## What each one reads

| Connector | Key | Reads | Transport |
|---|---|---|---|
| GitHub | Fine-grained token, read-only **Issues** | Open issues and PRs assigned to you | Direct to `api.github.com` |
| Linear | Personal API key (`lin_api_…`) | Your active assigned issues | Direct to `api.linear.app` |
| Notion | Internal integration token (`ntn_…` / `secret_…`) | 25 most recently edited pages shared with the integration | Via Relay's worker |
| Slack | **User** token (`xoxp-…`) with `search:read` | 25 recent messages sent to you | Via Relay's worker |

## Why two of them need a proxy

GitHub and Linear send permissive CORS headers, so the browser calls them
directly and the key never touches Relay's server.

Notion sends no CORS headers, and Slack allows the origin but refuses an
`Authorization` request header. Both are therefore forwarded by the worker route
`POST /api/connector`, which:

- accepts only the allowlisted providers `notion` and `slack`;
- rejects any path that resolves off the upstream origin (so `//evil.example/x`
  is refused, not followed);
- refuses upstream 3xx responses instead of replaying the key to a new location
  (the edge runtime does not support `redirect: "error"`, so it uses
  `redirect: "manual"` and checks the status);
- passes the key through for that one request and does not log, store, or reuse it.

Set up: create the key with the provider, paste it into the card, press Connect.
Nothing needs to go in `.dev.vars` — these keys are per-user, not per-deployment.

## Slack notes

Search needs a **user** token (`xoxp-`), not a bot token (`xoxb-`); bot tokens
cannot call `search.messages` and are rejected before any request is sent.
`search.messages` also requires the `search:read` scope.

## Not connected

Email (Gmail/Outlook/IMAP) and Apple Notes remain previews. IMAP/SMTP cannot run
from a browser at all, and Apple Notes has no public API — only the unbuilt
iPhone Shortcut bridge.
