import Foundation

struct BackendConfiguration: Sendable {
    let origin: URL
    let token: String
    init(origin input: String, token inputToken: String) throws {
        let input = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let token = inputToken
        guard input.utf16.count <= 2048, !input.contains("\\"),
              !input.unicodeScalars.contains(where: { $0.value <= 32 || $0.value == 127 }),
              var c = URLComponents(string: input), let host = c.host?.lowercased(), !host.isEmpty,
              c.user == nil, c.password == nil, c.query == nil, c.fragment == nil,
              c.percentEncodedPath.isEmpty || c.percentEncodedPath == "/",
              c.port == nil || (1...65535).contains(c.port!),
              c.scheme?.lowercased() == "https" || (c.scheme?.lowercased() == "http" && ["127.0.0.1", "localhost", "::1", "[::1]"].contains(host)),
              (32...256).contains(token.utf8.count), token.unicodeScalars.allSatisfy({ (33...126).contains($0.value) }),
              !["sk_", "rk_", "dtok_", "up_", "rct_"].contains(where: token.hasPrefix)
        else { throw LibraryFailure.configuration }
        c.scheme = c.scheme?.lowercased()
        c.path = ""
        guard let origin = c.url else { throw LibraryFailure.configuration }
        self.origin = origin
        self.token = token
    }
}

// The delegate refuses redirects before any credentials can follow them.
private final class SessionDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private var invalidated: Bool?
    private var waiters: [CheckedContinuation<Bool, Never>] = []
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, didBecomeInvalidWithError error: (any Error)?) {
        lock.lock()
        invalidated = error == nil
        let continuations = waiters
        waiters = []
        lock.unlock()
        for continuation in continuations { continuation.resume(returning: error == nil) }
    }
    func waitForInvalidation() async -> Bool {
        await withCheckedContinuation { continuation in
            lock.lock()
            if let invalidated { lock.unlock(); continuation.resume(returning: invalidated) }
            else { waiters.append(continuation); lock.unlock() }
        }
    }
}

