import Darwin
import Foundation
import XCTest
@testable import BotaRecordings

// Test-only, unbuffered boundary markers. Never include a URL, header, token or body.
func transportTrace(_ marker: String) {
    FileHandle.standardError.write(Data("[transport] \(marker)\n".utf8))
}

// Test-only HTTP peer. It binds only 127.0.0.1 and never contacts a live backend.
final class LoopbackServer: @unchecked Sendable {
    struct Response: Sendable {
        var status = 200
        var headers = ["Content-Type": "application/json"]
        var body = Data("{}".utf8)
        var omitLength = false
        var hold: DispatchSemaphore?
        var holdSeconds = 5
    }
    let origin: String
    private let group = DispatchGroup()
    private let lock = NSLock()
    private let received = DispatchSemaphore(value: 0)
    private var captured: [String] = []
    private var stopped = false
    private var failure: String?
    var requests: [String] { lock.lock(); defer { lock.unlock() }; return captured }

    init(_ respond: @escaping @Sendable (String) -> Response) throws {
        let socket = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard socket >= 0 else { throw LibraryFailure.network }
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
        let flags = fcntl(socket, F_GETFL)
        guard bound == 0, named == 0, listen(socket, 8) == 0, flags >= 0,
              fcntl(socket, F_SETFL, flags | O_NONBLOCK) == 0
        else { Darwin.close(socket); throw LibraryFailure.network }
        origin = "http://127.0.0.1:\(UInt16(bigEndian: address.sin_port))"
        transportTrace("fixture.ready")
        group.enter()
        DispatchQueue(label: "bota.sample.test.http").async { [self] in
            // This worker alone closes the listener; stop never closes a descriptor under accept/poll.
            defer { Darwin.close(socket); transportTrace("fixture.worker.exit"); group.leave() }
            while wait(socket, events: Int16(POLLIN), phase: "listener", deadline: nil) {
                let client = accept(socket, nil, nil)
                if client < 0 {
                    if errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR { continue }
                    if !isStopped { recordFailure("accept failed: errno \(errno)") }
                    return
                }
                serve(client, respond: respond)
            }
        }
    }
    private var isStopped: Bool { lock.lock(); defer { lock.unlock() }; return stopped }
    private func recordFailure(_ message: String) {
        lock.lock(); if failure == nil { failure = message }; lock.unlock()
        transportTrace("fixture.failure.recorded")
    }
    private func wait(_ socket: Int32, events: Int16, phase: String, deadline: DispatchTime?) -> Bool {
        while !isStopped {
            if let deadline, DispatchTime.now().uptimeNanoseconds >= deadline.uptimeNanoseconds {
                recordFailure("\(phase) exceeded the fixture deadline"); return false
            }
            var descriptor = pollfd(fd: socket, events: events, revents: 0)
            let ready = Darwin.poll(&descriptor, 1, 100)
            if ready < 0 {
                if errno == EINTR { continue }
                recordFailure("\(phase) poll failed: errno \(errno)"); return false
            }
            if ready == 0 { continue }
            if descriptor.revents & Int16(POLLNVAL) != 0 { recordFailure("\(phase) descriptor became invalid"); return false }
            // HUP/ERR let recv/send observe an expected client-side cancellation without blocking.
            if descriptor.revents & (events | Int16(POLLHUP) | Int16(POLLERR)) != 0 { return !isStopped }
        }
        return false
    }
    private func serve(_ client: Int32, respond: @Sendable (String) -> Response) {
        defer { Darwin.close(client) }
        if isStopped { return }
        var yes: Int32 = 1
        let flags = fcntl(client, F_GETFL)
        guard flags >= 0, fcntl(client, F_SETFL, flags | O_NONBLOCK) == 0,
              setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &yes, socklen_t(MemoryLayout<Int32>.size)) == 0
        else { recordFailure("accepted socket setup failed"); return }
        var input = Data(), buffer = [UInt8](repeating: 0, count: 4096)
        let headerEnd = Data("\r\n\r\n".utf8), headerDeadline = DispatchTime.now() + 5
        while input.range(of: headerEnd) == nil {
            guard input.count < 16_384 else { recordFailure("request headers exceeded 16 KiB"); return }
            guard wait(client, events: Int16(POLLIN), phase: "request headers", deadline: headerDeadline) else { return }
            let count = buffer.withUnsafeMutableBytes { recv(client, $0.baseAddress!, min($0.count, 16_384 - input.count), 0) }
            if count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) { continue }
            guard count > 0 else { if !isStopped { recordFailure("peer closed before complete request headers") }; return }
            input.append(contentsOf: buffer.prefix(count))
        }
        let request = String(decoding: input, as: UTF8.self)
        lock.lock(); captured.append(request); lock.unlock()
        transportTrace("fixture.request.headers.complete")
        received.signal()
        let response = respond(request)
        if let hold = response.hold {
            transportTrace("fixture.response.hold.begin")
            let deadline = DispatchTime.now() + .seconds(response.holdSeconds)
            while hold.wait(timeout: .now() + .milliseconds(100)) != .success {
                if isStopped { return }
                if DispatchTime.now().uptimeNanoseconds >= deadline.uptimeNanoseconds { recordFailure("response hold exceeded fixture deadline"); return }
            }
            transportTrace("fixture.response.hold.end")
        }
        if isStopped { return }
        var headers = response.headers
        headers["Connection"] = "close"
        if !response.omitLength && headers["Content-Length"] == nil { headers["Content-Length"] = String(response.body.count) }
        let head = "HTTP/1.1 \(response.status) Test\r\n" + headers.map { "\($0.key): \($0.value)\r\n" }.joined() + "\r\n"
        let output = Data(head.utf8) + response.body, bodyDeadline = DispatchTime.now() + 15
        transportTrace("fixture.response.write.begin")
        output.withUnsafeBytes { bytes in
            var offset = 0
            while offset < bytes.count {
                guard wait(client, events: Int16(POLLOUT), phase: "response body", deadline: bodyDeadline) else { return }
                let count = send(client, bytes.baseAddress!.advanced(by: offset), min(16_384, bytes.count - offset), 0)
                if count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) { continue }
                // Oversize/redirect/cancellation tests deliberately close before consuming a body.
                if count < 0 && (errno == EPIPE || errno == ECONNRESET) { return }
                guard count > 0 else { if !isStopped { recordFailure("response write failed: errno \(errno)") }; return }
                offset += count
            }
            transportTrace("fixture.response.write.complete")
        }
    }
    func waitForRequest() async -> Bool {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async { [self] in continuation.resume(returning: received.wait(timeout: .now() + 5) == .success) }
        }
    }
    func stop(file: StaticString = #filePath, line: UInt = #line) {
        transportTrace("fixture.stop.begin")
        lock.lock()
        if stopped { lock.unlock(); return }
        stopped = true
        lock.unlock()
        guard group.wait(timeout: .now() + 5) == .success else {
            transportTrace("fixture.stop.timeout")
            XCTFail("Loopback fixture cleanup did not join within five seconds", file: file, line: line)
            return
        }
        transportTrace("fixture.stop.joined")
        lock.lock(); let failure = self.failure; lock.unlock()
        if let failure { XCTFail("Loopback fixture failed: \(failure)", file: file, line: line) }
    }
}
