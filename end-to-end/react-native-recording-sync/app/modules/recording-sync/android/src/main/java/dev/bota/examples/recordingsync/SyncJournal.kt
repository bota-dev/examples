package dev.bota.examples.recordingsync

import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import org.json.JSONObject

internal fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes).joinToString("") { "%02x".format(it) }

/** Stores scope and immutable IDs, never URLs, authorizations, receipts or credentials. */
internal class SyncJournal(root: File) {
    private val directory = File(root, "recording-sync").apply { mkdirs() }
    fun load(identity: String): JSONObject? = file(identity).takeIf { it.exists() }
        ?.readText()?.let(::JSONObject)?.also {
            check(it.getString("identity") == identity) { "journal identity mismatch" }
        }
    fun save(identity: String, value: JSONObject) {
        value.put("identity", identity)
        val destination = file(identity)
        val temporary = File(directory, destination.name + ".tmp")
        FileOutputStream(temporary).use { stream ->
            stream.write(value.toString().toByteArray(Charsets.UTF_8))
            stream.fd.sync()
        }
        Files.move(temporary.toPath(), destination.toPath(),
            StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }
    private fun file(identity: String) = File(directory, sha256(identity.toByteArray()) + ".json")
}

internal object SessionPolicy {
    fun shouldUpload(state: String, journalPhase: String): Boolean {
        val needed = shouldUpload(state)
        check(!needed || journalPhase !in setOf("put_requested", "manifest_pending", "manifest_accepted")) {
            "staging outcome uncertain; retain recording and reconcile before another PUT"
        }
        return needed
    }
    fun shouldUpload(state: String): Boolean = when (state) {
        "created", "staging" -> true
        "staged", "ready", "processing", "published" -> false
        else -> error("session cannot continue: $state")
    }
    fun validateSession(session: JSONObject, sessionId: String, revision: Long,
                        ciphertextLength: Long, ciphertextSha256: String) {
        check(session.getString("session_id") == sessionId &&
            session.getLong("owner_revision") == revision &&
            session.getString("channel") == "ble" &&
            session.getLong("ciphertext_length") == ciphertextLength &&
            session.getString("ciphertext_sha256") == ciphertextSha256) { "session identity mismatch" }
        shouldUpload(session.getString("state"))
    }
}
