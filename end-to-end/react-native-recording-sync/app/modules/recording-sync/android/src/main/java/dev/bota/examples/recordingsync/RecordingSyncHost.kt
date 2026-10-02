package dev.bota.examples.recordingsync

import dev.bota.sdk.EncryptedUploadV2ContextExchange
import dev.bota.sdk.EncryptedUploadV2Material
import dev.bota.sdk.EncryptedUploadV2SecurityPolicy
import dev.bota.sdk.EncryptedUploadV2TransferEvidence
import dev.bota.sdk.reactnative.BotaDeviceSDKEncryptedUploadV2Materials
import java.io.File
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

internal class RecordingSyncHost(root: File, private val config: JSONObject) {
    private val journal = SyncJournal(root)
    private val operations = ConcurrentHashMap<String, Operation>()
    private val lifecycle = Any()
    private val base = config.getString("baseUrl").trimEnd('/').also {
        val url = it.toHttpUrl()
        require(url.isHttps || url.host in setOf("localhost", "127.0.0.1", "10.0.2.2")) {
            "use HTTPS or a local development backend"
        }
        require(url.username.isEmpty() && url.password.isEmpty() && url.query == null &&
            url.fragment == null && url.encodedPath == "/") { "backend URL must be an origin" }
    }
    private val device = config.getString("deviceId").also { require(it.matches(Regex("dev_[A-Za-z0-9]+"))) }
    private val generation = config.getLong("bindingGeneration").also { require(it in 0..2147483647) }
    @Volatile private var closed = false
    private class Operation(val backend: BackendClient, val preparation: Job?) {
        @Volatile var registration: String? = null
        @Volatile var cancelled = false
        fun active() { check(!cancelled) { "operation cancelled" } }
        fun close() { cancelled = true; backend.close() }
    }

