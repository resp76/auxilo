"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { apiUrl, isNativeShell } from "./api-base.ts";
import { NATIVE_REDIRECT, closeAuthBrowser, listenForAuthCallback, openAuthBrowser } from "./native-auth.ts";
import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useState } from "react";

type AuthConfig = { url: string; publishableKey: string };
type AuthContextValue = { user: User | null; signOut: () => Promise<void> };

const AuthContext = createContext<AuthContextValue>({ user: null, signOut: async () => {} });

export function useAuxiloAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [demo, setDemo] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [emailMode, setEmailMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void fetch(apiUrl("/api/auth/config"), { cache: "no-store" })
      .then((response) => response.json() as Promise<AuthConfig>)
      .then((config) => {
        if (!active) return;
        if (!config.url || !config.publishableKey) {
          setConfigured(false);
          setLocalPreview(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
          setLoading(false);
          return;
        }

        const nextClient = createClient(config.url, config.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        setClient(nextClient);
        const listener = nextClient.auth.onAuthStateChange((_event, session) => {
          if (active) {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
        return nextClient.auth.getSession();
      })
      .then((result) => {
        if (active && result) {
          setUser(result.data.session?.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Auxilo couldn’t load sign-in. Please refresh and try again.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Any auxilo:// callback lands here: Google, a magic link tapped in Mail
  // days later, or a sign-up confirmation. Registered for the life of the gate
  // because those arrive long after whatever started them.
  useEffect(() => {
    if (!client) return;
    return listenForAuthCallback(code => {
      void client.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setMessage(error.message);
        void closeAuthBrowser();
      });
    });
  }, [client]);

  async function signInWithGoogle() {
    if (!client) return;
    setBusy(true);
    setMessage("");

    // In the native shell capacitor://localhost is not a redirect Supabase will
    // accept, so letting it redirect the page finishes sign-in in Safari and
    // the app never gets a session. Ask for the URL instead, open it in the
    // system browser, and complete the exchange when iOS hands back the
    // custom scheme.
    if (isNativeShell) {
      try {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
        });
        if (error) throw new Error(error.message);
        if (!data.url) throw new Error("Could not start Google sign-in. Please try again.");
        await openAuthBrowser(data.url);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Google sign-in failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  async function sendEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: isNativeShell ? NATIVE_REDIRECT : window.location.origin },
    });
    setMessage(error ? error.message : "Check your email for a secure sign-in link.");
    setBusy(false);
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function createAccount() {
    if (!client || !email.trim() || !password) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: isNativeShell ? NATIVE_REDIRECT : window.location.origin },
    });
    setMessage(error ? error.message : data.session ? "Your account is ready." : "Check your email to confirm your account.");
    setBusy(false);
  }

  async function signOut() {
    if (demo) {
      setDemo(false);
      return;
    }
    const result = await client?.auth.signOut();
    if (result?.error) window.alert("Sign-out failed. Check your connection and try again.");
  }

  if (loading) {
    return <main className="auth-page"><div className="auth-loading"><span className="brand-mark" /><span>Preparing Auxilo…</span></div></main>;
  }

  if (user || demo) {
    const activeUser = user ?? ({ id: "demo", email: "demo@auxilo.local", user_metadata: { full_name: "Demo User" }, app_metadata: {}, aud: "authenticated", created_at: "" } satisfies User);
    return <AuthContext.Provider key={activeUser.id} value={{ user: activeUser, signOut }}>{children}</AuthContext.Provider>;
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand"><span className="brand-mark" /><span>Auxilo</span></div>
        <div className="auth-copy">
          <p className="eyebrow">Your day, in sync</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to open your workspace and pick up where you left off.</p>
        </div>

        <button className="google-login" type="button" disabled={busy || !configured} onClick={() => void signInWithGoogle()}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.7 4.7 0 0 1-2 3v2.8h3.4c2-1.9 2.8-4.6 2.8-7.9Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.7c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.8A10.3 10.3 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.7A6 6 0 0 1 6 12c0-.6.1-1.2.4-1.8V7.4H3a10.1 10.1 0 0 0 0 9.1l3.4-2.8Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l3-3A10 10 0 0 0 3 7.5l3.4 2.8A6 6 0 0 1 12 6Z"/></svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or continue with email</span></div>

        <div className="email-modes" role="tablist" aria-label="Email sign-in method">
          <button type="button" role="tab" aria-selected={emailMode === "link"} className={emailMode === "link" ? "active" : ""} onClick={() => { setEmailMode("link"); setMessage(""); }}>Email link</button>
          <button type="button" role="tab" aria-selected={emailMode === "password"} className={emailMode === "password" ? "active" : ""} onClick={() => { setEmailMode("password"); setMessage(""); }}>Password</button>
        </div>

        <form className="email-login" onSubmit={emailMode === "link" ? sendEmailLink : signInWithPassword}>
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy || !configured} />
          {emailMode === "password" && <><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" disabled={busy || !configured} /></>}
          <button type="submit" disabled={busy || !configured}>{busy ? "Please wait…" : emailMode === "link" ? "Email me a sign-in link" : "Sign in"}</button>
          {emailMode === "password" && <button className="create-account" type="button" disabled={busy || !configured || !email.trim() || password.length < 6} onClick={() => void createAccount()}>Create an account</button>}
        </form>

        {!configured && <p className="auth-message setup">Add the Supabase URL and publishable key to enable sign-in.</p>}
        {!configured && localPreview && <button className="demo-login" type="button" onClick={() => setDemo(true)}>Continue with demo workspace</button>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <p className="auth-terms">By continuing, you agree to keep your Auxilo workspace secure.</p>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
        <div className="auth-preview">
          <span>Today’s focus</span><strong>3 priorities</strong>
          <i /><i /><i />
        </div>
        <p>Everything that matters,<br />quietly organized.</p>
      </aside>
    </main>
  );
}
