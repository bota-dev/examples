package dev.bota.examples.recordings

import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.*
import org.testng.Assert.*
import org.testng.annotations.Test

class LibraryControllerTest {
    private fun row(id: String) = Recording(id, "Synthetic", "completed", "2026-01-01T00:00:00Z", 1.0, true)
    private class Gate {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        @Volatile var finished = false
        fun read() { entered.countDown(); check(release.await(5, TimeUnit.SECONDS)); finished = true }
        suspend fun awaitEntered() { assertTrue(withContext(Dispatchers.IO) { entered.await(3, TimeUnit.SECONDS) }) }
    }
    private class SyntheticSource(val rows: List<Recording>, val detailGate: Gate? = null, val listGate: Gate? = null,
        val summaryGate: Gate? = null, val failClose: Boolean = false) : LibrarySource {
        val events = Collections.synchronizedList(mutableListOf<String>())
        @Volatile var revoked = false
        @Volatile var closed = false
        override fun list(cancel: ReadCancellation): RecordingPage {
            events.add("list"); listGate?.read(); return RecordingPage(rows, false)
        }
        override fun detail(id: String, cancel: ReadCancellation): Recording {
            events.add("detail:$id")
            if (id == "rec_a") detailGate?.read() // Deliberately ignores cancellation; host must still join it.
            return rows.single { it.id == id }
        }
        override fun transcripts(recordingId: String, cancel: ReadCancellation): List<Transcript> {
            cancel.check(); events.add("transcripts:$recordingId")
            return listOf(Transcript("txn_${recordingId}", recordingId, "completed", "Synthetic $recordingId"),
                Transcript("txn_second", recordingId, "completed", "Other synthetic transcript"))
        }
        override fun summaries(transcriptionId: String, recordingId: String, cancel: ReadCancellation): List<Summary> {
            cancel.check(); events.add("summary:$transcriptionId"); summaryGate?.read()
            return listOf(Summary("sum_a", transcriptionId, recordingId, "completed", Notes("Synthetic $transcriptionId", emptyList(), emptyList(), emptyList(), emptyList())))
        }
        override fun revoke() { events.add("revoke"); revoked = true }
        override fun close() { events.add("close"); closed = true; if (failClose) error("Synthetic cleanup failure") }
    }
    private suspend fun scope(block: suspend (CoroutineScope) -> Unit) = coroutineScope {
        val owner = CoroutineScope(coroutineContext + SupervisorJob())
        try { block(owner) } finally { owner.cancel() }
    }

