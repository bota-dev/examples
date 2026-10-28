package dev.bota.examples.recordings

import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.serialization.json.*

data class Recording(val id: String, val name: String?, val status: String, val createdAt: String,
    val durationSeconds: Double?, val uploadVerified: Boolean)
data class RecordingPage(val data: List<Recording>, val hasMore: Boolean)
data class Transcript(val id: String, val recordingId: String, val status: String, val text: String?)
data class Notes(val overview: String, val keyPoints: List<String>, val actionItems: List<String>,
    val participants: List<String>, val decisions: List<String>)
data class Summary(val id: String, val transcriptionId: String, val recordingId: String, val status: String, val notes: Notes?)

enum class Failure { CONFIGURATION, UNAUTHORIZED, RESPONSE, NETWORK }
class LibraryFailure(val failure: Failure) : Exception(failure.name)
internal fun invalid(): Nothing = throw LibraryFailure(Failure.RESPONSE)

/** Exact customer-backend DTO allowlist. Do not publish unvalidated provider payloads. */
object LibraryDtos {
    private val json = Json { isLenient = false; allowSpecialFloatingPointValues = false }
    private val jobStatuses = setOf("pending", "processing", "completed", "failed")
    private val recordingStatuses = jobStatuses + setOf("streaming", "uploaded", "integrity_failure")
    fun id(value: String, prefix: String): Boolean = Regex("^${prefix}_[A-Za-z0-9_-]{1,128}$").matches(value)
    fun parse(raw: String): JsonElement {
        // A byte cap alone cannot bound recursive JSON parsing. Strings/escapes do not add depth.
        var depth = 0; var quoted = false; var escaped = false
        for (char in raw) {
            if (quoted) {
                if (escaped) escaped = false else if (char == '\\') escaped = true else if (char == '"') quoted = false
            } else when (char) {
                '"' -> quoted = true
                '{', '[' -> { depth++; if (depth > 64) invalid() }
                '}', ']' -> { depth--; if (depth < 0) invalid() }
            }
        }
        return try { json.parseToJsonElement(raw) } catch (_: Exception) { invalid() }
    }
    private fun JsonElement.obj(): JsonObject = this as? JsonObject ?: invalid()
    private fun JsonElement?.text(): String = (this as? JsonPrimitive)?.takeIf { it.isString }?.content ?: invalid()
    private fun JsonElement?.bool(): Boolean = (this as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull ?: invalid()
    private fun timestamp(value: JsonElement?): String {
        val text = value.text(); if (text.length > 64) invalid()
        try { OffsetDateTime.parse(text).toInstant() } catch (_: Exception) {
            try { Instant.parse(text) } catch (_: Exception) { invalid() }
        }
        return text
    }
    private fun rows(value: JsonElement, limit: Int = 200): List<JsonElement> =
        (value.obj()["data"] as? JsonArray)?.takeIf { it.size <= limit } ?: invalid()
    fun recording(value: JsonElement, expected: String? = null): Recording {
        val obj = value.obj(); val id = obj["id"].text()
        if (!id(id, "rec") || expected != null && id != expected) invalid()
        val nameValue = obj["name"] ?: invalid()
        val name = if (nameValue == JsonNull) null else nameValue.text().also { if (it.length > 255) invalid() }
        val status = obj["status"].text(); if (status !in recordingStatuses) invalid()
        val durationValue = obj["duration_seconds"] ?: invalid()
        val duration = if (durationValue == JsonNull) null else
            (durationValue as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() && it >= 0 } ?: invalid()
        return Recording(id, name, status, timestamp(obj["created_at"]), duration, obj["upload_verified"].bool())
    }
    fun page(value: JsonElement): RecordingPage {
        val obj = value.obj(); val data = rows(value, 20).map { recording(it) }
        if (data.map { it.id }.distinct().size != data.size) invalid()
        val hasMore = obj["has_more"].bool(); val cursor = obj["next_cursor"] ?: invalid()
        if (cursor != JsonNull) {
            val text = cursor.text()
            if (text.isEmpty() || text.length > 1024 || text.any { it.code < 32 || it.code == 127 }) invalid()
        }
        if (hasMore && (cursor == JsonNull || data.isEmpty()) || !hasMore && cursor != JsonNull) invalid()
        return RecordingPage(data, hasMore)
    }
    fun transcripts(value: JsonElement, recordingId: String): List<Transcript> = rows(value).map { row ->
        val obj = row.obj(); val id = obj["id"].text(); val status = obj["status"].text()
        if (!id(id, "txn") || obj["recording_id"].text() != recordingId || status !in jobStatuses) invalid()
        if (obj["created_at"] != null && obj["created_at"] != JsonNull) timestamp(obj["created_at"])
        val text = if (status == "completed") obj["full_text"].text().also { if (it.length > 1_000_000) invalid() } else null
        Transcript(id, recordingId, status, text)
    }.also { rows -> if (rows.map { it.id }.distinct().size != rows.size) invalid() }
    fun summaries(value: JsonElement, transcriptionId: String, recordingId: String): List<Summary> = rows(value).map { row ->
        val obj = row.obj(); val id = obj["id"].text(); val status = obj["status"].text()
        if (!id(id, "sum") || obj["transcription_id"].text() != transcriptionId ||
            obj["recording_id"].text() != recordingId || obj["template_id"].text() != "tmpl_general_notes" || status !in jobStatuses) invalid()
        val output = if (status == "completed") {
            val notes = obj["output"]?.obj() ?: invalid()
            val overview = notes["overview"].text().also { if (it.length > 10_000) invalid() }
            fun strings(key: String) = (notes[key] as? JsonArray)?.takeIf { it.size <= 200 }?.map {
                it.text().also { text -> if (text.length > 10_000) invalid() }
            } ?: invalid()
            Notes(overview, strings("key_points"), strings("action_items"), strings("participants"), strings("decisions"))
        } else null
        Summary(id, transcriptionId, recordingId, status, output)
    }.also { rows -> if (rows.map { it.id }.distinct().size != rows.size) invalid() }
}
