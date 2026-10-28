package dev.bota.examples.recordings

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Uses the platform instrumentation API, with no external test/runtime dependency. */
class TransportInstrumentation : Instrumentation() {
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
    override fun onStart() {
        val finished = AtomicBoolean()
        val completed = AtomicInteger()
        val current = AtomicReference("initializing")
        val ordinal = AtomicInteger()
        val total = AtomicInteger()
        fun status() = Bundle().apply {
            putString("class", TransportInstrumentation::class.java.name); putString("test", current.get())
            putInt("numtests", total.get()); putInt("current", ordinal.get())
        }
        val scheduler = Executors.newSingleThreadScheduledExecutor { task ->
            Thread(task, "synthetic-instrumentation-watchdog").apply { isDaemon = true }
        }
        val watchdog = scheduler.schedule({
            if (finished.compareAndSet(false, true)) {
                val reason = "240-second test budget exceeded in ${current.get()}"
                try {
                    Log.e("BotaTransportChecks", reason)
                    Thread.getAllStackTraces().values.forEachIndexed { index, frames ->
                        Log.e("BotaTransportChecks", "Java stack ${index + 1}")
                        frames.forEach { frame ->
                            // Class/method/source locations only: never dump locals,
                            // thread names, credentials, headers or response content.
                            Log.e("BotaTransportChecks", "at ${frame.className}.${frame.methodName}(${frame.fileName}:${frame.lineNumber})")
                        }
                    }
                } finally {
                    try {
                        sendStatus(-2, status().apply { putString("stack", reason) })
                        finish(0, Bundle().apply { putString("shortMsg", reason) })
                    } finally { scheduler.shutdown() }
                }
            }
        }, 240, TimeUnit.SECONDS)
        try {
            val cases = listOf(
                "authenticatedGetAndNoRetry" to RuntimeChecks::authenticatedGetAndNoRetry,
                "defaultTlsChecks" to TlsChecks::verifyDefaultTrustAndEndpointChecks,
                "cancellationJoinsActualReader" to RuntimeChecks::cancellationJoinsActualReader,
                "cancellationWaitsForRealReactorCallback" to RuntimeChecks::cancellationWaitsForRealReactorCallback,
                "httpMessageLimits" to RuntimeChecks::httpMessageLimitsRejectOversizedHeadsAndTrailers,
            )
            total.set(cases.size)
            cases.forEachIndexed { index, (name, check) ->
                if (finished.get()) return
                current.set(name); ordinal.set(index + 1)
                sendStatus(1, status()); check()
                if (finished.get()) return
                completed.incrementAndGet()
                sendStatus(0, status())
            }
            if (finished.compareAndSet(false, true)) {
                finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "OK (${completed.get()} tests)\n") })
            }
        } catch (error: Throwable) {
            if (finished.compareAndSet(false, true)) {
                sendStatus(-2, status().apply { putString("stack", error.stackTraceToString()) })
                finish(0, Bundle().apply { putString("shortMsg", "Synthetic transport check failed after ${completed.get()} cases") })
            }
        } finally {
            watchdog.cancel(false)
            scheduler.shutdownNow()
        }
    }
}
