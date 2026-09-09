import Link from "next/link";

export const metadata = {
  title: "Privacy — Relay Day Sync",
  description: "How Relay Day Sync handles account, task, contact, and calendar data.",
};

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <article>
        <Link className="policy-brand" href="/">Relay Day Sync</Link>
        <h1>Privacy policy</h1>
        <p className="policy-date">Effective September 9, 2026</p>

        <p>Relay Day Sync is a productivity dashboard with an optional iPhone companion. We designed it so the information you choose stays under your control.</p>

        <h2>Information Relay handles</h2>
        <p>The iPhone app can access contacts you explicitly select and calendars you authorize. It uses that information on your device to show selected records and create a JSON export. Nothing is uploaded automatically.</p>
        <p>The web app can receive an export only when you choose the file yourself. Imported iPhone data remains in the current browser tab. Tasks and reminders are stored in that browser for the signed-in account.</p>

        <h2>Accounts and optional connections</h2>
        <p>Supabase provides account authentication. If you connect Google Calendar or Google Contacts, Google provides temporary authorization for the features you select. Relay does not sell personal information or use it for advertising or cross-app tracking.</p>

        <h2>Sharing and retention</h2>
        <p>Relay shares information only with service providers needed to provide authentication or an integration you request. Your browser controls locally saved tasks. You control exported files through the Files app and can remove a web import by closing or reloading the tab.</p>

        <h2>Your choices</h2>
        <p>You can revoke Contacts or Calendar access in iOS Settings, disconnect Google access in Relay or your Google Account, sign out, clear browser storage, and delete exported files at any time.</p>

        <h2>Children</h2>
        <p>Relay is not directed to children under 13.</p>

        <h2>Contact</h2>
        <p>For privacy questions or account-deletion help, open a request in the <a href="https://github.com/resp76/relay-productivity-dashboard/issues" target="_blank" rel="noreferrer">Relay support tracker</a>.</p>
      </article>
    </main>
  );
}
