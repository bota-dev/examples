import Foundation
import XCTest
@testable import BotaRecordings

@MainActor final class TransportTests: XCTestCase {
    private let token = String(repeating: "application-token-", count: 3)
    private let list = #"{"data":[],"has_more":false,"next_cursor":null}"#
    private func failure<T>(_ expected: LibraryFailure, _ action: () async throws -> T) async {
        transportTrace("expected-failure.read.begin")
        do { _ = try await action(); XCTFail("Expected controlled failure") }
        catch { XCTAssertEqual(error as? LibraryFailure, expected) }
        transportTrace("expected-failure.read.end")
    }
    private func close(_ api: LibraryAPI) async throws {
        transportTrace("api.close.begin")
        try await api.close()
        transportTrace("api.close.end")
    }
    func testIdleLoopbackListenerStopsWithoutWaitingForAConnection() throws {
        transportTrace("idle-listener.begin")
        let server = try LoopbackServer { _ in XCTFail("Unexpected request"); return .init() }
        server.stop()
        server.stop() // Idempotent without reusing or closing an unrelated descriptor.
        XCTAssertTrue(server.requests.isEmpty)
        transportTrace("idle-listener.end")
    }
    func testActualGETHeadersAndNoCookieReplay() async throws {
        transportTrace("headers-cookie.begin")
        let body = Data(list.utf8)
        let server = try LoopbackServer { _ in .init(headers: ["Content-Type": "application/json; charset=utf-8", "Set-Cookie": "session=secret; Path=/"], body: body) }
        defer { server.stop() }
        let api = try LibraryAPI.live(origin: server.origin, token: token)
        transportTrace("api.list.first.begin")
        _ = try await api.list()
        transportTrace("api.list.first.end")
        transportTrace("api.list.second.begin")
        _ = try await api.list()
        transportTrace("api.list.second.end")
        try await close(api)
        XCTAssertEqual(server.requests.count, 2)
        for request in server.requests {
            XCTAssertTrue(request.hasPrefix("GET /api/library/recordings HTTP/1.1\r\n"))
            let lower = request.lowercased()
            XCTAssertTrue(lower.contains("authorization: bearer \(token)"))
            XCTAssertTrue(lower.contains("accept: application/json"))
            XCTAssertTrue(lower.contains("accept-encoding: identity"))
            XCTAssertTrue(lower.contains("cache-control: no-store"))
            XCTAssertFalse(lower.contains("\r\ncookie:"))
        }
        await failure(.unauthorized) { try await api.list() }
        transportTrace("headers-cookie.end")
    }
    func testRedirectDoesNotForwardTokenOrReachSecondPeer() async throws {
        transportTrace("redirect.begin")
        let destination = try LoopbackServer { _ in .init() }
        let location = destination.origin + "/stolen"
        defer { destination.stop() }
        for status in [301, 302, 303, 307, 308] {
            transportTrace("redirect.case.\(status)")
            let server = try LoopbackServer { _ in .init(status: status, headers: ["Location": location], body: Data()) }
            defer { server.stop() }
            let api = try LibraryAPI.live(origin: server.origin, token: token)
            await failure(.unavailable) { try await api.list() }
            try await close(api)
            XCTAssertEqual(server.requests.count, 1)
        }
        XCTAssertTrue(destination.requests.isEmpty)
        transportTrace("redirect.end")
    }
    func testStatusMIMEEncodingAndJSONFailuresStayControlled() async throws {
        transportTrace("status-json.begin")
        let responses: [LoopbackServer.Response] = [
            .init(status: 401, body: Data("private error".utf8)),
            .init(status: 500, body: Data("private error".utf8)),
            .init(headers: ["Content-Type": "text/html"], body: Data("<html/>".utf8)),
            .init(headers: ["Content-Type": "application/json", "Content-Encoding": "gzip"]),
            .init(body: Data("not-json".utf8)),
            .init(body: Data([0xff, 0xfe])),
            .init(headers: ["Content-Type": "; application/json"]),
        ]
        for (index, response) in responses.enumerated() {
            transportTrace("status-json.case.\(index)")
            let server = try LoopbackServer { _ in response }
            defer { server.stop() }
            let api = try LibraryAPI.live(origin: server.origin, token: token)
            let expected: LibraryFailure = index == 0 ? .unauthorized : index == 1 ? .unavailable : .invalidResponse
            await failure(expected) { try await api.list() }
            try await close(api); server.stop()
        }
        transportTrace("status-json.end")
    }
    func testDeclaredAndStreamingByteLimits() async throws {
        transportTrace("byte-limit.begin")
        let responses: [LoopbackServer.Response] = [
            .init(headers: ["Content-Type": "application/json", "Content-Length": String(JSONTransport.maximumBytes + 1)]),
            .init(body: Data(repeating: 32, count: JSONTransport.maximumBytes + 1), omitLength: true),
        ]
        for (index, response) in responses.enumerated() {
            transportTrace("byte-limit.case.\(index)")
            let server = try LoopbackServer { _ in response }
            defer { server.stop() }
            let api = try LibraryAPI.live(origin: server.origin, token: token)
            await failure(.invalidResponse) { try await api.list() }
            try await close(api); server.stop()
        }
        transportTrace("byte-limit.end")
    }
    func testForeignDetailAndJoinedContentSourcesAreRejected() async throws {
        transportTrace("foreign-source.begin")
        let server = try LoopbackServer { request in
            if request.contains("/transcriptions/txn_one/summaries ") {
                return .init(body: Data(#"{"data":[{"id":"sum_one","transcription_id":"txn_foreign","recording_id":"rec_one","status":"pending","template_id":"tmpl_general_notes"}]}"#.utf8))
            }
            if request.contains("/transcriptions ") {
                return .init(body: Data(#"{"data":[{"id":"txn_one","recording_id":"rec_foreign","status":"pending"}]}"#.utf8))
            }
            return .init(body: Data(#"{"id":"rec_foreign","name":null,"status":"completed","created_at":"2026-01-15T09:30:00Z","duration_seconds":null,"upload_verified":true}"#.utf8))
        }
        defer { server.stop() }
        let api = try LibraryAPI.live(origin: server.origin, token: token)
        await failure(.invalidResponse) { try await api.detail("rec_one") }
        await failure(.invalidResponse) { try await api.transcripts("rec_one") }
        await failure(.invalidResponse) { try await api.summaries("txn_one", "rec_one") }
        let count = server.requests.count
        await failure(.invalidResponse) { try await api.detail("rec_../escape") }
        for suffix in ["\n", "\r\n", "\u{2028}", "\u{2029}"] {
            await failure(.invalidResponse) { try await api.detail("rec_one" + suffix) }
            await failure(.invalidResponse) { try await api.transcripts("rec_one" + suffix) }
            await failure(.invalidResponse) { try await api.summaries("txn_one" + suffix, "rec_one") }
            await failure(.invalidResponse) { try await api.summaries("txn_one", "rec_one" + suffix) }
        }
        XCTAssertEqual(server.requests.count, count)
        try await close(api)
        transportTrace("foreign-source.end")
    }
    func testCancellationBeforeHeadersJoinsTransport() async throws {
        transportTrace("cancellation.begin")
        let hold = DispatchSemaphore(value: 0)
        let server = try LoopbackServer { _ in .init(hold: hold) }
        defer { hold.signal(); server.stop() }
        let transport = JSONTransport(try BackendConfiguration(origin: server.origin, token: token))
        let read = Task { try await transport.get("/api/library/recordings") }
        let received = await server.waitForRequest(); XCTAssertTrue(received)
        transportTrace("cancellation.request.observed")
        read.cancel()
        transportTrace("cancellation.read.join.begin")
        do { _ = try await read.value; XCTFail("Cancelled read returned content") }
        catch { XCTAssertTrue(error is CancellationError) }
        transportTrace("cancellation.read.join.end")
        transportTrace("transport.close.begin")
        try await transport.close()
        transportTrace("transport.close.end")
        transportTrace("cancellation.end")
    }
    func testThirtySecondDeadlineCancelsAndJoinsStalledResponse() async throws {
        transportTrace("deadline.begin")
        let hold = DispatchSemaphore(value: 0)
        let server = try LoopbackServer { _ in .init(hold: hold, holdSeconds: 40) }
        defer { hold.signal(); server.stop() }
        let transport = JSONTransport(try BackendConfiguration(origin: server.origin, token: token))
        let started = DispatchTime.now().uptimeNanoseconds
        await failure(.network) { try await transport.get("/api/library/recordings") }
        let elapsed = Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000_000
        XCTAssertGreaterThan(elapsed, 25, "Fixture must remain stalled until the real production deadline")
        XCTAssertLessThan(elapsed, 40, "The deadline and actual finalizer must finish within the cleanup bound")
        try await transport.close()
        XCTAssertEqual(server.requests.count, 1)
        transportTrace("deadline.end")
    }
}
