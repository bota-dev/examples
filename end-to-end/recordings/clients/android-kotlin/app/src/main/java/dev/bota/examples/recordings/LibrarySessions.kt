package dev.bota.examples.recordings

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Process-owned reader retirement; all entry points use the same UI dispatcher. */
class LibrarySessions(
    scope: CoroutineScope,
    io: CoroutineDispatcher = Dispatchers.IO,
    liveFactory: (String, String) -> LibrarySource = LiveLibrary::connect,
    sampleFactory: () -> LibrarySource = ::SampleLibrary,
) {
    private val controller = LibraryController(scope, io, liveFactory, sampleFactory)
    private var current: Owner? = null

    init {
        // The process scope has no Activity/context reference and survives view disposal.
        scope.launch { controller.state.collect { current?.publish(it) } }
    }

    fun attach(): Owner {
        current?.let { previous ->
            previous.clear()
            controller.signOut()
        }
        return Owner().also { current = it; it.publish(controller.state.value) }
    }

    /** A retired Activity cannot see later content or sign out a replacement Activity. */
    inner class Owner internal constructor() {
        private val mutable = MutableStateFlow(LibraryState())
        val state: StateFlow<LibraryState> = mutable.asStateFlow()
        internal fun publish(value: LibraryState) { mutable.value = value }
        internal fun clear() { mutable.value = LibraryState() }

        private inline fun act(action: () -> Unit) {
            if (current !== this) return
            action()
            publish(controller.state.value)
        }
        fun sample() = act { controller.sample() }
        fun live(origin: String, token: String) = act { controller.live(origin, token) }
        fun refresh() = act { controller.refresh() }
        fun select(id: String) = act { controller.select(id) }
        fun selectTranscript(id: String) = act { controller.selectTranscript(id) }
        fun back() = act { controller.back() }
        fun signOut(message: String? = null) = act { controller.signOut(message) }
        fun detach() {
            clear()
            if (current !== this) return
            current = null
            controller.signOut()
        }
    }

    /** Test seam: retained retirement and blocking reads finish independently of view scopes. */
    suspend fun awaitIdle() { controller.awaitIdle(); current?.publish(controller.state.value) }
}

/** One authority per process, including the restart-only cleanup-failure latch. */
internal object AppLibrarySessions {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val sessions = LibrarySessions(scope)
    fun attach(): LibrarySessions.Owner = sessions.attach()
}
