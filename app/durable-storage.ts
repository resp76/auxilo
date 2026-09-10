import { isNativeShell } from "./api-base.ts";

/**
 * iOS can clear a WKWebView's localStorage under storage pressure, which would
 * silently lose every task. On device the same JSON is mirrored into Capacitor
 * Preferences — the app container rather than web storage — and read back when
 * localStorage returns empty.
 *
 * localStorage stays authoritative so the synchronous first render is
 * unchanged; this is a backup, not a migration. The web build keeps using
 * localStorage alone and never loads the plugin.
 */
export async function mirrorTasks(key: string, value: string): Promise<void> {
  if (!isNativeShell) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // Best effort: losing the mirror is survivable, breaking the app is not.
  }
}

export async function recoverTasks(key: string): Promise<string | null> {
  if (!isNativeShell) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return (await Preferences.get({ key })).value ?? null;
  } catch {
    return null;
  }
}