    @Test fun staleSelectionWaitsForActualOldReaderAndCannotPublishForeignText() = runBlocking {
        scope { owner ->
            val gate = Gate(); val source = SyntheticSource(listOf(row("rec_a"), row("rec_b")), detailGate = gate)
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle()
            controller.select("rec_a"); gate.awaitEntered()
            controller.select("rec_b")
            assertTrue(controller.state.value.transcripts.isEmpty())
            yield()
            assertFalse(source.events.contains("detail:rec_b"))
            assertTrue(controller.state.value.joining)
            gate.release.countDown(); controller.awaitIdle()
            assertTrue(gate.finished)
            assertEquals(controller.state.value.selected?.id, "rec_b")
            assertEquals(controller.state.value.transcripts.first().recordingId, "rec_b")
            assertTrue(source.events.none { it == "transcripts:rec_a" })
            controller.signOut().join()
        }
    }
    @Test fun signoutClearsImmediatelyAndReplacementCannotStartUntilOldReadReallyFinishes() = runBlocking {
        scope { owner ->
            val gate = Gate(); val old = SyntheticSource(listOf(row("rec_a")), listGate = gate)
            val samples = AtomicInteger()
            val controller = LibraryController(owner, liveFactory = { _, _ -> old }, sampleFactory = { samples.incrementAndGet(); SampleLibrary() })
            controller.live("unused", "unused"); gate.awaitEntered()
            val closed = controller.signOut()
            assertNull(controller.state.value.mode); assertTrue(controller.state.value.recordings.isEmpty()); assertTrue(old.revoked)
            controller.sample(); yield()
            assertEquals(samples.get(), 0); assertFalse(old.closed); assertFalse(closed.isCompleted)
            gate.release.countDown(); closed.join()
            assertTrue(gate.finished); assertTrue(old.closed)
            controller.sample(); controller.awaitIdle()
            assertEquals(samples.get(), 1); assertEquals(controller.state.value.mode, SourceMode.SAMPLE)
            assertTrue(controller.state.value.recordings.all { it.id.startsWith("rec_sample") })
            controller.signOut().join()
        }
    }
    @Test fun backAndTranscriptChangeClearOldNotesBeforeTheirReadCanFinish() = runBlocking {
        scope { owner ->
            val gate = Gate(); val source = SyntheticSource(listOf(row("rec_a")), summaryGate = gate)
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle()
            controller.select("rec_a"); gate.awaitEntered()
            controller.back(); assertNull(controller.state.value.selected); assertTrue(controller.state.value.summaries.isEmpty())
            gate.release.countDown(); controller.awaitIdle()
            assertNull(controller.state.value.selected); assertTrue(controller.state.value.transcripts.isEmpty())
            controller.select("rec_a"); controller.awaitIdle()
            assertTrue(controller.state.value.summaries.isNotEmpty())
            controller.selectTranscript("txn_second")
            assertTrue(controller.state.value.summaries.isEmpty())
            controller.awaitIdle()
            assertEquals(controller.state.value.summaries.single().transcriptionId, "txn_second")
            controller.signOut().join()
        }
    }
    @Test fun foreignRecordingAndTranscriptSelectionsNeverInvokeSource() = runBlocking {
        scope { owner ->
            val source = SyntheticSource(listOf(row("rec_a")))
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle()
            controller.select("rec_foreign"); controller.awaitIdle()
            assertEquals(source.events.toList(), listOf("list"))
            controller.select("rec_a"); controller.awaitIdle()
            val count = source.events.size
            controller.selectTranscript("txn_foreign"); controller.awaitIdle()
            assertEquals(source.events.size, count)
            controller.signOut().join()
        }
    }
    @Test fun unauthorizedLiveReadSignsOutAndRevokesFurtherAdmission() = runBlocking {
        scope { owner -> TestBackend { response(it, "{}", 401) }.use { backend ->
            val controller = LibraryController(owner)
            controller.live(backend.origin, TEST_TOKEN); controller.awaitIdle()
            assertNull(controller.state.value.mode); assertTrue(controller.state.value.recordings.isEmpty())
            assertFalse(controller.state.value.joining)
            assertTrue(controller.state.value.message.orEmpty().contains("expired"))
        } }
    }
    @Test fun staleSelection401ExpiresItsAuthOwnerBeforeAnotherReadCanStart() = runBlocking {
        scope { owner ->
            val gate = Gate(); val expired = AtomicBoolean()
            val base = SyntheticSource(listOf(row("rec_a"), row("rec_b")))
            val source = object : LibrarySource by base {
                override val sessionExpired: Boolean get() = expired.get()
                override fun detail(id: String, cancel: ReadCancellation): Recording {
                    if (id == "rec_a") { gate.read(); expired.set(true); throw LibraryFailure(Failure.UNAUTHORIZED) }
                    return base.detail(id, cancel)
                }
            }
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle()
            controller.select("rec_a"); gate.awaitEntered()
            controller.select("rec_b"); gate.release.countDown(); controller.awaitIdle()
            assertNull(controller.state.value.mode)
            assertTrue(controller.state.value.message.orEmpty().contains("expired"))
            assertFalse(base.events.contains("detail:rec_b"), "Selection cancellation cannot hide an observed auth rejection")
            assertTrue(base.closed)
        }
    }
    @Test fun late401FromRetiredAuthOwnerCannotExpireReplacementSample() = runBlocking {
        scope { owner ->
            val gate = Gate(); val expired = AtomicBoolean()
            val base = SyntheticSource(listOf(row("rec_a")))
            val source = object : LibrarySource by base {
                override val sessionExpired: Boolean get() = expired.get()
                override fun detail(id: String, cancel: ReadCancellation): Recording {
                    gate.read(); expired.set(true); throw LibraryFailure(Failure.UNAUTHORIZED)
                }
            }
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle()
            controller.select("rec_a"); gate.awaitEntered()
            val retirement = controller.signOut(); gate.release.countDown(); retirement.join()
            assertFalse(controller.state.value.message.orEmpty().contains("expired"))
            controller.sample(); controller.awaitIdle()
            assertEquals(controller.state.value.mode, SourceMode.SAMPLE)
            assertTrue(controller.state.value.recordings.all { it.id.startsWith("rec_sample") })
            controller.signOut().join()
        }
    }
    @Test fun realTransportReaderFinalizesBeforeSignoutAdmitsSample() = runBlocking {
        scope { owner ->
            val entered = CountDownLatch(1); val release = CountDownLatch(1); val finished = AtomicBoolean()
            TestBackend { request ->
                request.responseHeaders.add("Content-Type", "application/json"); request.sendResponseHeaders(200, 0)
                request.responseBody.write('{'.code); request.responseBody.flush(); entered.countDown()
                release.await(3, TimeUnit.SECONDS)
            }.use { backend ->
                val api = LiveLibrary.connect(backend.origin, TEST_TOKEN)
                val observed = object : LibrarySource by api {
                    override fun list(cancel: ReadCancellation): RecordingPage = try { api.list(cancel) } finally { finished.set(true) }
                }
                val controller = LibraryController(owner, liveFactory = { _, _ -> observed },
                    sampleFactory = { assertTrue(finished.get()); SampleLibrary() })
                controller.live("unused", "unused")
                assertTrue(withContext(Dispatchers.IO) { entered.await(2, TimeUnit.SECONDS) })
                controller.signOut().join()
                assertTrue(finished.get(), "Signout joined execute()/body cleanup")
                controller.sample(); controller.awaitIdle()
                assertEquals(controller.state.value.mode, SourceMode.SAMPLE)
                controller.signOut().join(); release.countDown()
            }
        }
    }
    @Test fun sampleModeUsesNoCredentialsOrLiveFactoryAndReadsOrdinaryContent() = runBlocking {
        scope { owner ->
            val controller = LibraryController(owner, liveFactory = { _, _ -> error("Sample must never construct a live source") })
            controller.sample(); controller.awaitIdle()
            assertEquals(controller.state.value.mode, SourceMode.SAMPLE)
            controller.select("rec_sample1"); controller.awaitIdle()
            assertTrue(controller.state.value.transcripts.single().text.orEmpty().contains("synthetic"))
            assertNotNull(controller.state.value.summaries.single().notes)
            controller.signOut().join()
        }
    }
    @Test fun failedFinalCleanupPermanentlyRefusesAnotherSession() = runBlocking {
        scope { owner ->
            val source = SyntheticSource(listOf(row("rec_a")), failClose = true)
            val controller = LibraryController(owner, liveFactory = { _, _ -> source })
            controller.live("unused", "unused"); controller.awaitIdle(); controller.signOut().join()
            controller.sample(); controller.awaitIdle()
            assertTrue(controller.state.value.cleanupFailed); assertNull(controller.state.value.mode)
        }
    }
}
