import BotaAppSDK
import Foundation
import XCTest
@testable import BotaCatalog

@MainActor
final class CatalogModelTests: XCTestCase {
    func testExactSerialAndFreshPairingGateEveryMetadataRead() async {
        let sdk = SyntheticCatalog()
        let model = await start(sdk)
        model.connect(candidate, serial: "  ")
        XCTAssertFalse(model.busy)
        model.connect(candidate, serial: "  USER-SUPPLIED-SERIAL \n")
        await model.waitForOperation()
        XCTAssertEqual(model.connected?.serialNumber, "USER-SUPPLIED-SERIAL")
        let serials = await sdk.serials
        XCTAssertEqual(serials, ["USER-SUPPLIED-SERIAL"])

        await sdk.setPairing(.unpaired)
        model.refresh()
        await model.waitForOperation()
        XCTAssertFalse(model.paired)
        XCTAssertFalse(model.loaded)
        let rejectedEvents = await sdk.events
        XCTAssertFalse(rejectedEvents.contains("catalog"))

        await sdk.setPairing(.paired)
        model.refresh()
        await model.waitForOperation()
        XCTAssertTrue(model.loaded)
        XCTAssertEqual(model.records, syntheticRecords)
        await sdk.setPairing(.unknown(255))
        model.refresh()
        await model.waitForOperation()
        XCTAssertFalse(model.loaded)
        XCTAssertFalse(model.paired)
        XCTAssertTrue(model.records.isEmpty)
        let events = await sdk.events
        XCTAssertEqual(events.filter { $0 == "pairing" }.count, 3)
        XCTAssertEqual(events.filter { $0 == "catalog" }.count, 1)
        await stop(model)
    }

    func testMismatchedReturnedIdentityNeverAdmitsCatalog() async {
        let sdk = SyntheticCatalog(returnedSerial: "OTHER-SERIAL")
        let model = await start(sdk)
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        await model.waitForOperation()
        await model.waitForLifecycle()
        model.refresh()
        let events = await sdk.events
        XCTAssertFalse(events.contains("pairing"))
        XCTAssertFalse(events.contains("catalog"))
        XCTAssertNil(model.connected)
        XCTAssertFalse(model.ready)
        XCTAssertFalse(model.loaded)
        XCTAssertEqual(events.last, "destroy")
    }

    func testLateCatalogAfterStatusFailureCannotRestoreAndNewSessionWaitsForDrain() async {
        let gate = AsyncGate()
        let sdk = SyntheticCatalog(catalogGate: gate)
        let model = await connect(sdk)
        model.refresh()
        await gate.waitUntilEntered()
        await sdk.failStatus()
        await waitUntil { !model.ready }
        XCTAssertFalse(model.loaded)
        XCTAssertTrue(model.records.isEmpty)
        model.setActive(true)
        let before = await sdk.events
        XCTAssertEqual(before.filter { $0 == "configure" }.count, 1)
        await gate.release()
        await model.waitForLifecycle()
        let events = await sdk.events
        XCTAssertEqual(events.filter { $0 == "configure" }.count, 2)
        XCTAssertLessThan(events.firstIndex(of: "destroy")!, events.lastIndex(of: "configure")!)
        XCTAssertTrue(model.records.isEmpty)
        XCTAssertNil(model.connected)
        XCTAssertFalse(model.loaded)
        await stop(model)
    }

    func testLatePairingAfterExplicitDisconnectDoesNotReadCatalog() async {
        let gate = AsyncGate()
        let sdk = SyntheticCatalog(pairingGate: gate)
        let model = await connect(sdk)
        model.refresh()
        await gate.waitUntilEntered()
        model.disconnect()
        XCTAssertNil(model.connected)
        XCTAssertFalse(model.paired)
        await gate.release()
        await model.waitForLifecycle()
        let events = await sdk.events
        XCTAssertFalse(events.contains("catalog"))
        XCTAssertTrue(model.records.isEmpty)
    }

    func testEndedConnectionObservationRefusesRetainedCandidateAndClearsCatalog() async {
        let sdk = SyntheticCatalog()
        let model = await connect(sdk)
        model.refresh()
        await model.waitForOperation()
        XCTAssertTrue(model.loaded)
        await sdk.finishConnections()
        await waitUntil { !model.ready }
        await model.waitForLifecycle()
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        model.scan()
        let serials = await sdk.serials
        XCTAssertEqual(serials.count, 1)
        XCTAssertTrue(model.records.isEmpty)
        XCTAssertTrue(model.candidates.isEmpty)
        XCTAssertNil(model.connected)
    }

