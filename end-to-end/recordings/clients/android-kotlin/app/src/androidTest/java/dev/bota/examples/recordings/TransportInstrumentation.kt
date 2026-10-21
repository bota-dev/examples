package dev.bota.examples.recordings

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle

/** Uses the platform instrumentation API, with no external test/runtime dependency. */
class TransportInstrumentation : Instrumentation() {
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
    override fun onStart() {
        val cases = listOf(
            "authenticatedGetAndNoRetry" to RuntimeChecks::authenticatedGetAndNoRetry,
            "defaultTlsChecks" to TlsChecks::verifyDefaultTrustAndEndpointChecks,
            "cancellationJoinsActualReader" to RuntimeChecks::cancellationJoinsActualReader,
            "cancellationWaitsForRealReactorCallback" to RuntimeChecks::cancellationWaitsForRealReactorCallback,
        )
        var completed = 0
        try {
            cases.forEachIndexed { index, (name, check) ->
                fun status() = Bundle().apply {
                    putString("class", TransportInstrumentation::class.java.name); putString("test", name)
                    putInt("numtests", cases.size); putInt("current", index + 1)
                }
                sendStatus(1, status()); check(); completed++
                sendStatus(0, status())
            }
            finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "OK ($completed tests)\n") })
        } catch (error: Throwable) {
            sendStatus(-2, Bundle().apply { putString("stack", error.stackTraceToString()) })
            finish(0, Bundle().apply { putString("shortMsg", "Synthetic transport check failed after $completed cases") })
        }
    }
}
