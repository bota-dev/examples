import BotaAppSDK
import Combine
import Foundation

// Public calls stay visible here; tests substitute a synthetic device.
// The SDK owns Bluetooth, identity verification and native cleanup.
struct DeviceActions: Sendable {
    var configure: @Sendable () async throws -> Void
    var scan: @Sendable () async throws -> AsyncThrowingStream<DiscoveredDevice, Error>
    var connect: @Sendable (String, DiscoveredDevice) async throws -> ConnectedDevice
    var readStatus: @Sendable () async throws -> DeviceStatus
    var updates: @Sendable () async -> AsyncStream<ConnectedDevice?>
    var cancel: @Sendable () async throws -> Void
    var disconnect: @Sendable () async throws -> Void
    var destroy: @Sendable () async -> Void

    static func live() -> Self {
        let client = BotaDeviceClient()
        return Self(
            configure: { try await client.configure() },
            scan: { try await client.devices.startScan(timeoutMilliseconds: 10_000) },
            connect: { try await client.devices.connect(serialNumber: $0, device: $1) },
            readStatus: { try await client.devices.readStatus() },
            updates: { await client.devices.connectionUpdates() },
            cancel: { try await client.devices.cancelCurrentOperation() },
            disconnect: { try await client.devices.disconnect() },
            destroy: { await client.destroy() }
        )
    }
}

@MainActor
final class ConnectModel: ObservableObject {
    @Published private(set) var devices: [DiscoveredDevice] = []
    @Published private(set) var connected: ConnectedDevice?
    @Published private(set) var status: DeviceStatus?
    @Published private(set) var ready = false
    @Published private(set) var busy = false
    @Published private(set) var message = "Initializing Bluetooth…"

    private let actions: DeviceActions
    private var desiredActive = false
    private var generation = 0
    private var connectionGeneration = 0
    private var initialized = false
    private var cleanupFailed = false
    private var lifecycle: Task<Void, Never>?
    private var operation: Task<Void, Never>?
    private var observer: Task<Void, Never>?

    init(actions: DeviceActions = .live()) { self.actions = actions }

    // Foreground transitions wait for configure/actions/destruction to join.
    func setActive(_ active: Bool) {
        guard desiredActive != active else { return }
        desiredActive = active
        generation += 1
        let current = generation
        ready = false
        clearConnection()
        devices = []
        operation?.cancel()
        observer?.cancel()
        let previous = lifecycle
        lifecycle = Task { @MainActor in
            await previous?.value
            await stop()
            guard desiredActive, generation == current, !cleanupFailed else { return }
            initialized = true
            do {
                try await actions.configure()
                guard desiredActive, generation == current else { return }
                ready = true
                message = "Enter the exact device serial, then scan."
                observer = Task { @MainActor in
                    let updates = await actions.updates()
                    for await device in updates {
                        guard !Task.isCancelled, generation == current, ready else { break }
                        let wasConnected = connected != nil
                        acceptConnection(device)
                        if wasConnected && device == nil { message = "Disconnected. Scan to connect again." }
                    }
                    if !Task.isCancelled, generation == current, ready {
                        ready = false
                        operation?.cancel()
                        clearConnection()
                        message = "Connection observation ended. Reopen the app before connecting again."
                    }
                }
            } catch {
                guard generation == current else { return }
                message = "Bluetooth initialization failed. Check Bluetooth permission in Settings, then reopen the app."
            }
        }
    }

    func scan() {
        guard connected == nil else { return }
        run {
            self.devices = []
            let current = self.generation
            for try await device in try await self.actions.scan() {
                try Task.checkCancellation()
                guard self.generation == current, self.ready else { return }
                self.devices.removeAll { $0.id == device.id }
                self.devices.append(device)
            }
            try Task.checkCancellation()
            guard self.ready else { return }
            self.message = "Select a device after entering its exact serial."
        }
    }

    func connect(_ device: DiscoveredDevice, serial: String) {
        let expected = serial.trimmingCharacters(in: .whitespacesAndNewlines)
        guard connected == nil, !expected.isEmpty else { return }
        run {
            let connection = self.connectionGeneration
            let device = try await self.actions.connect(expected, device)
            try Task.checkCancellation()
            guard self.ready else { return }
            guard self.connectionGeneration == connection || self.connected?.id == device.id else { return }
            self.acceptConnection(device)
            self.message = "Verified serial: \(device.serialNumber)"
        }
    }

    func readStatus() {
        guard let connected else { return }
        let current = connectionGeneration
        run {
            self.status = nil
            let status = try await self.actions.readStatus()
            try Task.checkCancellation()
            guard self.ready, self.connectionGeneration == current, self.connected?.id == connected.id else { return }
            self.status = status
            self.message = "Status refreshed."
        }
    }

    func disconnect() {
        guard connected != nil, ready, !busy else { return }
        clearConnection()
        run {
            do {
                try await self.actions.disconnect()
                try Task.checkCancellation()
                self.clearConnection()
                self.message = "Disconnected."
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                self.clearConnection()
                self.cleanupFailed = true
                self.ready = false
                self.message = "Disconnect failed. Close the app before another connection."
                throw error
            }
        }
    }

    private func run(_ action: @escaping @MainActor () async throws -> Void) {
        guard ready, !busy, !cleanupFailed else { return }
        busy = true
        let current = generation
        operation = Task { @MainActor in
            defer { busy = false }
            do { try await action() }
            catch is CancellationError { }
            catch {
                guard generation == current, !cleanupFailed else { return }
                status = nil
                message = "Operation failed. Check the exact serial, Bluetooth permission and device availability."
            }
        }
    }

    private func acceptConnection(_ device: ConnectedDevice?) {
        if connected?.id != device?.id || connected?.serialNumber != device?.serialNumber {
            connectionGeneration += 1
            status = nil
        }
        connected = device
    }

    private func clearConnection() {
        connectionGeneration += 1
        connected = nil
        status = nil
    }

    private func stop() async {
        guard initialized else { return }
        operation?.cancel()
        observer?.cancel()
        do { try await actions.cancel() }
        catch { cleanupFailed = true }
        await operation?.value
        await observer?.value
        do { try await actions.disconnect() }
        catch { cleanupFailed = true }
        await actions.destroy()
        operation = nil
        observer = nil
        initialized = false
        busy = false
        clearConnection()
        message = cleanupFailed
            ? "Bluetooth cleanup failed. Close the app before another connection."
            : "Bluetooth session ended while the app was inactive."
    }

    // These joins are also exercised by synthetic lifecycle tests.
    func waitForLifecycle() async { await lifecycle?.value }
    func waitForOperation() async { await operation?.value }
}
