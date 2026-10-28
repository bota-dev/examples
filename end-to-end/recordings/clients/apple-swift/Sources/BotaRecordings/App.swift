import SwiftUI

@main struct BotaRecordingsApp: App {
    @StateObject private var model = RecordingsModel()
    var body: some Scene {
        #if os(macOS)
        Window("Bota Recordings", id: "recordings") {
            RecordingsView(model: model).frame(minWidth: 540, minHeight: 560)
        }
        #else
        WindowGroup { RecordingsView(model: model) }
        #endif
    }
}

struct RecordingsView: View {
    @ObservedObject var model: RecordingsModel
    @Environment(\.scenePhase) private var phase
    @State private var origin = ""
    @State private var token = ""
    @State private var pane = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bota Recordings").font(.title2.bold())
                    Text(model.mode?.rawValue ?? "Swift sample for iOS and macOS").font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                if model.mode != nil { Button("Sign out") { clearSession() } }
            }
            Divider()
            if model.mode == nil { setup }
            else if model.selectedID != nil { selected }
            else { library }
            if model.busy || model.retiring {
                HStack { ProgressView(); Text(model.retiring ? "Closing readers…" : "Reading…").font(.caption) }
            }
            if let message = model.message { Text(verbatim: message).foregroundColor(.red).accessibilityLabel(message) }
            Spacer(minLength: 0)
        }
        .padding(20)
        .onChange(of: phase) { next in if next != .active { clearSession() } }
        .onDisappear { clearSession() }
        .onChange(of: model.selectedID) { _ in pane = 0 }
    }
    private var setup: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your recordings, transcripts and notes").font(.title3.bold())
            Text("Explore a synthetic library, or connect to your application's backend to read existing recordings.")
                .foregroundColor(.secondary)
            Button("Open Sample") { token = ""; model.openSample() }.buttonStyle(.borderedProminent).disabled(!model.canOpen)
            Text("Sample contains local synthetic text. It makes no network requests.").font(.caption).foregroundColor(.secondary)
            Divider()
            Text("Live library").font(.headline)
            TextField("Backend origin · https://your-backend.example", text: $origin).textFieldStyle(.roundedBorder)
                .disableAutocorrection(true)
            SecureField("Application token", text: $token).textFieldStyle(.roundedBorder)
            Text("Use a separate 32–256 character visible ASCII application token, never a Bota API key. It is kept in memory and discarded when this window becomes inactive or you sign out.")
                .font(.caption).foregroundColor(.secondary)
            Button("Connect to Live library") {
                model.openLive(origin: origin, token: token)
                token = ""
            }.disabled(!model.canOpen)
        }
    }
    private var library: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("Recordings").font(.headline); Spacer(); Button("Refresh") { model.refresh() }.disabled(model.busy) }
            if model.hasMore { Text("Showing the first 20 recordings or fewer. More recordings exist; this sample does not load further pages.").font(.caption).foregroundColor(.secondary) }
            if model.recordings.isEmpty && !model.busy { Text("No recordings in this library.").foregroundColor(.secondary) }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(model.recordings) { row in
                        Button { model.select(row.id) } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(verbatim: row.name ?? "Untitled recording").font(.headline)
                                    Text(verbatim: "\(row.createdAt) · \(row.status)").font(.caption).foregroundColor(.secondary)
                                }
                                Spacer(); Image(systemName: "chevron.right")
                            }.padding(.vertical, 12).contentShape(Rectangle())
                        }.buttonStyle(.plain)
                        Divider()
                    }
                }
            }
        }
    }
    private var selected: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Button("Back to recordings") { model.back() }
                Spacer()
                Button("Refresh") { model.refreshSelection() }.disabled(model.busy)
            }
            if let detail = model.detail {
                Text(verbatim: detail.name ?? "Untitled recording").font(.title3.bold())
                Text(verbatim: "\(detail.createdAt) · \(detail.status)").font(.caption).foregroundColor(.secondary)
                Picker("Content", selection: $pane) { Text("Transcript").tag(0); Text("Notes").tag(1) }.pickerStyle(.segmented)
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if pane == 0 {
                            if let text = model.transcript?.text { Text(verbatim: text).textSelection(.enabled) }
                            else { Text("No completed transcript is available. This sample only reads existing results.").foregroundColor(.secondary) }
                        } else if let notes = model.notes {
                            Text(verbatim: notes.overview).textSelection(.enabled)
                            notesList("Key points", notes.keyPoints)
                            notesList("Action items", notes.actionItems)
                            notesList("Decisions", notes.decisions)
                            notesList("Participants", notes.participants)
                        } else { Text("No completed general notes are available.").foregroundColor(.secondary) }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("Shows the first completed result in the returned snapshot; ordering is not guaranteed.").font(.caption).foregroundColor(.secondary)
            } else if !model.busy { Text("Content is unavailable. Refresh to read it again.").foregroundColor(.secondary) }
        }
    }
    @ViewBuilder private func notesList(_ title: String, _ items: [String]) -> some View {
        if !items.isEmpty {
            Text(title).font(.headline)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in Text(verbatim: "• \(item)").textSelection(.enabled) }
        }
    }
    private func clearSession() { token = ""; model.retire() }
}