    func testNilConnectionFencesPendingConnectBeforeIdentityResult() async {
        let gate = AsyncGate()
        let sdk = SyntheticCatalog(connectGate: gate)
        let model = await start(sdk)
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        await gate.waitUntilEntered()
        await sdk.emitConnection(nil)
        await waitUntil { !model.ready }
        await gate.release()
        await model.waitForLifecycle()
        let events = await sdk.events
        XCTAssertFalse(events.contains("status"))
        XCTAssertNil(model.connected)
        XCTAssertFalse(model.loaded)
    }

    func testDelayedConfigureAndDestroyJoinBeforeForegroundReplacement() async {
        let configure = AsyncGate()
        let destroy = AsyncGate()
        let sdk = SyntheticCatalog(configureGate: configure, destroyGate: destroy)
        let model = CatalogModel(actions: sdk.actions)
        model.setActive(true)
        await configure.waitUntilEntered()
        model.setActive(false)
        model.setActive(true)
        await configure.release()
        await destroy.waitUntilEntered()
        let before = await sdk.events
        XCTAssertEqual(before.filter { $0 == "configure" }.count, 1)
        XCTAssertFalse(model.ready)
        await destroy.release()
        await model.waitForLifecycle()
        let events = await sdk.events
        XCTAssertEqual(events.filter { $0 == "configure" }.count, 2)
        XCTAssertTrue(model.ready)
        await stop(model)
    }

    func testCleanupFailureBlocksAnotherSDKOwner() async {
        let sdk = SyntheticCatalog(failDisconnect: true)
        let model = await connect(sdk)
        model.disconnect()
        await model.waitForLifecycle()
        model.setActive(true)
        await model.waitForLifecycle()
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        let events = await sdk.events
        XCTAssertEqual(events.filter { $0 == "configure" }.count, 1)
        XCTAssertTrue(model.cleanupFailed)
        XCTAssertFalse(model.ready)
        XCTAssertTrue(model.message.contains("cleanup failed"))
    }

    func testStatusSetupFailureAndPairingErrorKeepMetadataUnavailable() async {
        let failed = SyntheticCatalog(failStatus: true)
        let first = await connect(failed)
        await first.waitForLifecycle()
        XCTAssertNil(first.connected)
        XCTAssertFalse(first.loaded)
        let sdk = SyntheticCatalog(failPairing: true)
        let model = await connect(sdk)
        model.refresh()
        await model.waitForOperation()
        let events = await sdk.events
        XCTAssertFalse(events.contains("catalog"))
        XCTAssertTrue(model.records.isEmpty)
        XCTAssertFalse(model.paired)
        await stop(model)
    }

    func testInitializationFailureCannotAdmitDeviceActions() async {
        let sdk = SyntheticCatalog(failConfigure: true)
        let model = await start(sdk)
        model.scan()
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        model.refresh()
        let events = await sdk.events
        XCTAssertFalse(model.ready)
        XCTAssertFalse(model.busy)
        XCTAssertFalse(events.contains("scan"))
        XCTAssertFalse(events.contains("pairing"))
        XCTAssertEqual(events.last, "destroy")
        let serials = await sdk.serials
        XCTAssertTrue(serials.isEmpty)
    }

