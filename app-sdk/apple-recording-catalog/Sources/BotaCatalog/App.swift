import BotaAppSDK
import SwiftUI

@main
@MainActor
struct BotaCatalogApp: App {
    @StateObject private var model = CatalogModel()

    var body: some Scene {
        #if os(macOS)
        Window("Bota recording catalog", id: "catalog") {
            CatalogView(model: model).frame(minWidth: 620, minHeight: 600)
        }
        #else
        WindowGroup { CatalogView(model: model) }
        #endif
    }
}

@MainActor
struct CatalogView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: CatalogModel
    @State private var serial = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Bota recording catalog").font(.largeTitle)
                Text("Pending metadata only. No audio transfer or cleanup.")
                TextField("Exact serial printed on your already-provisioned device", text: $serial)
                    .textFieldStyle(.roundedBorder)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    #endif
                    .disabled(model.busy || model.connected != nil)
                Button("Enable Bluetooth") { model.setActive(true) }
                    .disabled(model.ready || model.busy || model.cleanupFailed)
                Button("Scan for 10 seconds") { model.scan() }
                    .disabled(!model.ready || model.busy || model.connected != nil)
                ForEach(model.candidates, id: \.id) { candidate in
                    Button("\(candidate.name ?? "Bota device") · \(candidate.rssi) dBm") {
                        model.connect(candidate, serial: serial)
                    }
                    .disabled(!model.ready || model.busy || model.connected != nil || serial.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                if let device = model.connected {
                    Text("Verified serial: \(device.serialNumber)")
                    HStack {
                        Button("Refresh catalog") { model.refresh() }
                            .disabled(!model.ready || model.busy)
                        Button("Disconnect") { model.disconnect() }
                    }
                }
                Text(model.paired ? "Fresh pairing read: paired." : "Pairing has not been confirmed for this catalog read.")
                Text(verbatim: model.message).textSelection(.enabled)
                Divider()
                if model.loaded && model.records.isEmpty {
                    Text("No pending recordings reported in this snapshot.")
                }
                ForEach(Array(model.records.enumerated()), id: \.offset) { _, record in
                    Text(verbatim: metadata(record)).textSelection(.enabled)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .onAppear { model.setActive(scenePhase == .active) }
        .onChange(of: scenePhase) { phase in model.setActive(phase == .active) }
        .onDisappear { model.setActive(false) }
    }

    private func metadata(_ record: PendingRecording) -> String {
        switch record {
        case .legacy(let value):
            return "Legacy catalog\nID: \(value.uuid)\nStarted: \(value.startedAt.ISO8601Format())\nDuration: \(value.durationMs) ms · File: \(value.fileSizeBytes) bytes\nEncryption flag: \(value.isEncrypted). Legacy does not mean plaintext."
        case .encryptedV2(let value):
            return "Encrypted v2 catalog\nID: \(value.uuid) · Generation: \(value.generation)\nStarted: \(value.startedAtMs) ms since epoch\nDuration: \(value.durationMs) ms · Ciphertext: \(value.ciphertextLength) bytes\nPlaintext length: \(value.plaintextLength) bytes · Storage format: \(value.storageFormat)"
        }
    }
}
