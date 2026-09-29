import BotaAppSDK
import SwiftUI

@main
struct BotaConnectApp: App {
    var body: some Scene {
        WindowGroup { ConnectView().frame(minWidth: 500, minHeight: 420) }
    }
}

@MainActor
struct ConnectView: View {
    @State private var client = BotaDeviceClient()
    @State private var serial = ""
    @State private var devices: [DiscoveredDevice] = []
    @State private var connected: ConnectedDevice?
    @State private var ready = false
    @State private var busy = false
    @State private var message = "Initializing Bluetooth…"
    @State private var operation: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Connect to Bota").font(.largeTitle)
            Text("Read-only discovery and status. No API key required.")
            TextField("Exact serial printed on the device", text: $serial)
                .disabled(busy || connected != nil)
            Button("Scan for 10 seconds") {
                run {
                    devices = []
                    for try await device in try await client.devices.startScan() {
                        devices.removeAll { $0.id == device.id }
                        devices.append(device)
                    }
                    message = "Select a device after entering its exact serial."
                }
            }.disabled(!ready || busy || connected != nil)
            ScrollView {
                ForEach(devices, id: \.id) { candidate in
                    Button("\(candidate.name ?? "Bota device") · \(candidate.rssi) dBm") {
                        run {
                            let expected = serial.trimmingCharacters(in: .whitespacesAndNewlines)
                            let device = try await client.devices.connect(serialNumber: expected, device: candidate)
                            connected = device
                            message = "Verified serial: \(device.serialNumber)"
                        }
                    }.disabled(busy || serial.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || connected != nil)
                }
            }
            HStack {
                Button("Read status") { run { message = String(describing: try await client.devices.readStatus()) } }
                Button("Disconnect") { run { try await client.devices.disconnect(); connected = nil; message = "Disconnected." } }
            }.disabled(busy || connected == nil)
            Text(message).textSelection(.enabled)
        }
        .padding(24)
        .task {
            do {
                try await client.configure()
                ready = true
                message = "Enter the exact device serial, then scan."
                for await device in await client.devices.connectionUpdates() { connected = device }
            } catch { message = "Initialization failed. Check Bluetooth permissions." }
        }
        .onDisappear {
            operation?.cancel()
            Task { await client.destroy() }
        }
    }

    private func run(_ action: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        busy = true
        operation = Task { @MainActor in
            defer { busy = false }
            do { try await action() }
            catch { message = "Operation failed. Check serial, Bluetooth, and device availability." }
        }
    }
}
