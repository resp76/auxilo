# Auxilo web deployment

## Production

- Primary domain: `https://auxilo.app`
- Alternate domain: `https://www.auxilo.app`
- Sites fallback URL: `https://relay-day-sync.roldee.chatgpt.site`
- Hosting project ID: `appgprj_6aa01752dd008191bb8ba2aa2fbba0b4`
- Hosting manifest: `.openai/hosting.json`
- Source repository: `https://github.com/resp76/auxilo`
- Production branch: `main`
- Domain status: active with HTTPS (verified September 10, 2026)

The custom domains are registered with the existing Sites project. DNS and TLS status are managed by Sites after the records below are published at Porkbun.

## Porkbun DNS records

Create these records in Porkbun's **DNS Records** screen for `auxilo.app`. Porkbun expects relative host names, so use the host values shown here rather than the full domain names.

| Type | Host | Answer / value | Purpose |
| --- | --- | --- | --- |
| A | `(blank)` | `162.159.143.30` | Routes the apex domain to Sites |
| A | `(blank)` | `172.66.3.26` | Routes the apex domain to Sites |
| TXT | `_openai-site-verification` | `openai-site-verification=T4Yz-dxMSQaww-LpnGGYkWLqmm4McSwzrk2JplgoulM` | Verifies the apex domain with Sites |
| TXT | `_cf-custom-hostname` | `0f760fec-29f7-411a-b8bb-ad5a5082f6dd` | Authorizes TLS for the apex domain |
| CNAME | `www` | `custom-domains.chatgpt.site` | Routes `www.auxilo.app` to Sites |
| TXT | `_openai-site-verification.www` | `openai-site-verification=D3_ldD_xt4h-2R0EOR-q9aD45WP0IskiywEgmV3ChlQ` | Verifies the `www` hostname with Sites |
| TXT | `_cf-custom-hostname.www` | `fe125b51-631e-4dca-8bef-387203ba0f09` | Authorizes TLS for the `www` hostname |

Use Porkbun's default TTL. Remove conflicting apex `A`, `ALIAS`, or URL forwarding records and conflicting `www` records before adding these records. Keep unrelated records such as email (`MX`, SPF, DKIM, and DMARC) in place.

DNS changes normally become visible within minutes but can take longer because of resolver caching. Sites provisions HTTPS after it sees the routing and validation records.

## Release procedure

1. Make and review the application changes on a branch.
2. Run the release checks:

   ```sh
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

3. Merge the reviewed commit into `main` and push `main` to GitHub.
4. Build and publish that exact commit through Sites, using the project ID in `.openai/hosting.json`.
5. Confirm the deployment and custom-domain status in Sites.
6. Smoke-test `https://auxilo.app`, `https://auxilo.app/privacy`, sign-in, and one task/reminder workflow.

## Runtime configuration

Public Supabase settings are described in [AUTH.md](AUTH.md). Store deployed runtime values in Sites rather than committing them. Never commit `.env.local`, OAuth client secrets, Supabase service-role keys, provider access tokens, or Sites source credentials.

Supabase Auth uses the following production URL configuration:

- Site URL: `https://auxilo.app`
- Redirect URL: `https://auxilo.app/**`
- Redirect URL: `https://www.auxilo.app/**`
- Local development redirect: `http://localhost:3000`

Google OAuth must allow `https://auxilo.app` and `https://www.auxilo.app` as application origins where required. The production Google sign-in callback was verified on `https://auxilo.app` on September 10, 2026.

## Domain renewal and ownership

Porkbun remains the registrar and authoritative DNS provider. Keep domain auto-renewal and account recovery details in the Porkbun account; do not store registrar credentials in this repository.
