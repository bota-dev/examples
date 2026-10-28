package dev.bota.examples.recordings

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.URI
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.apache.hc.core5.concurrent.FutureCallback
import org.apache.hc.core5.http.EntityDetails
import org.apache.hc.core5.http.Header
import org.apache.hc.core5.http.HttpResponse
import org.apache.hc.core5.http.config.Http1Config
import org.apache.hc.core5.http.impl.bootstrap.AsyncRequesterBootstrap
import org.apache.hc.core5.http.impl.bootstrap.HttpAsyncRequester
import org.apache.hc.core5.http.message.BasicHttpRequest
import org.apache.hc.core5.http.nio.AsyncResponseConsumer
import org.apache.hc.core5.http.nio.CapacityChannel
import org.apache.hc.core5.http.nio.support.BasicRequestProducer
import org.apache.hc.core5.http.protocol.HttpContext
import org.apache.hc.core5.io.CloseMode
import org.apache.hc.core5.reactor.IOReactorConfig
import org.apache.hc.core5.util.TimeValue
import org.apache.hc.core5.util.Timeout

interface LibrarySource : AutoCloseable {
    val sessionExpired: Boolean get() = false
    fun list(cancel: ReadCancellation): RecordingPage
    fun detail(id: String, cancel: ReadCancellation): Recording
    fun transcripts(recordingId: String, cancel: ReadCancellation): List<Transcript>
    fun summaries(transcriptionId: String, recordingId: String, cancel: ReadCancellation): List<Summary>
    /** Remove credentials immediately; the controller subsequently joins every active read. */
    fun revoke() {}
    override fun close() {}
}

internal fun interface ReadCall { fun cancel() }
/** Cancels real network work; the controller separately joins the blocking reader and engine. */
class ReadCancellation {
    private val cancelled = AtomicBoolean()
    private val call = AtomicReference<ReadCall?>()
    fun check() { if (cancelled.get()) throw CancellationException() }
    internal fun attach(value: ReadCall) {
        check(); call.set(value)
        if (cancelled.get()) { value.cancel(); throw CancellationException() }
    }
    internal fun detach(value: ReadCall) { call.compareAndSet(value, null) }
    fun cancel() { cancelled.set(true); call.get()?.cancel() }
}

