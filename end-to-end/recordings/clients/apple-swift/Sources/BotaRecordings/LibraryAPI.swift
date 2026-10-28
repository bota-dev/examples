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

// A received 401 expires its token session even if a selection cancellation raced it.
struct ReaderFailure {
    private(set) var value: (any Error)?
    mutating func observe(_ error: any Error) {
        if value as? LibraryFailure == .cleanup { return }
        if error as? LibraryFailure == .cleanup || error as? LibraryFailure == .unauthorized || value == nil { value = error }
    }
}

// One known data task, one serial delegate, one bounded buffer. The continuation
// settles only after task completion AND session invalidation, or a sticky cleanup failure.
private final class HTTPReader: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private let target: URL
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var continuation: CheckedContinuation<Data, any Error>?
    private var outcome: Result<Data, any Error>?
    private var failure = ReaderFailure()
    private var buffer = Data()
    private var declaredSize: Int?
    private var accepted = false
    private var completed = false
    private var invalidated = false
    private var cleanupFailed = false
    private var deadline: DispatchWorkItem?
    private var cleanupDeadline: DispatchWorkItem?

    init(_ request: URLRequest, target: URL) {
        self.target = target
        super.init()
        let settings = URLSessionConfiguration.ephemeral
        settings.urlCache = nil
        settings.urlCredentialStorage = nil
        settings.httpCookieStorage = nil
        settings.httpShouldSetCookies = false
        settings.requestCachePolicy = .reloadIgnoringLocalCacheData
        settings.timeoutIntervalForRequest = 30
        settings.timeoutIntervalForResource = 30
        let session = URLSession(configuration: settings, delegate: self, delegateQueue: nil)
        self.session = session
        task = session.dataTask(with: request)
    }
    func read() async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            if let outcome { lock.unlock(); continuation.resume(with: outcome); return }
            self.continuation = continuation
            let timer = DispatchWorkItem { [weak self] in self?.cancel(LibraryFailure.network, onlyWhileReading: true) }
            deadline = timer
            let task = task
            lock.unlock()
            DispatchQueue.global().asyncAfter(deadline: .now() + 30, execute: timer)
            task?.resume()
        }
    }
    private func armCleanupLocked() {
        guard cleanupDeadline == nil, outcome == nil else { return }
        let timer = DispatchWorkItem { [weak self] in self?.cleanupExpired() }
        cleanupDeadline = timer
        DispatchQueue.global().asyncAfter(deadline: .now() + 5, execute: timer)
    }
    func cancel(_ error: any Error = CancellationError(), onlyWhileReading: Bool = false) {
        lock.lock()
        guard outcome == nil, !onlyWhileReading || !completed else { lock.unlock(); return }
        failure.observe(error)
        buffer.removeAll()
        armCleanupLocked()
        let task = task, session = session
        lock.unlock()
        // Cancel this known task, then wait for its terminal delegate and final session callback.
        task?.cancel()
        session?.finishTasksAndInvalidate()
    }
    private func cleanupExpired() {
        lock.lock()
        guard outcome == nil else { lock.unlock(); return }
        if completed && invalidated { lock.unlock(); settle(); return }
        cleanupFailed = true
        let task = task, session = session
        lock.unlock()
        task?.cancel()
        session?.invalidateAndCancel()
        settle()
    }
    private func settle() {
        lock.lock()
        // Retain native ownership after a cleanup timeout until both callbacks actually arrive.
        if completed && invalidated { task = nil; session = nil }
        guard outcome == nil, cleanupFailed || (completed && invalidated) else { lock.unlock(); return }
        let result: Result<Data, any Error>
        if cleanupFailed { result = .failure(LibraryFailure.cleanup) }
        else if let failure = failure.value { result = .failure(failure) }
        else { result = .success(buffer) }
        outcome = result; buffer.removeAll()
        deadline?.cancel(); cleanupDeadline?.cancel()
        let continuation = self.continuation; self.continuation = nil
        lock.unlock()
        continuation?.resume(with: result)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        // Explicitly terminate refused redirects instead of waiting for a redirect body.
        cancel(LibraryFailure.unavailable)
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping @Sendable (URLSession.ResponseDisposition) -> Void) {
        var rejected: LibraryFailure?
        var size: Int?
        if let http = response as? HTTPURLResponse, http.url == target {
            if http.statusCode == 401 { rejected = .unauthorized }
            else if http.statusCode != 200 { rejected = .unavailable }
            else if http.value(forHTTPHeaderField: "Content-Type")?.split(separator: ";", omittingEmptySubsequences: false).first?.trimmingCharacters(in: .whitespaces).lowercased() != "application/json" ||
                (http.value(forHTTPHeaderField: "Content-Encoding") ?? "identity").lowercased() != "identity" { rejected = .invalidResponse }
            else if let length = http.value(forHTTPHeaderField: "Content-Length") {
                if !length.isEmpty, length.allSatisfy({ $0.isASCII && $0.isNumber }), let value = Int(length), value > 0, value <= JSONTransport.maximumBytes { size = value }
                else { rejected = .invalidResponse }
            }
        } else { rejected = .invalidResponse }
        if let rejected { cancel(rejected); completionHandler(.cancel); return }
        lock.lock(); accepted = failure.value == nil; declaredSize = size; let allow = accepted; lock.unlock()
        completionHandler(allow ? .allow : .cancel)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock()
        guard accepted, failure.value == nil else { lock.unlock(); return }
        guard data.count <= JSONTransport.maximumBytes - buffer.count else { lock.unlock(); cancel(LibraryFailure.invalidResponse); return }
        buffer.append(data)
        lock.unlock()
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        lock.lock()
        completed = true
        deadline?.cancel()
        if failure.value == nil {
            if error != nil { failure.observe(LibraryFailure.network) }
            else if !accepted || buffer.isEmpty || (declaredSize != nil && declaredSize != buffer.count) { failure.observe(LibraryFailure.invalidResponse) }
        }
        armCleanupLocked()
        lock.unlock()
        session.finishTasksAndInvalidate()
        settle()
    }
    func urlSession(_ session: URLSession, didBecomeInvalidWithError error: (any Error)?) {
        lock.lock(); invalidated = true; if error != nil { cleanupFailed = true }; lock.unlock()
        settle()
    }
}