    suspend fun prepare(request: JSONObject): Map<String, Any> = withContext(Dispatchers.IO) {
        val operationId = request.getString("operationId")
        UUID.fromString(operationId)
        val operation = Operation(BackendClient(base, config.getString("appToken"), generation), currentCoroutineContext()[Job])
        synchronized(lifecycle) {
            check(!closed && operations.isEmpty()) { "another recording operation is active" }
            check(operations.putIfAbsent(operationId, operation) == null)
        }
        try {
            val recording = request.getJSONObject("recording")
            val uuid = UUID.fromString(recording.getString("uuid")).toString()
            val recordingGeneration = recording.getLong("generation").also { require(it in 0..0xffffffffL) }
            val length = recording.getString("ciphertextLength").toLong().also { require(it in 1..9007199254740991L) }
            val digest = recording.getString("ciphertextSha256").also { require(it.matches(Regex("[a-f0-9]{64}"))) }
            val capability = request.getJSONObject("capability")
            val capabilityBytes = decodeHex(capability.getString("rawValueHex"), 24)
            require(capability.getLong("flags") and 0x17fL == 0x17fL) { "batch v2 context capability required" }
            val identity = listOf(base, config.optString("projectId"), config.getString("endUserId"),
                device, generation, uuid, recordingGeneration, length, digest).joinToString("|")
            fun persist(value: JSONObject) = synchronized(lifecycle) {
                operation.active()
                check(!closed && operations[operationId] === operation) { "operation owner changed" }
                journal.save(identity, value)
            }
            val state = journal.load(identity) ?: JSONObject().put("phase", "recording_pending").also { persist(it) }
            val backend = operation.backend
            if (!state.has("recordingId")) {
                val body = JSONObject().put("device_id", device).put("binding_generation", generation)
                    .put("recording_uuid", uuid).put("recording_generation", recordingGeneration)
                    .put("ciphertext_length", length).put("ciphertext_sha256", digest)
                val cloud = backend.request("POST", "/api/recordings", body)
                operation.active()
                state.put("recordingId", cloud.getString("recording_id"))
                persist(state)
            }
            val cloudId = state.getString("recordingId").also { require(it.matches(Regex("rec_[A-Za-z0-9]+"))) }
            val sessions = "/api/recordings/$cloudId/encrypted-upload-v2/sessions"
            val checkpoint = request.optJSONObject("checkpoint")
            if (!state.has("sessionId")) {
                check(checkpoint == null) { "native transfer checkpoint has no matching application session" }
                // The backend journals this intent before the public POST and fails closed on lost responses.
                state.put("phase", "session_pending"); persist(state)
                val nonce = BotaDeviceSDKEncryptedUploadV2Materials.readAuthNonce(operationId)
                operation.active()
                val session = backend.request("POST", sessions, JSONObject()
                    .put("device_id", device).put("binding_generation", generation)
                    .put("recording_uuid", uuid).put("recording_generation", recordingGeneration)
                    .put("storage_format", "bota_enc_v2").put("channel", "ble")
                    .put("capabilities_base64", encode(capabilityBytes)).put("auth_nonce_base64", encode(nonce))
                    .put("ciphertext_length", length).put("ciphertext_sha256", digest))
                operation.active()
                state.put("sessionId", UUID.fromString(session.getString("session_id")).toString())
                    .put("ownerRevision", session.getLong("owner_revision")).put("phase", "selected")
                persist(state)
            }
            val sessionId = UUID.fromString(state.getString("sessionId")).toString()
            val revision = state.getLong("ownerRevision").also { require(it in 1..0xffffffffL) }
            if (checkpoint != null) check(checkpoint.getString("uploadSessionId") == sessionId &&
                checkpoint.getLong("ownerRevision") == revision) { "checkpoint owner differs from application journal" }
            val path = "$sessions/$sessionId"
            suspend fun status(): JSONObject {
                operation.active()
                return backend.request("GET", path).also {
                    SessionPolicy.validateSession(it, sessionId, revision, length, digest)
                    operation.active()
                }
            }
            val selected = status()
            val policyText = selected.getString("policy")
            val policy = when (policyText) {
                "v2_required" -> EncryptedUploadV2SecurityPolicy.V2Required
                "v2_preferred" -> EncryptedUploadV2SecurityPolicy.V2Preferred
                "legacy_allowed" -> EncryptedUploadV2SecurityPolicy.LegacyAllowed
                else -> error("unsupported backend policy")
            }
            fun verify(evidence: EncryptedUploadV2TransferEvidence) {
                operation.active()
                check(evidence.ciphertextLength == length.toULong() && sha256Hex(evidence.ciphertextSha256) == digest) {
                    "native transfer evidence differs from selected recording"
                }
            }
            suspend fun published(): JSONObject = withTimeout(120000L) {
                var result = status()
                while (result.getString("state") != "published") { delay(1000); result = status() }
                result
            }
            val material = EncryptedUploadV2Material(
                materialId = UUID.randomUUID().toString(), recordingId = uuid,
                uploadSessionId = UUID.fromString(sessionId), ownerRevision = revision.toUInt(),
                policy = policy, authorization = decode(selected.getString("authorization_base64"), 408),
                shouldUploadCiphertext = { evidence ->
                    verify(evidence)
                    SessionPolicy.shouldUpload(status().getString("state"), state.getString("phase"))
                },
                stagingRequest = { evidence ->
                    verify(evidence)
                    check(status().getString("state") == "staging") { "session no longer permits staging" }
                    val staging = backend.request("POST", "$path/staging-url", JSONObject().put("owner_revision", revision))
                    val template = runCatching {
                        val url = staging.getString("url").toHttpUrl()
                        check(url.isHttps && staging.getString("method") == "PUT")
                        val builder = Request.Builder().url(url).put(ByteArray(0).toRequestBody())
                        val headers = staging.getJSONObject("headers")
                        headers.keys().forEach { name -> builder.header(name, headers.getString(name)) }
                        builder.build()
                    }.getOrElse { error("invalid staging target or headers") }
                    state.put("phase", "put_requested"); persist(state)
                    template
                },
                submitManifest = { manifest, evidence ->
                    verify(evidence)
                    state.put("phase", "manifest_pending"); persist(state)
                    backend.request("POST", "$path/manifest", JSONObject().put("owner_revision", revision)
                        .put("manifest_base64", encode(manifest)).put("manifest_sha256", sha256(manifest)))
                    state.put("phase", "manifest_accepted"); persist(state)
                },
                finalize = { evidence -> verify(evidence); published(); Unit },
                completionReceipt = { evidence ->
                    verify(evidence)
                    val result = published()
                    decode(result.getString("completion_receipt_base64"), 336)
                },
                uploadContext = { nonce ->
                    operation.active()
                    val contexts = "/api/devices/$device/encrypted-upload-v2/contexts"
                    val deadline = System.nanoTime() + 25000000000L
                    fun remaining(): Long = ((deadline - System.nanoTime()) / 1000000L).also {
                        check(it > 0) { "upload context deadline expired" }
                    }
                    val challenge = withTimeout(remaining()) {
                        backend.request("POST", contexts, JSONObject().put("nonce_base64", encode(nonce)))
                    }
                    val contextId = UUID.fromString(challenge.getString("context_id")).toString()
                    EncryptedUploadV2ContextExchange(decode(challenge.getString("challenge_base64"), 196)) { proof ->
                        withTimeout(remaining()) {
                            var result = backend.request("POST", "$contexts/$contextId/proof", JSONObject().put("proof_base64", encode(proof)))
                            while (result.getString("state") == "pending") {
                                delay(300); result = backend.request("GET", "$contexts/$contextId")
                            }
                            check(result.getString("state") == "complete") { "upload context did not complete" }
                            decode(result.getString("result_base64"), 264)
                        }
                    }
                },
                cancel = { operation.close() },
            )
            currentCoroutineContext().ensureActive(); operation.active()
            val registration = BotaDeviceSDKEncryptedUploadV2Materials.register(material)
            operation.registration = registration
            if (closed || operation.cancelled) {
                BotaDeviceSDKEncryptedUploadV2Materials.release(registration)
                error("operation cancelled")
            }
            mapOf("profile" to "encrypted_upload_v2", "uploadSessionId" to sessionId,
                "ownerRevision" to revision.toDouble(), "securityPolicy" to policyText,
                "materialRegistrationId" to registration, "cloudRecordingId" to cloudId)
        } catch (failure: Throwable) {
            operation.close()
            withContext(NonCancellable) {
                operation.registration?.let { BotaDeviceSDKEncryptedUploadV2Materials.release(it) }
            }
            operations.remove(operationId, operation)
            throw failure
        }
    }

    suspend fun cancel(operationId: String) {
        val operation = operations[operationId] ?: return
        operation.close()
        operation.preparation?.cancelAndJoin()
        operation.registration?.let { BotaDeviceSDKEncryptedUploadV2Materials.release(it) }
        operations.remove(operationId, operation)
    }
    suspend fun dispose() { closed = true; operations.keys.toList().forEach { cancel(it) } }
    fun close() = synchronized(lifecycle) {
        closed = true
        operations.values.forEach {
            it.close()
            // Its cancellation callback only closes this same operation; no remote cancellation.
            it.registration?.let(BotaDeviceSDKEncryptedUploadV2Materials::remove)
        }
        operations.clear()
    }
    private fun encode(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)
    private fun decode(value: String, length: Int): ByteArray = Base64.getDecoder().decode(value).also {
        require(it.size == length && encode(it) == value) { "invalid opaque document encoding" }
    }
    private fun decodeHex(value: String, length: Int): ByteArray {
        require(value.matches(Regex("[a-fA-F0-9]{${length * 2}}")))
        return value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
    private fun sha256Hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
}
