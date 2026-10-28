package dev.bota.examples.recordings

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.*
import org.testng.Assert.*
import org.testng.annotations.Test

class LibrarySessionsTest {
    private class BlockingSource(private val failClose: Boolean = false) : LibrarySource {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val finished = AtomicBoolean()
        val revoked = AtomicBoolean()
        val closed = AtomicBoolean()
        override fun list(cancel: ReadCancellation): RecordingPage = try {
            entered.countDown()
            check(release.await(5, TimeUnit.SECONDS)) // Deliberately ignores cancellation.
            RecordingPage(listOf(Recording("rec_retired", "Synthetic retired content", "completed",
                "2026-01-01T00:00:00Z", 1.0, true)), false)
        } finally { finished.set(true) }
        override fun detail(id: String, cancel: ReadCancellation): Recording = error("Unexpected read")
        override fun transcripts(recordingId: String, cancel: ReadCancellation): List<Transcript> = error("Unexpected read")
        override fun summaries(transcriptionId: String, recordingId: String, cancel: ReadCancellation): List<Summary> = error("Unexpected read")
        override fun revoke() { revoked.set(true) }
        override fun close() {
            check(finished.get()) { "Close must follow the actual blocking reader" }
            closed.set(true)
            if (failClose) error("Synthetic cleanup failure")
        }
        suspend fun awaitEntered() = assertTrue(withContext(Dispatchers.IO) { entered.await(3, TimeUnit.SECONDS) })
    }

    @Test fun recreatedActivityCannotAdmitUntilRetiredReaderJoinsAndOldLeaseCannotAffectIt() = runBlocking {
        val process = CoroutineScope(coroutineContext + SupervisorJob())
        val oldView = CoroutineScope(coroutineContext + SupervisorJob())
        val source = BlockingSource()
        val samples = AtomicInteger()
        val sessions = LibrarySessions(process, liveFactory = { _, _ -> source }, sampleFactory = {
            assertTrue(source.finished.get()); assertTrue(source.closed.get())
            samples.incrementAndGet(); SampleLibrary()
        })
        try {
            val first = sessions.attach()
            oldView.launch { first.state.collect { /* Activity rendering owns only this collection. */ } }
            first.live("unused", "unused"); source.awaitEntered()
            // Recreation can create the new Activity before the old onDestroy.
            val replacement = sessions.attach()
            oldView.cancel() // Cancelling view collection cannot cancel process retirement.
            assertNull(first.state.value.mode); assertTrue(first.state.value.recordings.isEmpty())
            assertTrue(source.revoked.get()); assertTrue(replacement.state.value.joining)
            replacement.sample(); yield()
            assertEquals(samples.get(), 0); assertFalse(source.closed.get())
            first.signOut(); first.detach() // Late callbacks from the destroyed Activity are fenced.
            assertTrue(replacement.state.value.joining)
            source.release.countDown(); sessions.awaitIdle()
            assertTrue(source.finished.get()); assertTrue(source.closed.get())
            replacement.sample(); sessions.awaitIdle()
            assertEquals(samples.get(), 1); assertEquals(replacement.state.value.mode, SourceMode.SAMPLE)
            assertTrue(replacement.state.value.recordings.all { it.id.startsWith("rec_sample") })
            first.signOut(); first.detach(); first.sample(); first.back()
            sessions.awaitIdle()
            assertEquals(replacement.state.value.mode, SourceMode.SAMPLE)
            assertNull(first.state.value.mode); assertTrue(first.state.value.recordings.isEmpty())
            replacement.detach(); sessions.awaitIdle()
        } finally { source.release.countDown(); oldView.cancel(); process.cancel() }
    }

    @Test fun failedRetirementSurvivesActivityDetachAndFurtherRecreation() = runBlocking {
        val process = CoroutineScope(coroutineContext + SupervisorJob())
        val source = BlockingSource(failClose = true)
        val factories = AtomicInteger()
        val sessions = LibrarySessions(process, liveFactory = { _, _ -> factories.incrementAndGet(); source },
            sampleFactory = { factories.incrementAndGet(); SampleLibrary() })
        try {
            val first = sessions.attach()
            first.live("unused", "unused"); source.awaitEntered()
            first.detach()
            val replacement = sessions.attach()
            replacement.live("unused", "unused"); replacement.sample()
            assertEquals(factories.get(), 1)
            source.release.countDown(); sessions.awaitIdle()
            assertTrue(replacement.state.value.cleanupFailed)
            assertNull(replacement.state.value.mode)
            replacement.detach()
            val third = sessions.attach()
            sessions.awaitIdle()
            third.live("unused", "unused"); third.sample(); sessions.awaitIdle()
            assertEquals(factories.get(), 1)
            assertTrue(third.state.value.cleanupFailed)
            assertTrue(third.state.value.message.orEmpty().contains("Restart"))
            third.detach(); sessions.awaitIdle()
        } finally { source.release.countDown(); process.cancel() }
    }
}
