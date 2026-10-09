import BotaAppSDK
import Foundation
import SwiftUI

@main
struct BotaCatalogApp: App {
    var body: some Scene {
        WindowGroup { CatalogView().frame(minWidth: 620, minHeight: 600) }
    }
}

private struct CatalogError: Error {}

@MainActor
struct CatalogView: View {
    @State private var client = BotaDeviceClient()
    @State private var serial = ""
    @State private var candidates: [DiscoveredDevice] = []
    @State private var connected: ConnectedDevice?
    @State private var verifiedSerial: String?
    @State private var acceptsConnection = false
    @State private var records: [PendingRecording] = []
    @State private var loaded = false
    @State private var paired = false
    @State private var ready = false
    @State private var busy = false
    @State private var message = "Initializing Bluetooth…"
    @State private var revision: UInt64 = 0
    @State private var operationID: UUID?
    @State private var operation: Task<Void, Never>?
    @State private var statusObservation: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Bota recording catalog").font(.largeTitle)
            Text("Pending metadata only. No audio transfer or cleanup.")
            TextField("Exact serial printed on your already-provisioned device", text: $serial)
                .disabled(busy || connected != nil)
            Button("Scan for 10 seconds") { scan() }
                .disabled(!ready || busy || connected != nil)
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(candidates, id: \.id) { candidate in
                        Button("\(candidate.name ?? "Bota device") · \(candidate.rssi) dBm") {
                            connect(candidate)
                        }.disabled(busy || connected != nil || serial.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }.frame(maxHeight: 130)
            HStack {
                Button("Refresh catalog") { refresh() }
                    .disabled(busy || connected == nil || verifiedSerial == nil)
                Button("Disconnect") { disconnect() }
                    .disabled(connected == nil)
            }
            Text(paired ? "Fresh pairing read: paired." : "Pairing has not been confirmed for this catalog read.")
            Text(verbatim: message).textSelection(.enabled)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if loaded && records.isEmpty { Text("No pending recordings reported in this snapshot.") }
                    ForEach(Array(records.enumerated()), id: \.offset) { _, record in
                        Text(verbatim: metadata(record)).textSelection(.enabled)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(24)
        .task { await observeConnections() }
        .onDisappear {
            ready = false
            clearConnection()
            let currentClient = client
            Task { await currentClient.destroy() }
        }
    }

    private func observeConnections() async {
        do {
            try await client.configure()
            let updates = await client.devices.connectionUpdates()
            for await device in updates {
                guard !Task.isCancelled else { return }
                if !ready {
                    ready = true
                    message = "Enter the exact device serial, then scan."
                }
                if let device {
                    guard acceptsConnection else { continue }
                    if connected?.id != device.id || connected?.serialNumber != device.serialNumber {
                        revision &+= 1
                        statusObservation?.cancel()
                        statusObservation = nil
                        clearCatalog()
                        verifiedSerial = nil
                    }
                    connected = device
                } else if connected != nil || acceptsConnection {
                    clearConnection()
                    message = "Connection lost. Catalog cleared; scan and verify again."
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            message = "Initialization failed. Check Bluetooth permissions."
        }
    }

    private func scan() {
        run { id in
            candidates = []
            for try await candidate in try await client.devices.startScan(timeoutMilliseconds: 10_000) {
                guard current(id) else { return }
                candidates.removeAll { $0.id == candidate.id }
                candidates.append(candidate)
            }
            guard current(id) else { return }
            message = "Select a candidate. Advertised names do not prove identity."
        }
    }

    private func connect(_ candidate: DiscoveredDevice) {
        let expected = serial.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !expected.isEmpty else { return }
        run { id in
            acceptsConnection = true
            let device = try await client.devices.connect(serialNumber: expected, device: candidate)
            guard current(id) else { return }
            guard device.serialNumber == expected else { throw CatalogError() }
            connected = device
            verifiedSerial = expected
            clearCatalog()
            message = "Identity verified. Refresh to read pairing and pending metadata."
            observeStatus(device)
        }
    }

    private func observeStatus(_ device: ConnectedDevice) {
        statusObservation?.cancel()
        let connectionRevision = revision
        statusObservation = Task { @MainActor in
            guard observes(connectionRevision, device) else { return }
            do {
                let updates = try await client.devices.statusUpdates()
                guard observes(connectionRevision, device) else { return }
                for try await _ in updates {
                    guard observes(connectionRevision, device) else { return }
                }
            } catch {
                // A failed subscription cannot support the displayed connection.
            }
            guard observes(connectionRevision, device) else { return }
            clearConnection()
            message = "Device status observation ended or failed. Catalog cleared; scan and verify again."
        }
    }

    private func observes(_ generation: UInt64, _ device: ConnectedDevice) -> Bool {
        !Task.isCancelled && revision == generation && connected?.id == device.id
            && connected?.serialNumber == device.serialNumber && verifiedSerial == device.serialNumber
    }

    private func refresh() {
        guard let device = connected, verifiedSerial == device.serialNumber else { return }
        let connectionRevision = revision
        run { id in
            clearCatalog()
            let state = try await client.controls.readPairingState(from: device)
            guard owns(id, connectionRevision, device) else { return }
            guard state == .paired else { throw CatalogError() }
            paired = true
            let snapshot = try await client.recordings.listPendingRecordings(device)
            guard owns(id, connectionRevision, device) else { return }
            records = snapshot
            loaded = true
            message = "Pending metadata snapshot read. This does not establish cloud completion."
        }
    }

    private func disconnect() {
        // Clear and fence immediately, even if the SDK disconnect later fails.
        clearConnection()
        run { id in
            do {
                try await client.devices.disconnect()
                guard current(id) else { return }
                message = "Disconnected. Catalog cleared."
            } catch {
                guard current(id) else { return }
                message = "Disconnect failed. Catalog remains cleared; native cleanup is not confirmed."
            }
        }
    }

    private func clearCatalog() {
        records = []
        loaded = false
        paired = false
    }

    private func clearConnection() {
        revision &+= 1
        statusObservation?.cancel()
        statusObservation = nil
        operation?.cancel()
        operation = nil
        operationID = nil
        busy = false
        connected = nil
        verifiedSerial = nil
        acceptsConnection = false
        candidates = []
        clearCatalog()
    }

    private func current(_ id: UUID) -> Bool {
        operationID == id && !Task.isCancelled
    }

    private func owns(_ id: UUID, _ generation: UInt64, _ device: ConnectedDevice) -> Bool {
        current(id) && revision == generation && connected?.id == device.id && verifiedSerial == device.serialNumber
    }

    private func run(_ action: @escaping @MainActor (UUID) async throws -> Void) {
        guard !busy else { return }
        let id = UUID()
        operationID = id
        busy = true
        operation = Task { @MainActor in
            defer {
                if operationID == id {
                    operationID = nil
                    operation = nil
                    busy = false
                }
            }
            do { try await action(id) }
            catch {
                guard current(id) else { return }
                clearCatalog()
                message = "Read failed or pairing was not confirmed. Check serial, permissions and device availability."
            }
        }
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
