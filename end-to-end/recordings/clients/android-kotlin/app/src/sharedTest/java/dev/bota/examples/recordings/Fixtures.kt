package dev.bota.examples.recordings

import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URI
import java.io.OutputStream
import java.util.Collections
import java.util.concurrent.Executors
import kotlin.concurrent.thread

internal const val TEST_TOKEN = "local-test-application-token-000000000000"
internal fun recordingJson(id: String = "rec_a") = """{"id":"$id","name":"Synthetic recording","status":"completed","created_at":"2026-01-01T00:00:00Z","duration_seconds":12,"upload_verified":true}"""
internal fun pageJson() = """{"data":[${recordingJson()}],"has_more":false,"next_cursor":null}"""
internal fun transcriptJson(id: String = "txn_a", recording: String = "rec_a", status: String = "completed", text: String = "Synthetic text") =
    """{"id":"$id","recording_id":"$recording","status":"$status","full_text":"$text"}"""
internal fun summaryJson(recording: String = "rec_a", transcription: String = "txn_a") =
    """{"id":"sum_a","recording_id":"$recording","transcription_id":"$transcription","status":"completed","template_id":"tmpl_general_notes","output":{"overview":"Synthetic notes","key_points":[],"action_items":[],"participants":[],"decisions":[]}}"""
internal fun collection(item: String) = """{"data":[$item]}"""
internal fun json(value: String) = LibraryDtos.parse(value)
internal fun response(exchange: TestExchange, value: String, status: Int = 200) {
    val bytes = value.toByteArray()
    exchange.responseHeaders.add("Content-Type", "application/json")
    exchange.sendResponseHeaders(status, bytes.size.toLong())
    exchange.responseBody.use { it.write(bytes) }
}
internal class TestHeaders {
    private val values = linkedMapOf<String, String>()
    fun add(key: String, value: String) { values[key.lowercase()] = value }
    fun getFirst(key: String): String? = values[key.lowercase()]
    fun lines() = values.entries.joinToString("") { "${it.key}: ${it.value}\r\n" }
}
internal class TestExchange(private val socket: Socket) : AutoCloseable {
    val requestMethod: String
    val requestURI: URI
    val requestHeaders = TestHeaders()
    val responseHeaders = TestHeaders()
    lateinit var responseBody: OutputStream
    init {
        val input = socket.getInputStream().bufferedReader(Charsets.US_ASCII)
        val line = input.readLine().split(' ')
        requestMethod = line[0]; requestURI = URI(line[1])
        while (true) {
            val header = input.readLine() ?: break
            if (header.isEmpty()) break
            val colon = header.indexOf(':'); requestHeaders.add(header.substring(0, colon), header.substring(colon + 1).trim())
        }
    }
    fun sendResponseHeaders(status: Int, length: Long) {
        val stream = socket.getOutputStream()
        responseHeaders.add("Connection", "close")
        if (status == 204) responseHeaders.add("Content-Length", "0")
        else if (length == 0L) responseHeaders.add("Transfer-Encoding", "chunked") else responseHeaders.add("Content-Length", "$length")
        stream.write("HTTP/1.1 $status Synthetic\r\n${responseHeaders.lines()}\r\n".toByteArray(Charsets.US_ASCII))
        stream.flush()
        responseBody = if (length == 0L && status != 204) object : OutputStream() {
            private var closed = false
            override fun write(value: Int) = write(byteArrayOf(value.toByte()), 0, 1)
            override fun write(bytes: ByteArray, offset: Int, count: Int) {
                if (count == 0) return
                stream.write("${count.toString(16)}\r\n".toByteArray(Charsets.US_ASCII))
                stream.write(bytes, offset, count); stream.write("\r\n".toByteArray(Charsets.US_ASCII))
            }
            override fun flush() = stream.flush()
            override fun close() { if (!closed) { closed = true; stream.write("0\r\n\r\n".toByteArray(Charsets.US_ASCII)); stream.close() } }
        } else stream
    }
    override fun close() { try { if (::responseBody.isInitialized) responseBody.close() } finally { socket.close() } }
}
internal class TestBackend(handler: (TestExchange) -> Unit) : AutoCloseable {
    private val executor = Executors.newCachedThreadPool { runnable -> Thread(runnable, "synthetic-backend").apply { isDaemon = true } }
    private val server = ServerSocket().apply { bind(InetSocketAddress("127.0.0.1", 0)) }
    private val failures = Collections.synchronizedList(mutableListOf<AssertionError>())
    private val accept = thread(name = "synthetic-accept", isDaemon = true) {
        while (!server.isClosed) {
            val socket = try { server.accept() } catch (_: Exception) { break }
            executor.execute {
                try { TestExchange(socket).use { handler(it) } }
                catch (error: AssertionError) { failures.add(error) }
                catch (_: Exception) { } // Cancellation deliberately closes synthetic response sockets.
            }
        }
    }
    val origin: String = "http://127.0.0.1:${server.localPort}"
    override fun close() { server.close(); accept.join(); executor.shutdownNow(); failures.firstOrNull()?.let { throw it } }
}
