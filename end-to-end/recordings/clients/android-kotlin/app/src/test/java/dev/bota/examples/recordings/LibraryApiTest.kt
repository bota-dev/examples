package dev.bota.examples.recordings

import java.net.CookieHandler
import java.net.CookieManager
import java.net.HttpCookie
import java.net.URI
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.testng.Assert.*
import org.testng.annotations.Test

class LibraryApiTest {
    private fun rejected(block: () -> Unit): LibraryFailure {
        try { block() } catch (error: LibraryFailure) { return error }
        throw AssertionError("Expected a controlled library failure")
    }
    @Test fun originsAndSeparateTokensAreValidatedBeforeNetwork() {
        listOf("http://example.com", "https://u:p@example.com", "https://example.com/path", "https://example.com?x", "https://example.com#x",
            "http://127.0.0.2:1234", "http://localhost.evil.test", "https://example.com:0", "https://example.com/%2f", "https://" + "a".repeat(2049)).forEach {
            assertEquals(rejected { LiveLibrary.connect(it, TEST_TOKEN) }.failure, Failure.CONFIGURATION)
        }
        listOf("short", "x".repeat(257), " $TEST_TOKEN", "$TEST_TOKEN ", "$TEST_TOKEN\n", "x".repeat(16) + "\r\n" + "x".repeat(16), "sk_" + "x".repeat(40), "rk_" + "x".repeat(40),
            "dtok_" + "x".repeat(40), "up_" + "x".repeat(40), "rct_" + "x".repeat(40), "a ".repeat(20)).forEach {
            assertEquals(rejected { LiveLibrary.connect("https://example.com", it) }.failure, Failure.CONFIGURATION)
        }
        assertEquals(LiveLibrary.backendOrigin(" https://example.com/ "), "https://example.com")
        assertEquals(LiveLibrary.backendOrigin("http://[::1]:3000/"), "http://[::1]:3000")
    }
    @Test fun realGetUsesBearerAndRefusesCookiesEvenWithHostCookieManager() {
        val previous = CookieHandler.getDefault()
        try {
            val cookies = CookieManager()
            CookieHandler.setDefault(cookies) // Proves this per-client transport does not consult a host cookie jar.
            TestBackend { request ->
                assertEquals(request.requestMethod, "GET")
                assertEquals(request.requestURI.path, "/api/library/recordings")
                assertEquals(request.requestHeaders.getFirst("Authorization"), "Bearer $TEST_TOKEN")
                assertNull(request.requestHeaders.getFirst("Cookie"))
                request.responseHeaders.add("Set-Cookie", "browser-session=synthetic; Path=/")
                response(request, pageJson())
            }.use { backend ->
                cookies.cookieStore.add(URI(backend.origin), HttpCookie("host-cookie", "synthetic").apply { path = "/" })
                LiveLibrary.connect(backend.origin, TEST_TOKEN).use {
                assertEquals(it.list(ReadCancellation()).data.single().id, "rec_a")
                it.list(ReadCancellation())
            } }
        } finally { CookieHandler.setDefault(previous) }
    }
    @Test fun redirectsAreNotFollowedAndFailuresAreNotRetried() {
        val calls = AtomicInteger()
        TestBackend { request -> calls.incrementAndGet(); request.responseHeaders.add("Location", "/target"); response(request, "{}", 302) }.use { backend ->
            LiveLibrary.connect(backend.origin, TEST_TOKEN).use { assertEquals(rejected { it.list(ReadCancellation()) }.failure, Failure.RESPONSE) }
        }
        assertEquals(calls.get(), 1)
    }
    @Test fun successfulReadRequiresExact200() {
        for (status in listOf(201, 202, 204, 206)) {
            TestBackend { response(it, if (status == 204) "" else pageJson(), status) }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use {
                assertEquals(rejected { it.list(ReadCancellation()) }.failure, Failure.RESPONSE)
            } }
        }
    }
    @Test fun unauthorizedNeverExposesResponseBody() {
        val calls = AtomicInteger()
        TestBackend { calls.incrementAndGet(); response(it, "not JSON and must not escape", 401) }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use {
            val failure = rejected { it.list(ReadCancellation()) }; assertEquals(failure.failure, Failure.UNAUTHORIZED)
            assertEquals(failure.message, "UNAUTHORIZED")
            assertTrue(it.sessionExpired)
            val cancelled = ReadCancellation().apply { cancel() }
            assertEquals(rejected { it.list(cancelled) }.failure, Failure.UNAUTHORIZED)
            assertEquals(rejected { it.detail("rec_a", ReadCancellation()) }.failure, Failure.UNAUTHORIZED)
            assertEquals(calls.get(), 1, "A known rejected token must never be sent again")
        } }
    }
    @Test fun knownLengthAndChunkedResponsesAreBoundedBeforeJsonParsing() {
        for (chunked in listOf(false, true)) {
            TestBackend { request ->
                request.responseHeaders.add("Content-Type", "application/json")
                request.sendResponseHeaders(200, if (chunked) 0 else (LiveLibrary.MAX_RESPONSE_BYTES + 1).toLong())
                try { request.responseBody.use { it.write(ByteArray(LiveLibrary.MAX_RESPONSE_BYTES + 1) { 32 }) } } catch (_: Exception) { }
            }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use {
                assertEquals(rejected { it.list(ReadCancellation()) }.failure, Failure.RESPONSE)
            } }
        }
    }
    @Test fun rejectsWrongMediaMalformedUtf8AndDeepJson() {
        for (kind in listOf("media", "utf8", "depth")) {
            TestBackend { request ->
                val body = when (kind) { "utf8" -> byteArrayOf(0xc3.toByte(), 0x28); "depth" -> ("[".repeat(65) + "]".repeat(65)).toByteArray(); else -> pageJson().toByteArray() }
                request.responseHeaders.add("Content-Type", if (kind == "media") "text/html" else "application/json")
                request.sendResponseHeaders(200, body.size.toLong()); request.responseBody.use { it.write(body) }
            }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use {
                assertEquals(rejected { it.list(ReadCancellation()) }.failure, Failure.RESPONSE)
            } }
        }
    }
    @Test fun totalDeadlineIncludesAStalledResponseBody() {
        val release = CountDownLatch(1)
        TestBackend { request ->
            request.responseHeaders.add("Content-Type", "application/json"); request.sendResponseHeaders(200, 0)
            request.responseBody.write('{'.code); request.responseBody.flush(); release.await(3, TimeUnit.SECONDS)
        }.use { backend ->
            val start = System.nanoTime()
            LiveLibrary.create(backend.origin, TEST_TOKEN, 150).use { assertEquals(rejected { it.list(ReadCancellation()) }.failure, Failure.NETWORK) }
            assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 2500)
            release.countDown()
        }
    }
    @Test fun cancellationFinishesTheUnderlyingBlockingBodyReader() {
        val entered = CountDownLatch(1); val release = CountDownLatch(1); val finished = CountDownLatch(1)
        TestBackend { request ->
            request.responseHeaders.add("Content-Type", "application/json"); request.sendResponseHeaders(200, 0)
            request.responseBody.write('{'.code); request.responseBody.flush(); entered.countDown(); release.await(3, TimeUnit.SECONDS)
        }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
            val cancel = ReadCancellation(); val outcome = AtomicReference<Throwable?>()
            val worker = thread {
                try { api.list(cancel) } catch (error: Throwable) { outcome.set(error) } finally { finished.countDown() }
            }
            assertTrue(entered.await(2, TimeUnit.SECONDS)); cancel.cancel()
            assertTrue(finished.await(2, TimeUnit.SECONDS), "Real blocking reader must return, not merely lose its result")
            worker.join(); release.countDown()
            assertTrue(outcome.get() is java.util.concurrent.CancellationException)
        } }
    }
    @Test fun exactDetailTranscriptAndSummaryRelationshipsAreRequired() {
        for (kind in listOf("detail", "transcript", "summary")) {
            TestBackend { request -> response(request, when (kind) {
                "detail" -> recordingJson("rec_foreign")
                "transcript" -> collection(transcriptJson(recording = "rec_foreign"))
                else -> collection(summaryJson(transcription = "txn_foreign"))
            }) }.use { backend -> LiveLibrary.connect(backend.origin, TEST_TOKEN).use { api ->
                assertEquals(rejected { when (kind) {
                    "detail" -> api.detail("rec_a", ReadCancellation())
                    "transcript" -> api.transcripts("rec_a", ReadCancellation())
                    else -> api.summaries("txn_a", "rec_a", ReadCancellation())
                } }.failure, Failure.RESPONSE)
            } }
        }
    }
    @Test fun dtoCapsCompletedContentAndPaginationAreEnforced() {
        rejected { LibraryDtos.page(json("""{"data":[${List(21) { recordingJson("rec_$it") }.joinToString()}],"has_more":false,"next_cursor":null}""")) }
        rejected { LibraryDtos.page(json(pageJson().replace("\"has_more\":false", "\"has_more\":true"))) }
        rejected { LibraryDtos.page(json(pageJson().replace("12", "\"12\""))) }
        rejected { LibraryDtos.transcripts(json(collection(transcriptJson(text = "x".repeat(1_000_001)))), "rec_a") }
        rejected { LibraryDtos.summaries(json(collection(summaryJson().replace("Synthetic notes", "x".repeat(10_001)))), "txn_a", "rec_a") }
        rejected { LibraryDtos.summaries(json(collection(summaryJson().replace("tmpl_general_notes", "tmpl_other"))), "txn_a", "rec_a") }
        assertNull(LibraryDtos.transcripts(json(collection(transcriptJson(status = "pending"))), "rec_a").single().text)
        assertNull(LibraryDtos.recording(json(recordingJson().replace("\"duration_seconds\":12", "\"duration_seconds\":null"))).durationSeconds)
        assertEquals(LibraryDtos.summaries(json(collection(summaryJson())), "txn_a", "rec_a").single().notes?.overview, "Synthetic notes")
    }
}
