import Darwin
import Foundation

// Test-only HTTP peer. It binds only 127.0.0.1 and never contacts a live backend.
final class LoopbackServer: @unchecked Sendable {
    struct Response: Sendable {
        var status = 200
        var headers = ["Content-Type": "application/json"]
        var body = Data("{}".utf8)
        var omitLength = false
        var hold: DispatchSemaphore?
    }
    let origin: String
    private let listener: Int32
    private let group = DispatchGroup()
    private let lock = NSLock()
    private let received = DispatchSemaphore(value: 0)
    private var captured: [String] = []
    private var stopped = false
    var requests: [String] { lock.lock(); defer { lock.unlock() }; return captured }

    init(_ respond: @escaping @Sendable (String) -> Response) throws {
        let socket = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard socket >= 0 else { throw LibraryFailure.network }
        listener = socket
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
        let bound = withUnsafePointer(to: &address) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(socket, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
        }
        var size = socklen_t(MemoryLayout<sockaddr_in>.size)
        let named = withUnsafeMutablePointer(to: &address) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(socket, $0, &size) }
        }
        guard bound == 0, named == 0, listen(socket, 8) == 0 else { Darwin.close(socket); throw LibraryFailure.network }
        origin = "http://127.0.0.1:\(UInt16(bigEndian: address.sin_port))"
        group.enter()
        DispatchQueue(label: "bota.sample.test.http").async { [self] in
            defer { group.leave() }
            while true {
                let client = accept(socket, nil, nil)
                if client < 0 { return }
                lock.lock(); let isStopped = stopped; lock.unlock()
                if isStopped { Darwin.close(client); return }
                var yes: Int32 = 1
                _ = setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &yes, socklen_t(MemoryLayout<Int32>.size))
                var input = Data(), buffer = [UInt8](repeating: 0, count: 4096)
                while input.count < 16_384 && input.range(of: Data("\r\n\r\n".utf8)) == nil {
                    let count = buffer.withUnsafeMutableBytes { recv(client, $0.baseAddress!, $0.count, 0) }
                    if count <= 0 { break }
                    input.append(contentsOf: buffer.prefix(count))
                }
                let request = String(decoding: input, as: UTF8.self)
                lock.lock(); captured.append(request); lock.unlock()
                received.signal()
                let response = respond(request)
                response.hold?.wait()
                var headers = response.headers
                headers["Connection"] = "close"
                if !response.omitLength && headers["Content-Length"] == nil { headers["Content-Length"] = String(response.body.count) }
                let head = "HTTP/1.1 \(response.status) Test\r\n" + headers.map { "\($0.key): \($0.value)\r\n" }.joined() + "\r\n"
                let output = Data(head.utf8) + response.body
                output.withUnsafeBytes { bytes in
                    var offset = 0
                    while offset < bytes.count {
                        let count = send(client, bytes.baseAddress!.advanced(by: offset), min(16_384, bytes.count - offset), 0)
                        if count <= 0 { break }
                        offset += count
                    }
                }
                Darwin.close(client)
            }
        }
    }
    func waitForRequest() async -> Bool {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async { [self] in continuation.resume(returning: received.wait(timeout: .now() + 5) == .success) }
        }
    }
    func stop() {
        lock.lock()
        if stopped { lock.unlock(); return }
        stopped = true
        lock.unlock()
        shutdown(listener, SHUT_RDWR)
        Darwin.close(listener)
        group.wait()
    }
}
