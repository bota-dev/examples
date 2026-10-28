package dev.bota.examples.recordings

import java.net.InetSocketAddress
import java.net.Socket
import java.security.KeyStore
import java.util.Base64
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManagerFactory
import kotlin.concurrent.thread

/** Synthetic keys are public test fixtures, never application credentials. */
internal object TlsChecks {
    private fun store(name: String): KeyStore {
        val raw = TlsChecks::class.java.classLoader!!.getResourceAsStream("tls/$name.p12.base64")!!
            .bufferedReader().use { it.readText() }
        return KeyStore.getInstance("PKCS12").apply {
            load(Base64.getMimeDecoder().decode(raw).inputStream(), "synthetic-only".toCharArray())
        }
    }
    fun verifyDefaultTrustAndEndpointChecks() {
        val previous = SSLContext.getDefault()
        val trusted = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
            load(null, null)
            for (name in listOf("localhost", "foreign", "ip-missing-san")) setCertificateEntry(name, store(name).getCertificate("fixture"))
        }
        val manager = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(trusted) }
        // Test-only system CA store: real trust validation and hostname verification
        // stay enabled. Production code never sets a TLS context or trust manager.
        SSLContext.setDefault(SSLContext.getInstance("TLS").apply { init(null, manager.trustManagers, null) })
        try {
            for (name in listOf("localhost", "foreign", "ip-missing-san", "untrusted")) {
                TlsBackend(store(name)).use { backend ->
                    val host = if (name == "ip-missing-san") "127.0.0.1" else "localhost"
                    LiveLibrary.connect("https://$host:${backend.port}", TEST_TOKEN).use { api ->
                        if (name == "localhost") check(api.list(ReadCancellation()).data.single().id == "rec_a")
                        else {
                            val failure = try { api.list(ReadCancellation()); error("Invalid TLS peer accepted: $name") }
                                catch (error: LibraryFailure) { error }
                            check(failure.failure == Failure.NETWORK)
                            check(backend.requests.get() == 0) { "Bearer request reached an invalid TLS peer" }
                        }
                    }
                }
            }
        } finally { SSLContext.setDefault(previous) }
    }
    private class TlsBackend(keys: KeyStore) : AutoCloseable {
        private val manager = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
            init(keys, "synthetic-only".toCharArray())
        }
        private val context = SSLContext.getInstance("TLS").apply { init(manager.keyManagers, null, null) }
        private val server = (context.serverSocketFactory.createServerSocket() as SSLServerSocket).apply {
            bind(InetSocketAddress("127.0.0.1", 0))
        }
        private val sockets = Collections.synchronizedList(mutableListOf<Socket>())
        private val executor = Executors.newCachedThreadPool { task -> Thread(task, "synthetic-tls").apply { isDaemon = true } }
        val requests = AtomicInteger()
        val port: Int = server.localPort
        private val accept = thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() as SSLSocket } catch (_: Exception) { break }
                sockets.add(socket)
                executor.execute {
                    try {
                        socket.use {
                            it.soTimeout = 3000; it.startHandshake()
                            TestExchange(it).use { exchange -> requests.incrementAndGet(); response(exchange, pageJson()) }
                        }
                    } catch (_: Exception) { } // Invalid test peers must fail their handshake.
                    finally { sockets.remove(socket) }
                }
            }
        }
        override fun close() {
            server.close(); accept.join()
            synchronized(sockets) { sockets.toList().forEach { it.close() } }
            executor.shutdownNow(); check(executor.awaitTermination(5, TimeUnit.SECONDS))
        }
    }
}