actor JSONTransport {
    static let maximumBytes = 2 * 1024 * 1024
    private let origin: URL
    private var token: String
    private var reader: (operation: HTTPReader, work: Task<Data, any Error>)?
    private var closed = false
    private var cleanupFailed = false
    init(_ configuration: BackendConfiguration) { origin = configuration.origin; token = configuration.token }
    func get(_ path: String) async throws -> Data {
        guard !cleanupFailed else { throw LibraryFailure.cleanup }
        guard !closed, !token.isEmpty else { throw LibraryFailure.unauthorized }
        guard reader == nil else { throw LibraryFailure.unavailable }
        guard path.hasPrefix("/api/library/"), !path.contains(".."), !path.contains("?"), !path.contains("#") else { throw LibraryFailure.invalidResponse }
        try Task.checkCancellation()
        let url = origin.appendingPathComponent(String(path.dropFirst()))
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "GET"; request.httpShouldHandleCookies = false
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let operation = HTTPReader(request, target: url)
        let work = Task { try await operation.read() }
        reader = (operation, work)
        let result = await withTaskCancellationHandler { await work.result } onCancel: { operation.cancel() }
        if case .failure(let error) = result, error as? LibraryFailure == .cleanup {
            cleanupFailed = true; closed = true; token = "" // Keep the quarantined native owner.
            throw LibraryFailure.cleanup
        }
        reader = nil
        let data = try result.get()
        try Task.checkCancellation()
        return data
    }
    func close() async throws {
        token = ""; closed = true
        guard !cleanupFailed else { throw LibraryFailure.cleanup }
        guard let reader else { return }
        reader.operation.cancel()
        if case .failure(let error) = await reader.work.result, error as? LibraryFailure == .cleanup {
            cleanupFailed = true
            throw LibraryFailure.cleanup
        }
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
