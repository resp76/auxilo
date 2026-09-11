import Capacitor
import Contacts
import ContactsUI
import EventKit
import Foundation

/**
 Contacts and Calendar for the Auxilo shell.

 This is deliberately our own plugin rather than a community one: the EventKit
 and Contacts code is lifted from ios/AuxiloCompanion, which is already built
 and shipped, so there is no third-party dependency in the supply chain.

 Both methods emit exactly the shapes the companion's JSON export uses, so the
 web layer feeds them through the existing parseIPhoneExport validation instead
 of gaining a second, unvalidated path for the same data.
 */
@objc(AuxiloNativePlugin)
public class AuxiloNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AuxiloNativePlugin"
    public let jsName = "AuxiloNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickContacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readCalendar", returnType: CAPPluginReturnPromise)
    ]

    private let store = EKEventStore()
    private var pickerDelegate: ContactPickerDelegate?

    /// Presents the system picker. Only the contacts the user taps are ever
    /// read — the app never enumerates the address book.
    @objc func pickContacts(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No view controller is available to present the contact picker.")
                return
            }
            let picker = CNContactPickerViewController()
            let delegate = ContactPickerDelegate(
                selected: { [weak self] contacts in
                    call.resolve(["contacts": contacts])
                    self?.pickerDelegate = nil
                },
                cancelled: { [weak self] in
                    call.resolve(["contacts": []])
                    self?.pickerDelegate = nil
                }
            )
            self.pickerDelegate = delegate // the picker holds its delegate weakly
            picker.delegate = delegate
            presenter.present(picker, animated: true)
        }
    }

    /// Requests full calendar access and reads the next 30 days.
    @objc func readCalendar(_ call: CAPPluginCall) {
        Task {
            do {
                guard try await store.requestFullAccessToEvents() else {
                    call.reject("Calendar access was denied. You can change it in iOS Settings.")
                    return
                }
                let calendars = store.calendars(for: .event)
                guard !calendars.isEmpty else {
                    call.resolve(["events": []])
                    return
                }
                let start = Calendar.current.startOfDay(for: Date())
                guard let end = Calendar.current.date(byAdding: .day, value: 30, to: start) else {
                    call.resolve(["events": []])
                    return
                }

                let iso = ISO8601DateFormatter()
                let dateOnly = DateFormatter()
                dateOnly.locale = Locale(identifier: "en_US_POSIX")
                dateOnly.calendar = Calendar(identifier: .gregorian)
                dateOnly.dateFormat = "yyyy-MM-dd"

                let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
                let events = store.events(matching: predicate)
                    .sorted { $0.startDate < $1.startDate }
                    .map { event -> [String: Any] in
                        [
                            // Recurring events repeat their identifier, so the
                            // start time disambiguates instances — same key the
                            // file export uses, and what the duplicate check
                            // in parseIPhoneExport expects.
                            "id": "\(event.eventIdentifier ?? UUID().uuidString):\(iso.string(from: event.startDate))",
                            "title": event.title ?? "Untitled event",
                            "start": event.isAllDay ? dateOnly.string(from: event.startDate) : iso.string(from: event.startDate),
                            "end": event.isAllDay ? dateOnly.string(from: event.endDate) : iso.string(from: event.endDate),
                            "calendarId": event.calendar.calendarIdentifier,
                            "calendarName": event.calendar.title,
                            "allDay": event.isAllDay
                        ]
                    }
                call.resolve(["events": events])
            } catch {
                call.reject("Could not access Calendar. Check iOS permissions and try again.")
            }
        }
    }
}

private final class ContactPickerDelegate: NSObject, CNContactPickerDelegate {
    private let selected: ([[String: Any]]) -> Void
    private let cancelled: () -> Void

    init(selected: @escaping ([[String: Any]]) -> Void, cancelled: @escaping () -> Void) {
        self.selected = selected
        self.cancelled = cancelled
    }

    func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        cancelled()
    }

    func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
        selected(contacts.map { contact in
            [
                "id": contact.identifier,
                "name": CNContactFormatter.string(from: contact, style: .fullName) ?? "Unnamed contact",
                "email": contact.emailAddresses.first.map { $0.value as String } ?? "",
                "phone": contact.phoneNumbers.first?.value.stringValue ?? "",
                "organization": contact.organizationName
            ]
        })
    }
}