class LiveLibrary private constructor(
    private val origin: String, token: String, private val deadlineMillis: Long,
    private val beforeBodyChunk: () -> Unit,
) : LibrarySource {
    private val token = AtomicReference(token)
    private val revoked = AtomicBoolean()
    private val expired = AtomicBoolean()
    private val cleanupFailed = AtomicBoolean()
    override val sessionExpired: Boolean get() = expired.get()
    private val active = AtomicReference<ReadCall?>()

    companion object {
        const val MAX_RESPONSE_BYTES = 2 * 1024 * 1024
        fun connect(originInput: String, tokenInput: String): LiveLibrary =
            create(originInput, tokenInput, 30_000)
        internal fun create(originInput: String, tokenInput: String, deadlineMillis: Long,
            beforeBodyChunk: () -> Unit = {}): LiveLibrary {
            val token = tokenInput
            if (token.length !in 32..256 || token.any { it.isWhitespace() || it.code < 33 || it.code > 126 } ||
                Regex("^(sk_|rk_|dtok_|up_|rct_)").containsMatchIn(token)) throw LibraryFailure(Failure.CONFIGURATION)
            return LiveLibrary(backendOrigin(originInput), token, deadlineMillis, beforeBodyChunk)
        }
        fun backendOrigin(input: String, allowLoopback: Boolean = BuildConfig.DEBUG): String {
            try {
                if (input.length > 2048) throw IllegalArgumentException()
                val uri = URI(input.trim())
                val scheme = uri.scheme?.lowercase()
                val host = uri.host ?: throw IllegalArgumentException()
                if (uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null ||
                    uri.rawPath !in listOf("", "/") || uri.isOpaque || uri.port !in -1..65535 || uri.port == 0) throw IllegalArgumentException()
                val loopback = host.lowercase() in setOf("localhost", "127.0.0.1", "[::1]")
                if (scheme != "https" && !(scheme == "http" && loopback && allowLoopback)) throw IllegalArgumentException()
                return URI(scheme, null, host, uri.port, null, null, null).toASCIIString()
            } catch (_: Exception) { throw LibraryFailure(Failure.CONFIGURATION) }
        }
    }

    private fun request(path: String, cancel: ReadCancellation): kotlinx.serialization.json.JsonElement {
        if (expired.get()) throw LibraryFailure(Failure.UNAUTHORIZED)
        cancel.check()
        if (revoked.get()) throw CancellationException()
        if (cleanupFailed.get()) throw LibraryFailure(Failure.NETWORK)
        val credential = token.get().takeIf { it.isNotEmpty() } ?: throw CancellationException()
        // A separate one-thread requester per explicit GET keeps ownership and teardown
        // visible. HttpCore has no redirect, retry, cookie, authentication or cache layer.
        // Keep its system trust and HTTPS endpoint-identification defaults unchanged.
        val engine = AsyncRequesterBootstrap.bootstrap()
            // Explicit finite HTTP/1 head/trailer limits match Apache's defaults
            // fix for CVE-2026-54399. Preserve them when copying this requester.
            .setHttp1Config(Http1Config.custom().setMaxHeaderCount(100).setMaxLineLength(8192).build())
            .setIOReactorConfig(IOReactorConfig.custom().setIoThreadCount(1)
                .setSoTimeout(Timeout.ofMilliseconds(deadlineMillis)).build())
            .setDefaultMaxPerRoute(1).setMaxTotal(1)
            .setConnectionReuseStrategy { _, _, _ -> false }
            .setTlsHandshakeTimeout(Timeout.ofMilliseconds(deadlineMillis)).create()
        val future = AtomicReference<Future<ByteArray>?>()
        val aborted = AtomicBoolean()
        val call = ReadCall {
            aborted.set(true); future.get()?.cancel(true)
            // Wake/seal admission here; potentially blocking channel disposal and
            // real worker joining run only in the owning reader's finally.
            engine.initiateShutdown()
        }
        val timer = Executors.newSingleThreadScheduledExecutor { runnable ->
            Thread(runnable, "library-deadline").apply { isDaemon = true }
        }
        val started = System.nanoTime()
        active.set(call)
        val deadline = timer.schedule({ call.cancel() }, deadlineMillis, TimeUnit.MILLISECONDS)
        try {
            cancel.attach(call)
            if (revoked.get()) throw CancellationException()
            engine.start()
            if (aborted.get()) throw CancellationException()
            val request = BasicHttpRequest("GET", URI("$origin/api/library$path")).apply {
                setHeader("Authorization", "Bearer $credential")
                setHeader("Accept", "application/json")
                setHeader("Accept-Encoding", "identity")
                setHeader("Cache-Control", "no-store")
                setHeader("Connection", "close")
            }
            val pending = engine.execute(BasicRequestProducer(request, null),
                JsonConsumer(cancel), Timeout.ofMilliseconds(deadlineMillis), null)
            future.set(pending)
            if (aborted.get()) pending.cancel(true)
            val remaining = deadlineMillis - TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)
            if (remaining <= 0) throw TimeoutException()
            val bytes = pending.get(remaining, TimeUnit.MILLISECONDS)
            cancel.check()
            if (revoked.get()) throw CancellationException()
            val raw = try {
                Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
            } catch (_: Exception) { invalid() }
            val result = LibraryDtos.parse(raw)
            if (aborted.get() || TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) >= deadlineMillis) throw TimeoutException()
            return result
        } catch (error: Exception) {
            // A received 401 belongs to this auth owner even if selection cancellation won.
            if (expired.get()) throw LibraryFailure(Failure.UNAUTHORIZED)
            cancel.check()
            if (revoked.get()) throw CancellationException()
            val cause = if (error is ExecutionException) error.cause else error
            if (cause is LibraryFailure) throw cause
            throw LibraryFailure(Failure.NETWORK)
        } finally {
            deadline.cancel(false)
            call.cancel()
            try {
                engine.close(CloseMode.IMMEDIATE)
            } catch (_: Exception) {
                cleanupFailed.set(true)
            } finally {
                // A failed close must not bypass the remaining resource joins.
                try {
                    // Cancellation of a Future is not completion of the worker.
                    joinEngine(engine)
                } finally {
                    timer.shutdownNow()
                    var interrupted = false
                    while (!timer.isTerminated) {
                        try { timer.awaitTermination(1, TimeUnit.DAYS) }
                        catch (_: InterruptedException) { interrupted = true }
                    }
                    cancel.detach(call); active.compareAndSet(call, null)
                    if (interrupted) Thread.currentThread().interrupt()
                }
            }
            // A response already observed by the reactor during cancellation
            // still expires this auth owner after the actual callback join.
            if (expired.get()) throw LibraryFailure(Failure.UNAUTHORIZED)
            if (cleanupFailed.get()) throw LibraryFailure(Failure.NETWORK)
        }
    }
    private fun joinEngine(engine: HttpAsyncRequester) {
        var interrupted = false
        try {
            // With one reactor worker, after immediate close marks it SHUT_DOWN,
            // a zero wait invokes Thread.join(0): it joins that sole worker fully.
            // This behavior is pinned/reviewed in HttpCore5 5.3.6 MultiCoreIOReactor.
            while (true) {
                try { engine.awaitShutdown(TimeValue.ZERO_MILLISECONDS); break }
                catch (_: InterruptedException) { interrupted = true }
            }
        } catch (_: Exception) { cleanupFailed.set(true) }
        finally { if (interrupted) Thread.currentThread().interrupt() }
    }

    private inner class JsonConsumer(private val cancel: ReadCancellation) : AsyncResponseConsumer<ByteArray> {
        private val bytes = ByteArrayOutputStream()
        private var callback: FutureCallback<ByteArray>? = null
        override fun consumeResponse(response: HttpResponse, details: EntityDetails?, context: HttpContext,
            result: FutureCallback<ByteArray>) {
            callback = result
            try {
                if (response.code == 401) { expired.set(true); token.set(""); throw LibraryFailure(Failure.UNAUTHORIZED) }
                cancel.check()
                if (response.code != 200 || details == null) invalid()
                fun single(name: String): String? {
                    val values = response.getHeaders(name)
                    if (values.size > 1) invalid()
                    return values.firstOrNull()?.value
                }
                if (!Regex("^application/json(?:;.*)?$", RegexOption.IGNORE_CASE).matches(single("Content-Type") ?: "") ||
                    single("Content-Encoding")?.lowercase()?.let { it != "identity" } == true) invalid()
                val length = single("Content-Length")
                if (length != null && (!Regex("^[0-9]+$").matches(length) || length.toLongOrNull()?.let { it > MAX_RESPONSE_BYTES } != false)) invalid()
            } catch (error: Exception) { result.failed(error); throw IOException("Response refused") }
        }
        override fun informationResponse(response: HttpResponse, context: HttpContext) {}
        override fun updateCapacity(channel: CapacityChannel) { channel.update(8192) }
        override fun consume(source: ByteBuffer) {
            try {
                beforeBodyChunk() // Internal seam for a gated real-reactor cleanup regression.
                cancel.check()
                if (bytes.size() + source.remaining() > MAX_RESPONSE_BYTES) invalid()
                val chunk = ByteArray(source.remaining()); source.get(chunk); bytes.write(chunk)
            } catch (error: Exception) { callback?.failed(error); throw IOException("Body refused") }
        }
        override fun streamEnd(trailers: List<Header>?) { callback?.completed(bytes.toByteArray()) }
        override fun failed(cause: Exception) { callback?.failed(cause) }
        override fun releaseResources() { bytes.reset() }
    }
    private fun resource(value: String, prefix: String): String {
        if (!LibraryDtos.id(value, prefix)) invalid()
        return value // The validated alphabet contains no URL syntax.
    }
    override fun list(cancel: ReadCancellation) = LibraryDtos.page(request("/recordings", cancel))
    override fun detail(id: String, cancel: ReadCancellation) =
        LibraryDtos.recording(request("/recordings/${resource(id, "rec")}", cancel), id)
    override fun transcripts(recordingId: String, cancel: ReadCancellation) =
        LibraryDtos.transcripts(request("/recordings/${resource(recordingId, "rec")}/transcriptions", cancel), recordingId)
    override fun summaries(transcriptionId: String, recordingId: String, cancel: ReadCancellation): List<Summary> {
        resource(recordingId, "rec")
        return LibraryDtos.summaries(request("/transcriptions/${resource(transcriptionId, "txn")}/summaries", cancel), transcriptionId, recordingId)
    }
    override fun revoke() { revoked.set(true); token.set(""); active.get()?.cancel() }
    override fun close() { revoke(); check(!cleanupFailed.get()) { "Network cleanup incomplete" } }
}
