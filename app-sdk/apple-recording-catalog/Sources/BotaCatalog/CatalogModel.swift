import BotaAppSDK
import Combine
import Foundation

// Concrete public calls stay together; synthetic tests replace only these ports.
// This sample never calls recording transfer, confirmation, control or provisioning.
struct CatalogActions: Sendable {
    var configure: @Sendable () async throws -> Void
    var scan: @Sendable () async throws -> AsyncThrowingStream<DiscoveredDevice, Error>
    var connect: @Sendable (String, DiscoveredDevice) async throws -> ConnectedDevice
    var connections: @Sendable () async -> AsyncStream<ConnectedDevice?>
    var status: @Sendable () async throws -> AsyncThrowingStream<DeviceStatus, Error>
    var pairing: @Sendable (ConnectedDevice) async throws -> PairingState
    var catalog: @Sendable (ConnectedDevice) async throws -> [PendingRecording]
    var cancel: @Sendable () async throws -> Void
    var disconnect: @Sendable () async throws -> Void
    var destroy: @Sendable () async -> Void

    static func live() -> Self {
        let client = BotaDeviceClient()
        return Self(
            configure: { try await client.configure() },
            scan: { try await client.devices.startScan(timeoutMilliseconds: 10_000) },
            connect: { try await client.devices.connect(serialNumber: $0, device: $1) },
            connections: { await client.devices.connectionUpdates() },
            status: { try await client.devices.statusUpdates() },
            pairing: { try await client.controls.readPairingState(from: $0) },
            catalog: { try await client.recordings.listPendingRecordings($0) },
            cancel: { try await client.devices.cancelCurrentOperation() },
            disconnect: { try await client.devices.disconnect() },
            destroy: { await client.destroy() }
        )
    }
}

private struct CatalogIdentityError: Error {}
private struct CatalogPairingError: Error {}

@MainActor
final class CatalogModel: ObservableObject {
    @Published private(set) var candidates: [DiscoveredDevice] = []
    @Published private(set) var connected: ConnectedDevice?
    @Published private(set) var records: [PendingRecording] = []
    @Published private(set) var loaded = false
    @Published private(set) var paired = false
    @Published private(set) var ready = false
    @Published private(set) var busy = false
    @Published private(set) var cleanupFailed = false
    @Published private(set) var message = "Initializing Bluetooth…"

    private let actions: CatalogActions
    private var desiredActive = false
    private var initialized = false
    private var generation = 0
    private var connectionRevision = 0
    private var admittingSerial: String?
    private var lifecycle: Task<Void, Never>?
    private var operation: Task<Void, Never>?
    private var connectionObserver: Task<Void, Never>?
    private var statusObserver: Task<Void, Never>?

    init(actions: CatalogActions = .live()) { self.actions = actions }

    func setActive(_ active: Bool) {
        guard desiredActive != active else { return }
        desiredActive = active
        generation += 1
        let current = generation
        ready = false
        busy = true
        clearConnection()
        operation?.cancel()
        connectionObserver?.cancel()
        statusObserver?.cancel()
        if !active { message = "Bluetooth session ended. Enable Bluetooth to begin again." }
        let previous = lifecycle
        lifecycle = Task { @MainActor in
            await previous?.value
            await stop()
            guard generation == current else { return }
            guard desiredActive, !cleanupFailed else { busy = false; return }
            initialized = true
            do {
                try await actions.configure()
                guard generation == current, desiredActive else { return }
                let stream = await actions.connections()
                guard generation == current, desiredActive else { return }
                observeConnections(stream, generation: current)
                ready = true
                busy = false
                message = "Enter the exact printed serial, then scan."
            } catch {
                await stop()
                guard generation == current else { return }
                desiredActive = false
                busy = false
                if !cleanupFailed {
                    message = "Bluetooth initialization failed. Check permission in Settings, then enable Bluetooth again."
                }
            }
        }
    }

    func scan() {
        guard connected == nil else { return }
        run {
            self.candidates = []
            for try await candidate in try await self.actions.scan() {
                try Task.checkCancellation()
                guard self.ready else { return }
                self.candidates.removeAll { $0.id == candidate.id }
                self.candidates.append(candidate)
            }
            try Task.checkCancellation()
            guard self.ready else { return }
            self.message = "Select a candidate. Advertised names do not prove identity."
        }
    }

