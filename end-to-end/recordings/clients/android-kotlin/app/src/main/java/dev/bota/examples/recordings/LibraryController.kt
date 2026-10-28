package dev.bota.examples.recordings

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class SourceMode { SAMPLE, LIVE }
data class LibraryState(
    val mode: SourceMode? = null,
    val recordings: List<Recording> = emptyList(), val hasMore: Boolean = false,
    val selected: Recording? = null, val transcripts: List<Transcript> = emptyList(),
    val transcriptId: String? = null, val summaries: List<Summary> = emptyList(),
    val busy: Boolean = false, val joining: Boolean = false, val cleanupFailed: Boolean = false,
    val message: String? = null,
)

/** Call events from one UI dispatcher. Each transition fences immediately, then joins real work. */
class LibraryController(
    private val scope: CoroutineScope,
    private val io: CoroutineDispatcher = Dispatchers.IO,
    private val liveFactory: (String, String) -> LibrarySource = LiveLibrary::connect,
    private val sampleFactory: () -> LibrarySource = ::SampleLibrary,
) {
    private val mutable = MutableStateFlow(LibraryState())
    val state: StateFlow<LibraryState> = mutable.asStateFlow()
    private var generation = 0L
    private var source: LibrarySource? = null
    private var read: Job? = null
    private var cancellation: ReadCancellation? = null
    private var lifecycle: Job? = null
    private var cleanupFailed = false

    fun sample() = start(SourceMode.SAMPLE, sampleFactory)
    fun live(origin: String, token: String) = start(SourceMode.LIVE) { liveFactory(origin, token) }
    private fun start(mode: SourceMode, factory: () -> LibrarySource) {
        if (state.value.mode != null || state.value.joining || cleanupFailed) return
        val next = try { factory() } catch (_: Exception) {
            mutable.value = LibraryState(message = "Enter an HTTPS backend origin and a separate application token (32–256 characters).")
            return
        }
        source = next
        generation++
        mutable.value = LibraryState(mode = mode, busy = true)
        loadList(generation, next)
    }

    fun signOut(message: String? = null): Job {
        generation++
        val revision = generation
        val old = source
        // Clear UI and credentials before any suspension or replacement admission.
        try { old?.revoke() } catch (_: Exception) { cleanupFailed = true }
        mutable.value = LibraryState(joining = true, cleanupFailed = cleanupFailed, message = message)
        cancellation?.cancel(); read?.cancel()
        val previous = lifecycle
        return scope.launch {
            previous?.join()
            read?.join() // withContext waits for the actual blocking call/body finally, not a cancelled Future.
            if (source === old) {
                try { withContext(io) { old?.close() } } catch (_: Exception) { cleanupFailed = true }
                source = null
            }
            if (generation == revision) mutable.value = LibraryState(cleanupFailed = cleanupFailed,
                message = if (cleanupFailed) "Session cleanup failed. Restart the app before connecting again." else message)
        }.also { lifecycle = it }
    }

    private fun transition(next: LibraryState, action: (Long, LibrarySource) -> Unit) {
        val owner = source ?: return
        generation++
        val revision = generation
        mutable.value = next.copy(busy = true, joining = true, message = null)
        cancellation?.cancel(); read?.cancel()
        val previous = lifecycle
        lifecycle = scope.launch {
            previous?.join()
            read?.join()
            if (generation != revision || source !== owner) return@launch
            mutable.value = mutable.value.copy(joining = false)
            action(revision, owner)
        }
    }

    fun refresh() {
        val snapshot = state.value
        if (snapshot.mode == null) return
        if (snapshot.selected != null) select(snapshot.selected.id) else
            transition(LibraryState(mode = snapshot.mode), ::loadList)
    }
    fun select(id: String) {
        val snapshot = state.value
        val row = snapshot.recordings.singleOrNull { it.id == id } ?: return
        transition(snapshot.copy(selected = row, transcripts = emptyList(), transcriptId = null, summaries = emptyList())) { revision, owner ->
            read(revision, owner, block = { cancel ->
                val detail = owner.detail(id, cancel)
                val transcripts = owner.transcripts(id, cancel)
                val selected = transcripts.firstOrNull { it.status == "completed" } ?: transcripts.firstOrNull()
                val summaries = selected?.let { owner.summaries(it.id, id, cancel) } ?: emptyList()
                Detail(detail, transcripts, selected?.id, summaries)
            }) { result -> copy(selected = result.recording, transcripts = result.transcripts,
                transcriptId = result.transcriptId, summaries = result.summaries) }
        }
    }
    fun selectTranscript(id: String) {
        val snapshot = state.value
        val recording = snapshot.selected ?: return
        if (snapshot.transcripts.none { it.id == id } || snapshot.transcriptId == id) return
        transition(snapshot.copy(transcriptId = id, summaries = emptyList())) { revision, owner ->
            read(revision, owner, { owner.summaries(id, recording.id, it) }) { copy(summaries = it) }
        }
    }
    fun back() {
        val snapshot = state.value
        if (snapshot.selected == null) return
        transition(snapshot.copy(selected = null, transcripts = emptyList(), transcriptId = null, summaries = emptyList())) { _, _ ->
            mutable.value = mutable.value.copy(busy = false)
        }
    }
    private fun loadList(revision: Long, owner: LibrarySource) =
        read(revision, owner, owner::list) { copy(recordings = it.data, hasMore = it.hasMore) }

    private fun <T> read(revision: Long, owner: LibrarySource, block: (ReadCancellation) -> T,
        apply: LibraryState.(T) -> LibraryState) {
        val cancel = ReadCancellation()
        cancellation = cancel
        read = scope.launch {
            try {
                val result = withContext(io) { block(cancel) }
                ensureActive()
                if (generation == revision && source === owner) mutable.value = state.value.apply(result).copy(busy = false)
            } catch (_: CancellationException) {
                expireCurrentOwner(owner)
            }
            catch (error: Exception) {
                if (expireCurrentOwner(owner, error is LibraryFailure && error.failure == Failure.UNAUTHORIZED)) return@launch
                if (generation != revision || source !== owner) return@launch
                mutable.value = state.value.copy(busy = false, transcripts = emptyList(),
                    transcriptId = null, summaries = emptyList(), message = "This read could not be verified. Refresh to try again.")
            }
        }
    }
    private fun expireCurrentOwner(owner: LibrarySource, observed: Boolean = false): Boolean {
        // Auth ownership is wider than selection ownership. A rejected token stays
        // rejected even if the user changed selection while this read was ending.
        if (source === owner && state.value.mode != null && (observed || owner.sessionExpired)) {
            signOut("The app session expired. Connect again.")
            return true
        }
        return false
    }
    private data class Detail(val recording: Recording, val transcripts: List<Transcript>, val transcriptId: String?, val summaries: List<Summary>)

    /** Test/lifecycle seam: waits for transitions and the latest read without advancing the app. */
    suspend fun awaitIdle() { lifecycle?.join(); read?.join(); lifecycle?.join() }
}
