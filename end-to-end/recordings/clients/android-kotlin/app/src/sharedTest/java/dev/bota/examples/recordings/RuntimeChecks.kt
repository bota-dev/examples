package dev.bota.examples.recordings

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

internal object RuntimeChecks {
    fun httpMessageLimitsRejectOversizedHeadsAndTrailers() {
        val body = pageJson()
        val head = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n"
        fun fixed(extra: String) = head + "Content-Length: ${body.length}\r\n" + extra + "\r\n" + body
        fun chunked(trailers: String) = head + "Transfer-Encoding: chunked\r\n\r\n" +
            body.length.toString(16) + "\r\n" + body + "\r\n0\r\n" + trailers + "\r\n"
        // 3 ordinary fields + 98 extras = 101 total header fields.
        val attacks = listOf(
            fixed((0 until 98).joinToString("") { "X-Synthetic-$it: value\r\n" }),
            fixed("X-Long: " + "x".repeat(8193 - "X-Long: ".length) + "\r\n"),
            fixed("X-Fold: " + "x".repeat(4094) + "\r\n " + "x".repeat(4098) + "\r\n"),
            chunked((0 until 101).joinToString("") { "X-Trailer-$it: value\r\n" }),
            chunked("X-Long: " + "x".repeat(8193 - "X-Long: ".length) + "\r\n"),
            chunked("X-Fold: " + "x".repeat(4094) + "\r\n " + "x".repeat(4098) + "\r\n"),
        )
        for (attack in attacks) {
            val calls = AtomicInteger()
            TestBackend { request -> calls.incrementAndGet(); request.writeRaw(attack) }.use { backend ->
                LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
                    val failure = try { api.list(ReadCancellation()); error("Oversized HTTP message accepted") }
                        catch (error: LibraryFailure) { error }
                    check(failure.failure == Failure.NETWORK || failure.failure == Failure.RESPONSE)
                    check(calls.get() == 1) { "Invalid HTTP message caused an automatic retry" }
                }
            }
        }
        // The attacker never terminates this line. The parser must enforce its
        // bound while accumulating fragments, without waiting for CRLF or EOF.
        val closed = AtomicBoolean(); val observed = CountDownLatch(1); val calls = AtomicInteger()
        TestBackend { request ->
            calls.incrementAndGet()
            try {
                request.writeRaw(head + "X-Unfinished: ")
                repeat(5) { request.writeRaw("x".repeat(2048)) }
                closed.set(request.awaitPeerClose())
            } catch (_: java.net.SocketTimeoutException) { closed.set(false) }
            catch (_: java.io.IOException) { closed.set(true) }
            finally { observed.countDown() }
        }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
            val failure = try { api.list(ReadCancellation()); error("Unterminated oversized HTTP line accepted") }
                catch (error: LibraryFailure) { error }
            check(failure.failure == Failure.NETWORK || failure.failure == Failure.RESPONSE)
            check(observed.await(5, TimeUnit.SECONDS) && closed.get()) { "Oversized unfinished line was not bounded before EOF" }
            check(calls.get() == 1)
        } }
    }
    fun authenticatedGetAndNoRetry() {
        val calls = AtomicInteger()
        TestBackend { request ->
            check(request.requestMethod == "GET")
            check(request.requestHeaders.getFirst("Authorization") == "Bearer $TEST_TOKEN")
            check(request.requestHeaders.getFirst("Cookie") == null)
            check(request.requestHeaders.getFirst("Accept-Encoding") == "identity")
            calls.incrementAndGet()
            if (request.requestURI.path == "/api/library/recordings") response(request, pageJson())
            // Deliberate EOF before response headers proves transport does not retry.
        }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
            check(api.list(ReadCancellation()).data.single().id == "rec_a")
            val error = try { api.detail("rec_a", ReadCancellation()); error("Expected connection failure") }
                catch (error: LibraryFailure) { error }
            check(error.failure == Failure.NETWORK)
            check(calls.get() == 2) { "Failed GET was replayed" }
        } }
    }
    fun cancellationJoinsActualReader() {
        val entered = CountDownLatch(1); val release = CountDownLatch(1); val finished = CountDownLatch(1)
        TestBackend { request ->
            request.responseHeaders.add("Content-Type", "application/json"); request.sendResponseHeaders(200, 0)
            request.responseBody.write('{'.code); request.responseBody.flush()
            entered.countDown(); release.await(5, TimeUnit.SECONDS)
        }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
            val cancel = ReadCancellation(); val outcome = AtomicReference<Throwable?>()
            val worker = thread {
                try { api.list(cancel) } catch (error: Throwable) { outcome.set(error) }
                finally { finished.countDown() }
            }
            try {
                check(entered.await(5, TimeUnit.SECONDS)); api.revoke(); cancel.cancel()
                check(finished.await(5, TimeUnit.SECONDS)) { "Underlying reader did not finish" }
                worker.join(); check(outcome.get() is java.util.concurrent.CancellationException)
            } finally { release.countDown() }
        } }
    }
    fun cancellationWaitsForRealReactorCallback() {
        val entered = CountDownLatch(1); val release = CountDownLatch(1)
        val exited = CountDownLatch(1); val finished = CountDownLatch(1); val revoked = CountDownLatch(1)
        TestBackend { response(it, pageJson()) }.use { backend ->
            val api = LiveLibrary.create(backend.origin, TEST_TOKEN, 30_000) {
                entered.countDown()
                // Deliberately ignore interrupt until the explicit test gate opens.
                // A cancelled Future or SHUT_DOWN status cannot stand in for this work.
                var interrupted = false
                while (true) {
                    try { release.await(); break } catch (_: InterruptedException) { interrupted = true }
                }
                exited.countDown()
                if (interrupted) Thread.currentThread().interrupt()
            }
            val outcome = AtomicReference<Throwable?>()
            val worker = thread {
                try { api.list(ReadCancellation()) } catch (error: Throwable) { outcome.set(error) }
                finally { finished.countDown() }
            }
            try {
                check(entered.await(5, TimeUnit.SECONDS))
                val retirement = thread { api.revoke(); revoked.countDown() }
                check(revoked.await(1, TimeUnit.SECONDS)) { "Credential revocation blocked on callback work" }
                retirement.join()
                check(!finished.await(100, TimeUnit.MILLISECONDS)) { "Reader returned before real callback cleanup" }
                check(exited.count == 1L)
                release.countDown()
                check(finished.await(5, TimeUnit.SECONDS)); worker.join()
                check(exited.count == 0L)
                check(outcome.get() is java.util.concurrent.CancellationException)
            } finally { release.countDown(); worker.join(5000); api.close() }
        }
    }
}
