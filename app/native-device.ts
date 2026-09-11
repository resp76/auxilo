import { isNativeShell } from "./api-base.ts";

/**
 * Contacts and Calendar straight off the phone, replacing the export-a-file
 * then import-a-file dance the companion app needed.
 *
 * The native plugin returns the same record shapes the companion's JSON export
 * used, so this builds an identical snapshot and hands it to the existing
 * parseIPhoneExport. Nothing reaching React skips that validation just because
 * it came from our own plugin rather than a file the user chose.
 */

type DeviceContact = { id: string; name: string; email: string; phone: string; organization: string };
type DeviceEvent = { id: string; title: string; start: string; end: string; calendarId: string; calendarName: string; allDay: boolean };

type AuxiloNativePlugin = {
  pickContacts(): Promise<{ contacts: DeviceContact[] }>;
  readCalendar(): Promise<{ events: DeviceEvent[] }>;
};

async function plugin(): Promise<AuxiloNativePlugin> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<AuxiloNativePlugin>("AuxiloNative");
}

/**
 * Runs the system contact picker, then reads the next 30 days of calendar.
 * Sequential on purpose: both present system UI and cannot overlap.
 *
 * Returns the snapshot as JSON, or null off-device. Errors are left to the
 * caller so permission refusals surface with the provider's own wording.
 */
export async function readDeviceSnapshot(): Promise<string | null> {
  if (!isNativeShell) return null;
  const native = await plugin();
  const { contacts } = await native.pickContacts();
  const { events } = await native.readCalendar();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    contacts,
    events,
  });
}
