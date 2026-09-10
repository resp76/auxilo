import SwiftUI
import EventKit
import EventKitUI
import Contacts
import ContactsUI
import UniformTypeIdentifiers

@main
struct AuxiloCompanionApp: App {
    var body: some Scene { WindowGroup { AuxiloCompanionView() } }
}

struct AuxiloContact: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let phone: String
    let organization: String
}

struct AuxiloEvent: Codable {
    let id: String
    let title: String
    let start: String
    let end: String
    let calendarId: String
    let calendarName: String
    let allDay: Bool
}

struct AuxiloSnapshot: Encodable {
    let version = 1
    let exportedAt: String
    let contacts: [AuxiloContact]
    let events: [AuxiloEvent]
}

struct SnapshotDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let contents = configuration.file.regularFileContents else { throw CocoaError(.fileReadCorruptFile) }
        data = contents
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct CalendarEditor: UIViewControllerRepresentable {
    let store: EKEventStore
    let event: EKEvent
    let done: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(done: done) }
    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let controller = EKEventEditViewController()
        controller.eventStore = store
        controller.event = event
        controller.editViewDelegate = context.coordinator
        return controller
    }
    func updateUIViewController(_ controller: EKEventEditViewController, context: Context) {}
    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let done: () -> Void
        init(done: @escaping () -> Void) { self.done = done }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) { done() }
    }
}

struct ContactPicker: UIViewControllerRepresentable {
    let selected: ([AuxiloContact]) -> Void
    let cancelled: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(selected: selected, cancelled: cancelled) }
    func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: CNContactPickerViewController, context: Context) {}
    final class Coordinator: NSObject, CNContactPickerDelegate {
        let selected: ([AuxiloContact]) -> Void
        let cancelled: () -> Void
        init(selected: @escaping ([AuxiloContact]) -> Void, cancelled: @escaping () -> Void) { self.selected = selected; self.cancelled = cancelled }
        func contactPickerDidCancel(_ picker: CNContactPickerViewController) { cancelled() }
        func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
            selected(contacts.map { contact in
                AuxiloContact(id: contact.identifier,
                    name: CNContactFormatter.string(from: contact, style: .fullName) ?? "Unnamed contact",
                    email: contact.emailAddresses.first.map { $0.value as String } ?? "",
                    phone: contact.phoneNumbers.first?.value.stringValue ?? "",
                    organization: contact.organizationName)
            })
        }
    }
}

struct EditableEvent: Identifiable {
    let id = UUID()
    let event: EKEvent
}

