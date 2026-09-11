import { isNativeShell } from "./api-base.ts";

/**
 * Auth callbacks for the native shell.
 *
 * On the web, Supabase redirects the page to the provider and back to the site
 * origin. In the app that origin is capacitor://localhost, which Supabase will
 * not accept — it falls back to the configured Site URL, so sign-in finishes in
 * Safari and the app never receives a session.
 *
 * Instead the app registers a custom scheme as the redirect. iOS hands the
 * callback to the app and the code in it is exchanged for a session.
 *
 * The listener is registered for the lifetime of the auth gate rather than
 * around a single button press: a magic link or a confirmation email is opened
 * from Mail minutes later, long after any per-click listener would have gone.
 * One handler covers OAuth, magic links and sign-up confirmations alike.
 *
 * This scheme must also be listed in Supabase under Authentication → URL
 * Configuration → Redirect URLs, and in ios-app/App/App/Info.plist.
 */
export const NATIVE_REDIRECT = "auxilo://auth-callback";

/** Opens the provider in the system browser. The callback arrives separately. */
export async function openAuthBrowser(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

export async function closeAuthBrowser(): Promise<void> {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Already dismissed, or the user swiped it away — nothing to do.
  }
}

/**
 * Calls `onCode` whenever iOS hands back an auth callback. Returns a cleanup
 * function. No-ops off-device so the web build can call it unconditionally.
 */
export function listenForAuthCallback(onCode: (code: string) => void): () => void {
  if (!isNativeShell) return () => {};
  let remove = () => {};
  let cancelled = false;

  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("appUrlOpen", event => {
        if (!event.url.startsWith(NATIVE_REDIRECT)) return; // ignore unrelated deep links
        // Supabase PKCE returns ?code=…; an error comes back as ?error_description=…
        const params = new URL(event.url).searchParams;
        const code = params.get("code");
        if (code) onCode(code);
      });
      if (cancelled) void listener.remove();
      else remove = () => void listener.remove();
    } catch {
      // Without the plugin there is no deep linking; sign-in still works via password.
    }
  })();

  return () => { cancelled = true; remove(); };
}
