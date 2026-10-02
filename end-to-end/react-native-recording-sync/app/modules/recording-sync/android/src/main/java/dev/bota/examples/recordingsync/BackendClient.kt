package dev.bota.examples.recordingsync

import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class BackendClient(private val base: String, private val token: String,
                             private val generation: Long,
                             private val client: OkHttpClient = OkHttpClient.Builder()
                                 .followRedirects(false).followSslRedirects(false).build()) {
    private val calls = ConcurrentHashMap.newKeySet<Call>()
    @Volatile private var closed = false

    suspend fun request(method: String, path: String, body: JSONObject? = null): JSONObject {
        check(!closed) { "operation cancelled" }
        require(path.startsWith("/api/") && !path.contains(".."))
        val request = Request.Builder().url(base + path)
            .header("Authorization", "Bearer $token")
            .header("X-Bota-Binding-Generation", generation.toString())
            .method(method, body?.toString()?.toRequestBody("application/json".toMediaType()))
            .build()
        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            calls.add(call)
            continuation.invokeOnCancellation { call.cancel() }
            if (closed) call.cancel()
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, error: IOException) {
                    calls.remove(call)
                    if (continuation.isActive) continuation.resumeWithException(
                        IOException("backend request did not complete; reconcile retained session"))
                }
                override fun onResponse(call: Call, response: Response) {
                    try { response.use {
                        val result = runCatching {
                            val text = it.body?.string().orEmpty()
                            if (!it.isSuccessful) {
                                val code = runCatching { JSONObject(text).getJSONObject("error").getString("code") }
                                    .getOrDefault("request_failed")
                                    .takeIf { code -> code.matches(Regex("[a-z0-9_]{1,80}")) } ?: "request_failed"
                                error("backend HTTP ${it.code}: $code")
                            }
                            if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }
                                .getOrElse { error("backend returned invalid JSON") }
                        }
                        if (continuation.isActive) result.fold(continuation::resume, continuation::resumeWithException)
                    } } finally { calls.remove(call) }
                }
            })
        }
    }
    fun close() { closed = true; calls.forEach(Call::cancel) }
}
