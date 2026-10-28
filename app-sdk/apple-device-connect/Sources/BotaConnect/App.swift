import BotaAppSDK
import SwiftUI

@main
struct BotaConnectApp: App {
    var body: some Scene {
        WindowGroup {
            ConnectView()
                #if os(macOS)
                .frame(minWidth: 500, minHeight: 420)
                #endif
        }
    }
}

@MainActor
struct ConnectView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = ConnectModel()
    @State private var serial = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Connect to Bota").font(.largeTitle)
                Text("Discover your device and read its status.")
                TextField("Exact serial printed on the device", text: $serial)
                    .textFieldStyle(.roundedBorder)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    #endif
                    .disabled(model.busy || model.connected != nil)
                Button("Scan for 10 seconds") { model.scan() }
                    .disabled(!model.ready || model.busy || model.connected != nil)
                ForEach(model.devices, id: \.id) { candidate in
                    Button("\(candidate.name ?? "Bota device") · \(candidate.rssi) dBm") {
                        model.connect(candidate, serial: serial)
                    }
                    .disabled(!model.ready || model.busy || model.connected != nil || serial.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                if let device = model.connected {
                    Text("Serial: \(device.serialNumber)")
                    Text("Firmware: \(device.firmwareVersion) · MTU \(device.mtu)")
                    HStack {
                        Button("Read status") { model.readStatus() }
                        Button("Disconnect") { model.disconnect() }
                    }.disabled(model.busy || !model.ready)
                }
                if let status = model.status {
                    Text("Battery: \(status.batteryLevel)%")
                    Text("Storage: \(status.storageUsedMb) / \(status.storageTotalMb) MB")
                    Text("Pending recordings: \(status.pendingRecordings)")
                }
                Text(model.message).textSelection(.enabled)
            }
            .padding(24)
        }
        .onAppear { model.setActive(scenePhase == .active) }
        .onChange(of: scenePhase) { phase in model.setActive(phase == .active) }
        .onDisappear { model.setActive(false) }
    }
}