/// Shown before anything is requested, so the app explains itself instead of
/// opening on a contact picker. There is no sign-in here on purpose: the
/// companion never talks to a Auxilo account, it only writes a file you share.
struct AuxiloIntroView: View {
    let continueAction: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "arrow.triangle.2.circlepath.circle")
                .font(.system(size: 52))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)
            Text("Auxilo").font(.largeTitle.bold())
            Text("Send selected contacts and calendars to your Auxilo workspace.")
                .font(.headline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            VStack(alignment: .leading, spacing: 13) {
                Label("You pick exactly which contacts and calendars are included.", systemImage: "hand.raised")
                Label("Nothing is uploaded. Auxilo writes a file that you share yourself.", systemImage: "lock")
                Label("No account or sign-in is needed on this device.", systemImage: "person.crop.circle.badge.checkmark")
            }
            .font(.subheadline)
            .padding(.top, 4)
            Spacer()
            Button(action: continueAction) {
                Text("Get started").frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            Text("iOS will ask your permission before Auxilo reads anything.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(26)
    }
}

struct AuxiloCompanionView: View {
    @State private var store = EKEventStore()
    @State private var calendars: [EKCalendar] = []
    @State private var selectedCalendars: Set<String> = []
    @State private var contacts: [AuxiloContact] = []
    @State private var events: [EKEvent] = []
    @State private var showContacts = false
    @State private var showExport = false
    @State private var document = SnapshotDocument(data: Data())
    @State private var editor: EditableEvent?
    @State private var message = "Select exactly what to share with Auxilo. Nothing is uploaded automatically."
    @State private var contactSearch = ""
    @State private var introDismissed = false
    // Storage key deliberately keeps the old "relay." prefix: renaming it would
    // re-show the intro to anyone who already dismissed it. It is internal.
    @AppStorage("relay.companion.introSeen") private var introSeen = false
    @Environment(\.scenePhase) private var scenePhase

    /// Launch arguments let UI tests pin this either way instead of depending
    /// on whatever the simulator happens to have stored from a previous run.
    private var showIntro: Bool {
        if introDismissed { return false }
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-auxilo-show-intro") { return true }
        if arguments.contains("-auxilo-skip-intro") { return false }
        return !introSeen
    }

    var body: some View {
        if showIntro {
            AuxiloIntroView(continueAction: { introSeen = true; introDismissed = true })
        } else {
            companionForm
        }
    }

    private var companionForm: some View {
        NavigationStack {
            Form {
                Section("Contacts") {
                    Button("Choose contacts") { showContacts = true }
                    TextField("Search selected contacts", text: $contactSearch)
                    ForEach(contacts.filter { contactSearch.isEmpty || "\($0.name) \($0.email) \($0.phone) \($0.organization)".localizedCaseInsensitiveContains(contactSearch) }) { contact in
                        VStack(alignment: .leading) {
                            Text(contact.name).font(.headline)
                            Text(contact.email).font(.caption)
                        }
                    }
                    if !contacts.isEmpty { Button("Clear selected contacts", role: .destructive) { contacts = [] } }
                    Text("Only the contacts you pick are included. No contact notes or photos are exported.").font(.caption)
                }
                Section("Calendars") {
                    Button("Allow calendar access") { Task { await authorizeCalendar() } }
                    ForEach(calendars, id: \.calendarIdentifier) { calendar in
                        Toggle(calendar.title, isOn: Binding(get: { selectedCalendars.contains(calendar.calendarIdentifier) }, set: { enabled in
                            if enabled { selectedCalendars.insert(calendar.calendarIdentifier) } else { selectedCalendars.remove(calendar.calendarIdentifier) }
                            refreshEvents()
                        }))
                    }
                    if calendars.contains(where: { $0.allowsContentModifications && selectedCalendars.contains($0.calendarIdentifier) }) {
                        Button("Create calendar event") {
                            let event = EKEvent(eventStore: store)
                            event.calendar = calendars.first(where: { $0.allowsContentModifications && selectedCalendars.contains($0.calendarIdentifier) })
                            event.startDate = Date()
                            event.endDate = event.startDate.addingTimeInterval(3600)
                            editor = EditableEvent(event: event)
                        }
                    }
                    Text("Reading events requires iOS full calendar permission. Auxilo exports only the calendars selected above.").font(.caption)
                }
                Section("Next 30 days") {
                    ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                        Button { editor = EditableEvent(event: event) } label: {
                            VStack(alignment: .leading) {
                                Text(event.title ?? "Untitled event")
                                Text(event.startDate, style: .date).font(.caption)
                                Text(event.calendar.title).font(.caption)
                            }
                        }.disabled(!event.calendar.allowsContentModifications)
                    }
                }
                Section("Export to Auxilo") {
                    Text(message).font(.callout)
                    Button("Export selected contacts and events") { export() }
                    Text("Save the JSON file, then choose Integrations → Import iPhone export in Auxilo. The file contains personal data: share it only with your own Auxilo session. Exports are snapshots; repeat the export to update Auxilo.").font(.caption)
                    Link("Open Auxilo", destination: URL(string: "https://relay-day-sync.roldee.chatgpt.site/")!)
                }
            }
            .navigationTitle("Auxilo")
            .sheet(isPresented: $showContacts) {
                ContactPicker(selected: { contacts = $0; showContacts = false }, cancelled: { showContacts = false })
            }
            .sheet(item: $editor) { item in CalendarEditor(store: store, event: item.event, done: { editor = nil; refreshEvents() }) }
            .fileExporter(isPresented: $showExport, document: document, contentType: .json, defaultFilename: "auxilo-iphone-export") { result in
                switch result { case .success: message = "Export saved. Import it in Auxilo to update the snapshot."; case .failure: message = "Export was not saved. You can try again." }
            }
            .onChange(of: scenePhase) { _, phase in if phase == .active { refreshEvents() } }
            .onReceive(NotificationCenter.default.publisher(for: .EKEventStoreChanged)) { _ in refreshEvents() }
        }
    }

    private func authorizeCalendar() async {
        do {
            guard try await store.requestFullAccessToEvents() else { message = "Calendar access was denied. You can change it in iOS Settings."; return }
            calendars = store.calendars(for: .event)
            message = "Choose calendars to include. None are selected automatically."
        } catch { message = "Could not access Calendar. Check iOS permissions and try again." }
    }

    private func refreshEvents() {
        guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else { calendars = []; events = []; selectedCalendars = []; return }
        calendars = store.calendars(for: .event)
        let selected = calendars.filter { selectedCalendars.contains($0.calendarIdentifier) }
        guard !selected.isEmpty else { events = []; return }
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .day, value: 30, to: start)!
        events = store.events(matching: store.predicateForEvents(withStart: start, end: end, calendars: selected)).sorted { $0.startDate < $1.startDate }
    }

    private func export() {
        refreshEvents()
        guard contacts.count <= 10000, events.count <= 10000 else { message = "Too many records. Choose fewer contacts or calendars (10,000 maximum each)."; return }
        let iso = ISO8601DateFormatter()
        let dateOnly = DateFormatter(); dateOnly.locale = Locale(identifier: "en_US_POSIX"); dateOnly.calendar = Calendar(identifier: .gregorian); dateOnly.dateFormat = "yyyy-MM-dd"
        let snapshot = AuxiloSnapshot(exportedAt: iso.string(from: Date()), contacts: contacts, events: events.map { event in
            AuxiloEvent(id: "\(event.eventIdentifier ?? UUID().uuidString):\(iso.string(from: event.startDate))", title: event.title ?? "Untitled event", start: event.isAllDay ? dateOnly.string(from: event.startDate) : iso.string(from: event.startDate), end: event.isAllDay ? dateOnly.string(from: event.endDate) : iso.string(from: event.endDate), calendarId: event.calendar.calendarIdentifier, calendarName: event.calendar.title, allDay: event.isAllDay)
        })
        do {
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(snapshot)
            guard data.count <= 5_000_000 else { message = "Export exceeds 5 MB. Select fewer records."; return }
            document = SnapshotDocument(data: data); showExport = true
        } catch { message = "Could not create the export. No file was written." }
    }
}
