import Foundation
import XCTest
@testable import BotaRecordings

private actor Gate<Value: Sendable> {
    private var continuation: CheckedContinuation<Value, Never>?
    private var observers: [CheckedContinuation<Void, Never>] = []
    private var started = false
    func read() async -> Value {
        started = true
        let observers = self.observers; self.observers = []
        for observer in observers { observer.resume() }
        return await withCheckedContinuation { continuation = $0 }
    }
    func waitForRead() async {
        if started { return }
        await withCheckedContinuation { observers.append($0) }
    }
    func finish(_ value: Value) { continuation?.resume(returning: value); continuation = nil }
}

@MainActor final class ModelTests: XCTestCase {
    func testSampleNeverConstructsLiveTransportAndShowsOrdinaryContent() async throws {
        let model = RecordingsModel(liveFactory: { _, _ in XCTFail("Sample constructed a live transport"); throw LibraryFailure.configuration })
        model.openSample(); await model.waitForReads()
        XCTAssertEqual(model.mode, .sample); XCTAssertEqual(model.recordings.count, 2)
        model.select("rec_sample_walk"); await model.waitForReads()
        XCTAssertEqual(model.detail?.id, "rec_sample_walk")
        XCTAssertTrue(model.transcript?.text?.contains("synthetic") == true)
        XCTAssertEqual(model.notes?.actionItems, ["Add three suggestions tonight."])
        model.select("rec_sample_plan"); await model.waitForReads()
        XCTAssertNil(model.transcript); XCTAssertNil(model.notes)
        model.retire(); await model.waitForRetirement()
        XCTAssertTrue(model.canOpen); XCTAssertTrue(model.recordings.isEmpty)
    }
    func testSelectionWaitsForOldReaderAndDiscardsItsLateContent() async throws {
        var api = try Sample.api()
        let detail = api.detail
        let gate = Gate<Recording>()
        api.detail = { id in
            if id == "rec_sample_walk" { return await gate.read() }
            return try await detail(id)
        }
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await gate.waitForRead()
        model.select("rec_sample_plan")
        XCTAssertNil(model.detail); XCTAssertNil(model.transcript); XCTAssertTrue(model.busy)
        await gate.finish(try await detail("rec_sample_walk"))
        await model.waitForReads()
        XCTAssertEqual(model.detail?.id, "rec_sample_plan"); XCTAssertNil(model.notes)
        model.retire(); await model.waitForRetirement()
    }
    func testSignOutClearsImmediatelyAndRefusesReplacementUntilJoin() async throws {
        var api = try Sample.api()
        let detail = api.detail
        let gate = Gate<Recording>()
        api.detail = { _ in await gate.read() }
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await gate.waitForRead()
        model.retire()
        XCTAssertNil(model.mode); XCTAssertTrue(model.recordings.isEmpty); XCTAssertNil(model.detail)
        XCTAssertTrue(model.retiring); XCTAssertFalse(model.canOpen)
        model.openSample(); XCTAssertNil(model.mode)
        await gate.finish(try await detail("rec_sample_walk")); await model.waitForRetirement()
        XCTAssertNil(model.detail); XCTAssertNil(model.transcript); XCTAssertTrue(model.canOpen)
        model.openSample(); await model.waitForReads(); XCTAssertEqual(model.mode, .sample)
        model.retire(); await model.waitForRetirement()
    }
    func testUnauthorizedExpiresAndCleanupFailureBlocksNextSession() async throws {
        var api = try Sample.api(); api.list = { throw LibraryFailure.unauthorized }
        let unauthorized = api
        let model = RecordingsModel(liveFactory: { _, _ in unauthorized })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads(); await model.waitForRetirement()
        XCTAssertNil(model.mode); XCTAssertEqual(model.message, LibraryFailure.unauthorized.message)
        api = try Sample.api(); api.close = { throw LibraryFailure.cleanup }
        let failing = api
        let blocked = RecordingsModel(liveFactory: { _, _ in failing })
        blocked.openLive(origin: "unused", token: "unused"); await blocked.waitForReads()
        blocked.retire(); await blocked.waitForRetirement()
        XCTAssertTrue(blocked.cleanupBlocked); XCTAssertFalse(blocked.canOpen)
        blocked.openSample(); XCTAssertNil(blocked.mode)
    }
    func testStaleReadCleanupFailureStillClosesAdmission() async throws {
        var api = try Sample.api()
        let gate = Gate<Result<Recording, LibraryFailure>>()
        api.detail = { _ in let result = await gate.read(); return try result.get() }
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await gate.waitForRead()
        model.select("rec_sample_plan")
        await gate.finish(.failure(.cleanup))
        await model.waitForReads(); await model.waitForRetirement()
        XCTAssertTrue(model.cleanupBlocked); XCTAssertNil(model.mode); XCTAssertFalse(model.canOpen)
    }
    func testLate401RetiresItsTokenSessionBeforeQueuedSelection() async throws {
        var api = try Sample.api()
        let gate = Gate<Result<Recording, LibraryFailure>>()
        api.detail = { id in
            guard id == "rec_sample_walk" else { XCTFail("Expired session admitted another read"); throw LibraryFailure.invalidResponse }
            let result = await gate.read(); return try result.get()
        }
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await gate.waitForRead()
        model.select("rec_sample_plan")
        await gate.finish(.failure(.unauthorized))
        await model.waitForReads(); await model.waitForRetirement()
        XCTAssertNil(model.mode); XCTAssertNil(model.detail); XCTAssertEqual(model.message, LibraryFailure.unauthorized.message)
    }
    func testRetirementStartsRevocationBeforeBlockedReaderJoins() async throws {
        var api = try Sample.api()
        let detail = api.detail
        let reader = Gate<Recording>(), close = Gate<Void>()
        api.detail = { _ in await reader.read() }
        api.close = { await close.read() }
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await reader.waitForRead()
        model.retire()
        await close.waitForRead() // Close is admitted even though the cancelled reader has not returned.
        XCTAssertTrue(model.retiring); XCTAssertFalse(model.canOpen); XCTAssertNil(model.detail)
        await reader.finish(try await detail("rec_sample_walk"))
        await close.finish(())
        await model.waitForRetirement()
        XCTAssertTrue(model.canOpen); XCTAssertNil(model.detail)
    }
    func testRetiringReaderCleanupFailureIsStickyEvenWhenCloseSucceeds() async throws {
        var api = try Sample.api()
        let reader = Gate<Result<Recording, LibraryFailure>>()
        api.detail = { _ in let result = await reader.read(); return try result.get() }
        api.close = {}
        let live = api
        let model = RecordingsModel(liveFactory: { _, _ in live })
        model.openLive(origin: "unused", token: "unused"); await model.waitForReads()
        model.select("rec_sample_walk"); await reader.waitForRead()
        model.retire()
        await reader.finish(.failure(.cleanup))
        await model.waitForRetirement()
        XCTAssertTrue(model.cleanupBlocked); XCTAssertFalse(model.canOpen)
        XCTAssertEqual(model.message, LibraryFailure.cleanup.message)
        model.openSample(); XCTAssertNil(model.mode)
    }
}
