import { isNativeShell } from "./api-base.ts";

/**
 * Contacts and Calendar straight off the phone, replacing the export-a-file
 * then import-a-file dance.
 *
 * The native plugin returns the same record shapes the companion's JSON export
 * used, so this builds an identical snapshot and hands it to the existing
 * parseIPhoneExport — data from our own plugin is validated exactly like a file
 * the user picked.
 *
 * `report` surfaces each step to the UI. Native logs proved unreadable during
 * debugging, so the app says on screen how far it got: whether the plugin was
 * even found, and which call is outstanding. A hang then points at a specific
 * step instead of being a black box.
 */

type DeviceContact = { id: string; name: string; email: string; phone: string; organization: string };
type DeviceEvent = { id: string; title: string; start: string; end: string; calendarId: string; calendarName: string; allDay: boolean };

type AuxiloNativePlugin = {
  pickContacts(): Promise<{ contacts: DeviceContact[] }>;
  readCalendar(): Promise<{ events: DeviceEvent[] }>;
};

export async function readDeviceSnapshot(report: (step: string) => void = () => {}): Promise<string | null> {
  if (!isNativeShell) return null;

  const { Capacitor, registerPlugin } = await import("@capacitor/core");

  // Definitive, log-free check: is the native plugin actually registered? If
  // this is false the picker never had a chance — the plugin did not load.
  if (!Capacitor.isPluginAvailable("AuxiloNative")) {
    throw new Error("The device contacts plugin isn’t available in this build (AuxiloNative not registered). Please report this.");
  }

  const native = registerPlugin<AuxiloNativePlugin>("AuxiloNative");

  report("Opening the contact picker…");
  const { contacts } = await native.pickContacts();

  report(`Got ${contacts.length} contact${contacts.length === 1 ? "" : "s"}. Reading calendar…`);
  const { events } = await native.readCalendar();

  report("Building snapshot…");
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    contacts,
    events,
  });
}