    private var candidate: DiscoveredDevice { .init(id: "synthetic-peripheral", rssi: -50) }
    private func start(_ sdk: SyntheticCatalog) async -> CatalogModel {
        let model = CatalogModel(actions: sdk.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        return model
    }
    private func connect(_ sdk: SyntheticCatalog) async -> CatalogModel {
        let model = await start(sdk)
        model.connect(candidate, serial: "USER-SUPPLIED-SERIAL")
        await model.waitForOperation()
        return model
    }
    private func stop(_ model: CatalogModel) async {
        model.setActive(false)
        await model.waitForLifecycle()
    }
    private func waitUntil(_ condition: () -> Bool) async {
        for _ in 0..<1_000 {
            if condition() { return }
            await Task.yield()
        }
        XCTFail("Expected a queued synthetic SDK observation")
    }
}

private let syntheticRecords: [PendingRecording] = [
    .legacy(.init(uuid: "synthetic-legacy", startedAt: Date(timeIntervalSince1970: 0), durationMs: 1_000, fileSizeBytes: 100, codec: .known(.opus16k), isEncrypted: true)),
    .encryptedV2(.init(uuid: "d4e55c12-96cb-4f08-a60c-d16bd81bf648", generation: 1, ciphertextLength: 120, ciphertextSHA256: Data(repeating: 0, count: 32), plaintextLength: 100)),
]

private actor AsyncGate {
    private var open = false
    private var entered = false
    private var waiter: CheckedContinuation<Void, Never>?
    private var enteredWaiter: CheckedContinuation<Void, Never>?
    func pause() async {
        entered = true
        enteredWaiter?.resume()
        enteredWaiter = nil
        if !open { await withCheckedContinuation { waiter = $0 } }
    }
    func waitUntilEntered() async {
        if !entered { await withCheckedContinuation { enteredWaiter = $0 } }
    }
    func release() { open = true; waiter?.resume(); waiter = nil }
}

private actor SyntheticCatalog {
    var events: [String] = []
    var serials: [String] = []
    private var pairingState: PairingState = .paired
    private let returnedSerial: String?
    private let configureFails: Bool
    private let failDisconnect: Bool
    private let statusSetupFails: Bool
    private let failPairing: Bool
    private let configureGate: AsyncGate?
    private let connectGate: AsyncGate?
    private let catalogGate: AsyncGate?
    private let pairingGate: AsyncGate?
    private let destroyGate: AsyncGate?
    private var connection: AsyncStream<ConnectedDevice?>.Continuation?
    private var status: AsyncThrowingStream<DeviceStatus, Error>.Continuation?

    init(returnedSerial: String? = nil, failConfigure: Bool = false, failDisconnect: Bool = false, failStatus: Bool = false, failPairing: Bool = false, configureGate: AsyncGate? = nil, connectGate: AsyncGate? = nil, catalogGate: AsyncGate? = nil, pairingGate: AsyncGate? = nil, destroyGate: AsyncGate? = nil) {
        self.returnedSerial = returnedSerial
        self.configureFails = failConfigure
        self.failDisconnect = failDisconnect
        self.statusSetupFails = failStatus
        self.failPairing = failPairing
        self.configureGate = configureGate
        self.connectGate = connectGate
        self.catalogGate = catalogGate
        self.pairingGate = pairingGate
        self.destroyGate = destroyGate
    }
    nonisolated var actions: CatalogActions {
        CatalogActions(
            configure: { try await self.configure() },
            scan: { await self.scan() },
            connect: { await self.connect($0, $1) },
            connections: { await self.connections() },
            status: { try await self.statuses() },
            pairing: { _ in try await self.pairing() },
            catalog: { _ in await self.catalog() },
            cancel: { await self.record("cancel") },
            disconnect: { try await self.disconnect() },
            destroy: { await self.destroy() }
        )
    }
    func configure() async throws {
        events.append("configure")
        await configureGate?.pause()
        if configureFails { throw NSError(domain: "synthetic-configuration", code: 1) }
    }
    func scan() -> AsyncThrowingStream<DiscoveredDevice, Error> {
        events.append("scan")
        return AsyncThrowingStream { $0.finish() }
    }
    func connect(_ serial: String, _ device: DiscoveredDevice) async -> ConnectedDevice {
        serials.append(serial)
        await connectGate?.pause()
        return .init(id: device.id, serialNumber: returnedSerial ?? serial, deviceType: .unknown(0), firmwareVersion: "synthetic", isProvisioned: false, connectionState: .connected, mtu: 23)
    }
    func connections() -> AsyncStream<ConnectedDevice?> {
        let pair = AsyncStream<ConnectedDevice?>.makeStream()
        connection = pair.continuation
        pair.continuation.yield(nil)
        return pair.stream
    }
    func statuses() throws -> AsyncThrowingStream<DeviceStatus, Error> {
        events.append("status")
        if statusSetupFails { throw NSError(domain: "synthetic-status", code: 1) }
        let pair = AsyncThrowingStream<DeviceStatus, Error>.makeStream()
        status = pair.continuation
        return pair.stream
    }
    func pairing() async throws -> PairingState {
        events.append("pairing")
        await pairingGate?.pause()
        if failPairing { throw NSError(domain: "synthetic-pairing", code: 1) }
        return pairingState
    }
    func catalog() async -> [PendingRecording] {
        events.append("catalog")
        await catalogGate?.pause()
        return syntheticRecords
    }
    func setPairing(_ value: PairingState) { pairingState = value }
    func failStatus() { status?.finish(throwing: NSError(domain: "synthetic-stream-failure", code: 1)) }
    func finishConnections() { connection?.finish() }
    func emitConnection(_ device: ConnectedDevice?) { connection?.yield(device) }
    func record(_ event: String) { events.append(event) }
    func disconnect() throws {
        events.append("disconnect")
        if failDisconnect { throw NSError(domain: "synthetic-disconnect", code: 1) }
    }
    func destroy() async {
        events.append("destroy")
        await destroyGate?.pause()
        connection?.finish()
        status?.finish()
        connection = nil
        status = nil
    }
}
