package dev.bota.examples.recordings

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

internal object RuntimeChecks {
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