actor JSONTransport {
    static let maximumBytes = 2 * 1024 * 1024
    private let origin: URL
    private var token: String
    private var reader: (session: URLSession, delegate: SessionDelegate)?
    private var closed = false
    private var cleanupFailed = false
    init(_ configuration: BackendConfiguration) {
        origin = configuration.origin
        token = configuration.token
    }
    private func makeSession(delegate: SessionDelegate) -> URLSession {
        let settings = URLSessionConfiguration.ephemeral
        settings.urlCache = nil
        settings.urlCredentialStorage = nil
        settings.httpCookieStorage = nil
        settings.httpShouldSetCookies = false
        settings.requestCachePolicy = .reloadIgnoringLocalCacheData
        settings.timeoutIntervalForRequest = 30
        settings.timeoutIntervalForResource = 30
        return URLSession(configuration: settings, delegate: delegate, delegateQueue: nil)
    }
    func get(_ path: String) async throws -> Data {
        guard !cleanupFailed else { throw LibraryFailure.cleanup }
        guard !closed, !token.isEmpty else { throw LibraryFailure.unauthorized }
        guard reader == nil else { throw LibraryFailure.unavailable }
        guard path.hasPrefix("/api/library/"), !path.contains(".."), !path.contains("?"), !path.contains("#") else { throw LibraryFailure.invalidResponse }
        let url = origin.appendingPathComponent(String(path.dropFirst()))
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "GET"
        request.httpShouldHandleCookies = false
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let delegate = SessionDelegate()
        let session = makeSession(delegate: delegate)
        reader = (session, delegate)
        let result: Result<Data, any Error>
        do {
            try Task.checkCancellation()
            let data = try await withTaskCancellationHandler {
                let (bytes, response) = try await session.bytes(for: request)
                guard let http = response as? HTTPURLResponse, http.url == url else { throw LibraryFailure.invalidResponse }
                if http.statusCode == 401 { throw LibraryFailure.unauthorized }
                guard http.statusCode == 200 else { throw LibraryFailure.unavailable }
                guard http.value(forHTTPHeaderField: "Content-Type")?.split(separator: ";").first?.trimmingCharacters(in: .whitespaces).lowercased() == "application/json",
                      (http.value(forHTTPHeaderField: "Content-Encoding") ?? "identity").lowercased() == "identity"
                else { throw LibraryFailure.invalidResponse }
                var declaredSize: Int?
                if let length = http.value(forHTTPHeaderField: "Content-Length") {
                    guard !length.isEmpty, length.allSatisfy({ $0.isASCII && $0.isNumber }),
                          let size = Int(length), size > 0, size <= Self.maximumBytes else { throw LibraryFailure.invalidResponse }
                    declaredSize = size
                }
                var data = Data()
                for try await byte in bytes {
                    try Task.checkCancellation()
                    guard data.count < Self.maximumBytes else { throw LibraryFailure.invalidResponse }
                    data.append(byte)
                }
                try Task.checkCancellation()
                guard !data.isEmpty, declaredSize == nil || declaredSize == data.count else { throw LibraryFailure.invalidResponse }
                return data
            } onCancel: { session.invalidateAndCancel() }
            result = .success(data)
            session.finishTasksAndInvalidate()
        } catch is CancellationError { result = .failure(CancellationError()); session.invalidateAndCancel() }
        catch let error as LibraryFailure { result = .failure(error); session.invalidateAndCancel() }
        catch {
            result = .failure(Task.isCancelled ? CancellationError() : LibraryFailure.network)
            session.invalidateAndCancel()
        }
        // Invalidation joins the actual URLSession reader before replacement admission.
        let cleaned = await delegate.waitForInvalidation()
        reader = nil
        guard cleaned else { cleanupFailed = true; closed = true; token = ""; throw LibraryFailure.cleanup }
        return try result.get()
    }
    func close() async throws {
        token = ""
        closed = true
        guard !cleanupFailed else { throw LibraryFailure.cleanup }
        guard let reader else { return }
        reader.session.invalidateAndCancel()
        guard await reader.delegate.waitForInvalidation() else { cleanupFailed = true; throw LibraryFailure.cleanup }
    }
}

// These four customer-backend GET calls are the complete live feature surface.
struct LibraryAPI: Sendable {
    var list: @Sendable () async throws -> RecordingPage
    var detail: @Sendable (String) async throws -> Recording
    var transcripts: @Sendable (String) async throws -> [Transcript]
    var summaries: @Sendable (String, String) async throws -> [Summary]
    var close: @Sendable () async throws -> Void

    static func live(origin: String, token: String) throws -> Self {
        let transport = JSONTransport(try BackendConfiguration(origin: origin, token: token))
        return Self(
            list: { try decode(RecordingPage.self, await transport.get("/api/library/recordings")) },
            detail: { id in
                try Contract.require(Contract.id(id, "rec"))
                let row = try decode(Recording.self, await transport.get("/api/library/recordings/\(id)"))
                try Contract.require(row.id == id)
                return row
            },
            transcripts: { id in
                try Contract.require(Contract.id(id, "rec"))
                let rows = try decode(Collection<Transcript>.self, await transport.get("/api/library/recordings/\(id)/transcriptions")).data
                try Contract.unique(rows, max: 200)
                try Contract.require(rows.allSatisfy { $0.recordingID == id })
                return rows
            },
            summaries: { transcript, recording in
                try Contract.require(Contract.id(transcript, "txn") && Contract.id(recording, "rec"))
                let rows = try decode(Collection<Summary>.self, await transport.get("/api/library/transcriptions/\(transcript)/summaries")).data
                try Contract.unique(rows, max: 200)
                try Contract.require(rows.allSatisfy { $0.transcriptID == transcript && $0.recordingID == recording })
                return rows
            },
            close: { try await transport.close() }
        )
    }
}
