import BotaAppSDK
import Foundation
import XCTest
@testable import BotaConnect

@MainActor
final class ConnectModelTests: XCTestCase {
    func testEmptySerialRefusesAndExactTrimmedSerialReachesSDK() async {
        let device = SyntheticDevice()
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        await device.waitForObserver()
        model.connect(candidate, serial: "   ")
        let emptyCalls = await device.serials
        XCTAssertTrue(emptyCalls.isEmpty)
        model.connect(candidate, serial: "  CUSTOMER-SUPPLIED-SERIAL \n")
        await model.waitForOperation()
        let serials = await device.serials
        XCTAssertEqual(serials, ["CUSTOMER-SUPPLIED-SERIAL"])
        XCTAssertEqual(model.connected?.serialNumber, "CUSTOMER-SUPPLIED-SERIAL")
        model.setActive(false)
        await model.waitForLifecycle()
    }

    func testInitializationDenialCannotAdmitScan() async {
        let device = SyntheticDevice(failConfigure: true)
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        model.scan()
        let events = await device.events
        XCTAssertFalse(model.ready)
        XCTAssertFalse(events.contains("scan"))
        XCTAssertTrue(model.message.contains("permission"))
        model.setActive(false)
        await model.waitForLifecycle()
        let stoppedEvents = await device.events
        XCTAssertEqual(stoppedEvents.last, "destroy")
    }

    func testLateStatusCannotRestoreContentAfterObservedLoss() async {
        let gate = AsyncGate()
        let device = SyntheticDevice(statusGate: gate)
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        await device.waitForObserver()
        model.connect(candidate, serial: "CUSTOMER-SUPPLIED-SERIAL")
        await model.waitForOperation()
        model.readStatus()
        await gate.waitUntilEntered()
        await device.emit(nil)
        await waitUntil { model.connected == nil }
        await gate.release()
        await model.waitForOperation()
        XCTAssertNil(model.status)
        XCTAssertNil(model.connected)
        model.setActive(false)
        await model.waitForLifecycle()
    }

    func testForegroundWaitsForPreviousDestruction() async {
        let gate = AsyncGate()
        let device = SyntheticDevice(destroyGate: gate)
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        await device.waitForObserver()
        model.setActive(false)
        await gate.waitUntilEntered()
        model.setActive(true)
        let before = await device.events.filter { $0 == "configure" }.count
        XCTAssertEqual(before, 1)
        XCTAssertFalse(model.ready)
        await gate.release()
        await model.waitForLifecycle()
        let events = await device.events
        XCTAssertEqual(events.filter { $0 == "configure" }.count, 2)
        XCTAssertLessThan(events.firstIndex(of: "destroy")!, events.lastIndex(of: "configure")!)
        model.setActive(false)
        await model.waitForLifecycle()
    }

    func testObservationEndRetiresLateStatusAndFurtherAdmission() async {
        let gate = AsyncGate()
        let device = SyntheticDevice(statusGate: gate)
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        await device.waitForObserver()
        model.connect(candidate, serial: "CUSTOMER-SUPPLIED-SERIAL")
        await model.waitForOperation()
        model.readStatus()
        await gate.waitUntilEntered()
        await device.finishObservation()
        await waitUntil { !model.ready }
        await gate.release()
        await model.waitForOperation()
        XCTAssertNil(model.connected)
        XCTAssertNil(model.status)
        model.scan()
        let events = await device.events
        XCTAssertFalse(events.contains("scan"))
        model.setActive(false)
        await model.waitForLifecycle()
    }

    func testFailedDisconnectBlocksReplacementAfterForeground() async {
        let device = SyntheticDevice(failDisconnect: true)
        let model = ConnectModel(actions: device.actions)
        model.setActive(true)
        await model.waitForLifecycle()
        await device.waitForObserver()
        model.connect(candidate, serial: "CUSTOMER-SUPPLIED-SERIAL")
        await model.waitForOperation()
        model.disconnect()
        await model.waitForOperation()
        XCTAssertNil(model.connected)
        XCTAssertFalse(model.ready)
        model.setActive(false)
        await model.waitForLifecycle()
        model.setActive(true)
        await model.waitForLifecycle()
        let events = await device.events
        XCTAssertEqual(events.filter { $0 == "configure" }.count, 1)
        XCTAssertFalse(model.ready)
        XCTAssertTrue(model.message.contains("cleanup failed"))
    }

    private var candidate: DiscoveredDevice { .init(id: "synthetic-peripheral", rssi: -50) }

    private func waitUntil(_ condition: () -> Bool) async {
        for _ in 0..<1_000 {
            if condition() { return }
            await Task.yield()
        }
        XCTFail("Expected a queued synthetic connection update")
    }
}

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

private actor SyntheticDevice {
    var events: [String] = []
    var serials: [String] = []
    private let failConfigure: Bool
    private let failDisconnect: Bool
    private let statusGate: AsyncGate?
    private let destroyGate: AsyncGate?
    private var observer: AsyncStream<ConnectedDevice?>.Continuation?
    private var observerWaiter: CheckedContinuation<Void, Never>?

    init(failConfigure: Bool = false, failDisconnect: Bool = false, statusGate: AsyncGate? = nil, destroyGate: AsyncGate? = nil) {
        self.failConfigure = failConfigure
        self.failDisconnect = failDisconnect
        self.statusGate = statusGate
        self.destroyGate = destroyGate
    }

    nonisolated var actions: DeviceActions {
        DeviceActions(
            configure: { try await self.configure() },
            scan: { await self.scan() },
            connect: { await self.connect($0, $1) },
            readStatus: { await self.readStatus() },
            updates: { await self.updates() },
            cancel: { await self.record("cancel") },
            disconnect: { try await self.disconnect() },
            destroy: { await self.destroy() }
        )
    }

    func configure() throws {
        events.append("configure")
        if failConfigure { throw NSError(domain: "synthetic-permission-denied", code: 1) }
    }
    func scan() -> AsyncThrowingStream<DiscoveredDevice, Error> {
        events.append("scan")
        return AsyncThrowingStream { $0.finish() }
    }
    func connect(_ serial: String, _ device: DiscoveredDevice) -> ConnectedDevice {
        serials.append(serial)
        return .init(id: device.id, serialNumber: serial, deviceType: .unknown(0), firmwareVersion: "synthetic", isProvisioned: false, connectionState: .connected, mtu: 23)
    }
    func readStatus() async -> DeviceStatus {
        await statusGate?.pause()
        return .init(batteryLevel: 80, storageTotalMb: 1, storageUsedMb: 0, state: .known(.idle), pendingRecordings: 0, lastTimeSyncAt: nil, flags: .init(charging: false, lowBattery: false, storageFull: false, wifiConnected: false, lteConnected: false, syncActive: false), timestamp: 0, lteStatus: .unknown(0))
    }
    func updates() -> AsyncStream<ConnectedDevice?> {
        let pair = AsyncStream<ConnectedDevice?>.makeStream()
        observer = pair.continuation
        observerWaiter?.resume()
        observerWaiter = nil
        return pair.stream
    }
    func waitForObserver() async {
        if observer == nil { await withCheckedContinuation { observerWaiter = $0 } }
    }
    func emit(_ device: ConnectedDevice?) { observer?.yield(device) }
    func finishObservation() { observer?.finish() }
    func record(_ value: String) { events.append(value) }
    func disconnect() throws {
        events.append("disconnect")
        if failDisconnect { throw NSError(domain: "synthetic-disconnect-failure", code: 1) }
    }
    func destroy() async {
        events.append("destroy")
        await destroyGate?.pause()
        observer?.finish()
        observer = nil
    }
}
