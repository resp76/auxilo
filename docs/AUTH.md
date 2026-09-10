# Auxilo authentication setup

Auxilo uses Supabase Auth for Google OAuth, passwordless email links, and email/password accounts.

1. Create a Supabase project and copy its Project URL and publishable key into `.env.local` for local development using `.env.example` as a guide.
2. In Supabase Authentication, enable the Google provider and add its client ID and client secret from Google Cloud.
3. In Supabase URL Configuration, set the Site URL to the deployed Auxilo URL and allow `http://localhost:3000` as a redirect URL for development.
4. In Google Cloud, use the Supabase callback URL shown on the Google provider page as an authorized redirect URI.
5. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the hosted Site environment before publishing.

Email confirmation and magic links use Supabase's built-in email delivery for initial testing. Configure custom SMTP before production use. Keep both email-password sign-ups and magic links enabled in the Supabase email provider settings.