    func connect(_ candidate: DiscoveredDevice, serial: String) {
        let expected = serial.trimmingCharacters(in: .whitespacesAndNewlines)
        guard connected == nil, !expected.isEmpty else { return }
        run {
            self.admittingSerial = expected
            do {
                let device = try await self.actions.connect(expected, candidate)
                try Task.checkCancellation()
                guard self.ready else { return }
                guard device.serialNumber == expected, device.id == candidate.id else {
                    throw CatalogIdentityError()
                }
                self.connected = device
                self.admittingSerial = nil
                self.clearCatalog()
                let revision = self.connectionRevision
                let statuses = try await self.actions.status()
                try Task.checkCancellation()
                guard self.owns(revision, device) else { return }
                self.observeStatus(statuses, revision: revision, device: device)
                self.message = "Identity verified. Refresh to read pairing and pending metadata."
            } catch {
                if !Task.isCancelled, self.ready {
                    self.retire("Connection or status observation failed. Enable Bluetooth to verify again.")
                }
                throw error
            }
        }
    }

    func refresh() {
        guard let device = connected else { return }
        let revision = connectionRevision
        run {
            self.clearCatalog()
            let state = try await self.actions.pairing(device)
            try Task.checkCancellation()
            guard self.owns(revision, device) else { return }
            guard state == .paired else { throw CatalogPairingError() }
            self.paired = true
            let snapshot = try await self.actions.catalog(device)
            try Task.checkCancellation()
            guard self.owns(revision, device) else { return }
            self.records = snapshot
            self.loaded = true
            self.message = "Pending metadata snapshot read. This does not establish cloud completion."
        }
    }

    func disconnect() {
        guard connected != nil || admittingSerial != nil else { return }
        retire("Disconnected. Catalog cleared; enable Bluetooth to begin again.")
    }

    private func observeConnections(_ stream: AsyncStream<ConnectedDevice?>, generation current: Int) {
        connectionObserver = Task { @MainActor in
            var initialSnapshot = true
            for await device in stream {
                guard !Task.isCancelled, generation == current, ready else { return }
                // The public stream yields its cached snapshot on subscription.
                if initialSnapshot {
                    initialSnapshot = false
                    if device == nil { continue }
                }
                if let device {
                    if let connected, connected.id != device.id || connected.serialNumber != device.serialNumber {
                        retire("Device connection changed. Catalog cleared; enable Bluetooth to verify again.")
                        return
                    }
                } else if connected != nil || admittingSerial != nil {
                    retire("Connection lost. Catalog cleared; enable Bluetooth to verify again.")
                    return
                }
            }
            if !Task.isCancelled, generation == current, ready {
                retire("Connection observation ended. Catalog cleared; enable Bluetooth to begin again.")
            }
        }
    }

    private func observeStatus(_ stream: AsyncThrowingStream<DeviceStatus, Error>, revision: Int, device: ConnectedDevice) {
        statusObserver = Task { @MainActor in
            do {
                for try await _ in stream {
                    guard owns(revision, device) else { return }
                }
            } catch { }
            guard owns(revision, device) else { return }
            retire("Device status observation ended or failed. Catalog cleared; enable Bluetooth to verify again.")
        }
    }

    private func owns(_ revision: Int, _ device: ConnectedDevice) -> Bool {
        !Task.isCancelled && ready && connectionRevision == revision &&
            connected?.id == device.id && connected?.serialNumber == device.serialNumber
    }

    private func run(_ action: @escaping @MainActor () async throws -> Void) {
        guard ready, !busy, !cleanupFailed else { return }
        busy = true
        let current = generation
        operation = Task { @MainActor in
            defer { if generation == current { busy = false } }
            do { try await action() }
            catch is CancellationError { }
            catch {
                guard generation == current, ready else { return }
                clearCatalog()
                message = "Read failed or pairing was not confirmed. Check serial, permission and device availability."
            }
        }
    }

    private func retire(_ reason: String) {
        setActive(false)
        message = reason
    }

    private func clearCatalog() { records = []; loaded = false; paired = false }
    private func clearConnection() {
        connectionRevision += 1
        admittingSerial = nil
        connected = nil
        candidates = []
        clearCatalog()
    }

    private func stop() async {
        guard initialized else { return }
        operation?.cancel()
        connectionObserver?.cancel()
        statusObserver?.cancel()
        do { try await actions.cancel() } catch { cleanupFailed = true }
        await operation?.value
        await statusObserver?.value
        await connectionObserver?.value
        do { try await actions.disconnect() } catch { cleanupFailed = true }
        await actions.destroy()
        operation = nil
        statusObserver = nil
        connectionObserver = nil
        initialized = false
        if cleanupFailed { message = "Bluetooth cleanup failed. Close the app before another device session." }
    }

    func waitForLifecycle() async { await lifecycle?.value }
    func waitForOperation() async { await operation?.value }
}
