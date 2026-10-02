package dev.bota.examples.recordingsync

import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import okhttp3.Call
import okhttp3.EventListener
import okhttp3.OkHttpClient
import okhttp3.Response
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RecordingSyncHostTest {
    @Test fun unknownPutCannotBeRepeatedEvenIfBackendStillReportsStaging() {
        for (phase in listOf("put_requested", "manifest_pending", "manifest_accepted")) {
            assertThrows(IllegalStateException::class.java) { SessionPolicy.shouldUpload("staging", phase) }
            assertFalse(SessionPolicy.shouldUpload("published", phase))
        }
        assertTrue(SessionPolicy.shouldUpload("staging", "selected"))
    }
    @Test fun acceptedOrPublishedManifestNeverAllowsAnotherPut() {
        for (state in listOf("staged", "ready", "processing", "published"))
            assertFalse(state, SessionPolicy.shouldUpload(state))
        assertTrue(SessionPolicy.shouldUpload("staging"))
        for (state in listOf("failed", "cancelled", "expired", "unknown"))
            assertThrows(IllegalStateException::class.java) { SessionPolicy.shouldUpload(state) }
    }

    @Test fun completionFromAnotherOwnerOrCiphertextCannotSkipUpload() {
        val session = JSONObject().put("session_id", "s").put("owner_revision", 2)
            .put("channel", "ble").put("ciphertext_length", 10).put("ciphertext_sha256", "digest")
            .put("state", "published")
        SessionPolicy.validateSession(session, "s", 2, 10, "digest")
        for (changed in listOf(session.toString().replace("\"s\"", "\"other\""),
            session.toString().replace("\"owner_revision\":2", "\"owner_revision\":3"),
            session.toString().replace("digest", "different"),
            session.toString().replace("ble", "wifi"))) {
            assertThrows(IllegalStateException::class.java) {
                SessionPolicy.validateSession(JSONObject(changed), "s", 2, 10, "digest")
            }
        }
    }

    @Test fun journalRetainsSessionAndUnknownPutAcrossRestart() {
        val directory = Files.createTempDirectory("recording-sync-test").toFile()
        try {
            SyncJournal(directory).save("tenant|device|binding1|recording", JSONObject()
                .put("recordingId", "rec_a").put("sessionId", "session").put("ownerRevision", 3)
                .put("phase", "put_requested"))
            val restored = SyncJournal(directory).load("tenant|device|binding1|recording")!!
            assertEquals("put_requested", restored.getString("phase"))
            assertEquals("session", restored.getString("sessionId"))
            assertEquals(3, restored.getInt("ownerRevision"))
            assertNull(SyncJournal(directory).load("tenant|device|binding2|recording"))
        } finally { directory.deleteRecursively() }
    }

    @Test fun backendUsesAppCredentialAndCurrentGeneration() = runBlocking {
        val server = MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setBody("{\"state\":\"published\"}"))
            val client = BackendClient(server.url("/").toString().trimEnd('/'), "app-secret", 7)
            assertEquals("published", client.request("GET", "/api/recordings/rec_a").getString("state"))
            val request = server.takeRequest()
            assertEquals("Bearer app-secret", request.getHeader("Authorization"))
            assertEquals("7", request.getHeader("X-Bota-Binding-Generation"))
        } finally { server.shutdown() }
    }

    @Test fun backendErrorDoesNotExposeResponseMaterial() = runBlocking {
        val server = MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setResponseCode(409).setBody(
                "{\"error\":{\"code\":\"session_create_uncertain\",\"message\":\"secret-url\"}}"))
            val error = runCatching { BackendClient(server.url("/").toString().trimEnd('/'), "token", 1)
                .request("POST", "/api/recordings/rec_a", JSONObject()) }.exceptionOrNull()!!
            assertTrue(error.message!!.contains("session_create_uncertain"))
            assertFalse(error.message!!.contains("secret-url"))
            assertFalse(error.message!!.contains("token"))
        } finally { server.shutdown() }
    }

    @Test fun backendDoesNotFollowRedirectWithAppCredentials() = runBlocking {
        val server = MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", server.url("/leak")))
            assertTrue(runCatching { BackendClient(server.url("/").toString().trimEnd('/'), "token", 1)
                .request("GET", "/api/recordings/rec_a") }.isFailure)
            assertEquals(1, server.requestCount)
        } finally { server.shutdown() }
    }

    @Test fun cancelledRequestSettlesWithoutAnyFollowupRequest() = runBlocking {
        val server = MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            val client = BackendClient(server.url("/").toString().trimEnd('/'), "token", 1)
            val pending = async { client.request("GET", "/api/recordings/rec_a") }
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { server.takeRequest() }
            pending.cancelAndJoin()
            client.close()
            assertTrue(runCatching { client.request("GET", "/api/recordings/rec_a") }.isFailure)
            assertEquals(1, server.requestCount)
        } finally { server.shutdown() }
    }

    @Test fun closeCancelsBodyReadAfterHeadersArrive() = runBlocking {
        val server = MockWebServer(); server.start()
        try {
            val headersReceived = kotlinx.coroutines.CompletableDeferred<Unit>()
            val transport = OkHttpClient.Builder().eventListener(object : EventListener() {
                override fun responseHeadersEnd(call: Call, response: Response) { headersReceived.complete(Unit) }
            }).build()
            server.enqueue(MockResponse().setBody("{\"state\":\"published\"}")
                .setBodyDelay(2, java.util.concurrent.TimeUnit.SECONDS))
            val client = BackendClient(server.url("/").toString().trimEnd('/'), "token", 1, transport)
            val pending = async { runCatching { client.request("GET", "/api/recordings/rec_a") } }
            kotlinx.coroutines.withTimeout(5000) { headersReceived.await() }
            client.close()
            assertTrue(kotlinx.coroutines.withTimeout(5000) { pending.await() }.isFailure)
        } finally { server.shutdown() }
    }

    @Test fun cancelledPreparationCannotCommitALateCreationOrKeepItsSlot() = runBlocking {
        val server = MockWebServer(); server.start()
        val directory = Files.createTempDirectory("recording-sync-cancel").toFile()
        try {
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
            val host = RecordingSyncHost(directory, JSONObject()
                .put("baseUrl", server.url("/").toString().trimEnd('/')).put("appToken", "token")
                .put("deviceId", "dev_a").put("bindingGeneration", 1).put("endUserId", "eu_a"))
            val operation = "11111111-1111-4111-8111-111111111111"
            val request = JSONObject().put("operationId", operation)
                .put("recording", JSONObject().put("uuid", "22222222-2222-4222-8222-222222222222")
                    .put("generation", 1).put("ciphertextLength", "10").put("ciphertextSha256", "ab".repeat(32)))
                .put("capability", JSONObject().put("rawValueHex", "00".repeat(24)).put("flags", 0x17f))
            val pending = async { host.prepare(request) }
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { server.takeRequest() }
            host.cancel(operation)
            kotlinx.coroutines.withTimeout(5000) { pending.join() }
            assertTrue(pending.isCancelled)
            val state = JSONObject(File(directory, "recording-sync").listFiles()!!.single().readText())
            assertFalse(state.has("recordingId"))
            server.enqueue(MockResponse().setResponseCode(409).setBody("{\"error\":{\"code\":\"test_rejection\"}}"))
            assertTrue(runCatching { host.prepare(request) }.exceptionOrNull()!!.message!!.contains("test_rejection"))
            host.dispose()
        } finally { server.shutdown(); directory.deleteRecursively() }
    }
}
