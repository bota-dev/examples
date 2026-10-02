package dev.bota.examples.recordingsync

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import org.json.JSONObject

class RecordingSyncModule : Module() {
    private var host: RecordingSyncHost? = null

    override fun definition() = ModuleDefinition {
        Name("RecordingSync")
        AsyncFunction("configure") Coroutine { configuration: Map<String, Any?> ->
            check(host == null) { "dispose the current recording sync host before configuring" }
            val context = requireNotNull(appContext.reactContext)
            host = RecordingSyncHost(context.noBackupFilesDir, JSONObject(configuration))
        }
        AsyncFunction("prepare") Coroutine { request: Map<String, Any?> ->
            requireNotNull(host) { "recording sync is not configured" }.prepare(JSONObject(request))
        }
        AsyncFunction("cancel") Coroutine { operationId: String -> host?.cancel(operationId); Unit }
        AsyncFunction("dispose") Coroutine { -> host?.dispose(); host = null; Unit }
        OnDestroy { host?.close(); host = null }
    }
}
