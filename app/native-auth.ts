import { isNativeShell } from "./api-base.ts";

/**
 * OAuth for the native shell.
 *
 * On the web, Supabase redirects the page to Google and back to the site
 * origin. In the app that origin is capacitor://localhost, which Supabase will
 * not accept as a redirect target — it falls back to the configured Site URL,
 * so sign-in completes in Safari and the app never receives a session.
 *
 * Instead the app opens the provider in the system browser and registers the
 * custom scheme below as the redirect. iOS hands the callback back to the app,
 * and the code in it is exchanged for a session here.
 *
 * This scheme must also be listed in Supabase under Authentication → URL
 * Configuration → Redirect URLs, and in ios-app/App/App/Info.plist.
 */
export const NATIVE_REDIRECT = "auxilo://auth-callback";

type SessionExchanger = {
  auth: { exchangeCodeForSession(code: string): Promise<{ error: { message: string } | null }> };
};

/**
 * Opens the provider, waits for iOS to hand back the callback URL, and
 * exchanges the code for a session. Resolves once signed in; the auth state
 * listener in AuthGate then renders the workspace.
 */
export async function nativeOAuthSignIn(client: SessionExchanger, authorizeUrl: string): Promise<void> {
  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);

  const callback = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void listener.then(l => l.remove());
      reject(new Error("Sign-in timed out. Please try again."));
    }, 180_000);

    const listener = App.addListener("appUrlOpen", event => {
      if (!event.url.startsWith(NATIVE_REDIRECT)) return; // ignore unrelated deep links
      clearTimeout(timeout);
      void listener.then(l => l.remove());
      resolve(event.url);
    });
  });

  await Browser.open({ url: authorizeUrl, presentationStyle: "popover" });
  const url = await callback;
  await Browser.close().catch(() => {});

  const code = new URL(url).searchParams.get("code");
  if (!code) throw new Error("Google did not return a sign-in code. Please try again.");

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}

export const supportsNativeOAuth = isNativeShell;
