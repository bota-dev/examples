package dev.bota.examples.recordings

import android.app.Activity
import android.annotation.SuppressLint
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.WindowManager
import android.window.OnBackInvokedDispatcher
import android.widget.*
import kotlinx.coroutines.*

/** Ordinary recording UI. All integration calls and ownership rules live outside the Activity. */
class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val controller = AppLibrarySessions.attach()
    private lateinit var content: LinearLayout
    private var origin: EditText? = null
    private var token: EditText? = null
    private var tab = "Transcript"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        val scroll = ScrollView(this).apply { fitsSystemWindows = true }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24.dp, 24.dp, 24.dp, 32.dp)
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
        scroll.addView(content)
        setContentView(scroll)
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
        }
        scope.launch { controller.state.collect { render(it) } }
    }
    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
    private fun text(value: String, size: Float = 16f) = TextView(this).apply {
        text = value; textSize = size; setPadding(0, 8.dp, 0, 8.dp); isSaveEnabled = false
    }.also { content.addView(it) }
    private fun button(label: String, enabled: Boolean = true, action: () -> Unit) {
        content.addView(Button(this).apply { text = label; isEnabled = enabled; setOnClickListener { action() } })
    }
    private fun field(hintText: String, secret: Boolean = false) = EditText(this).apply {
        hint = hintText; isSingleLine = true; isSaveEnabled = false
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS or
            if (secret) InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_TEXT_VARIATION_URI
        importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
        content.addView(this)
    }
    private fun clearCredentialFields() { origin?.text?.clear(); token?.text?.clear(); origin = null; token = null }
    private fun render(state: LibraryState) {
        clearCredentialFields()
        content.removeAllViews()
        text("Bota Recordings", 28f)
        if (state.mode == null) {
            text("Browse recordings, read transcripts and revisit notes.")
            if (state.joining) text("Closing the previous session…")
            text(state.message ?: "Try a local sample or connect to your application.")
            button("Try Sample", !state.joining && !state.cleanupFailed) { tab = "Transcript"; controller.sample() }
            text("Live", 22f)
            origin = field("Backend origin — https://your-app.example")
            token = field("Separate application token", secret = true)
            button("Connect", !state.joining && !state.cleanupFailed) {
                val originValue = origin?.text?.toString().orEmpty()
                val tokenValue = token?.text?.toString().orEmpty()
                clearCredentialFields()
                tab = "Transcript"
                controller.live(originValue, tokenValue)
            }
            return
        }
        text(if (state.mode == SourceMode.SAMPLE) "Sample · synthetic content · no network" else "Live · your application")
        button("Sign out") { controller.signOut() }
        state.message?.let { text(it) }
        if (state.busy) text("Loading…")
        val recording = state.selected
        if (recording == null) {
            button("Refresh recordings", !state.busy) { controller.refresh() }
            text("Your recordings", 22f)
            if (!state.busy && state.recordings.isEmpty()) text("No recordings in this snapshot.")
            state.recordings.forEach { row ->
                button("${row.name ?: "Untitled recording"}\n${row.createdAt.take(10)} · ${row.status}", !state.joining) {
                    tab = "Transcript"; controller.select(row.id)
                }
            }
            if (state.hasMore) text("Showing the first 20 recordings. More recordings exist; this starter does not load later pages.")
        } else {
            button("Back to recordings") { controller.back() }
            text(recording.name ?: "Untitled recording", 24f)
            text("${recording.createdAt.take(10)} · ${recording.status}")
            button("Refresh recording", !state.busy) { controller.refresh() }
            if (state.transcripts.size > 1) {
                text("Transcripts", 20f)
                state.transcripts.forEachIndexed { index, transcript ->
                    button("Transcript ${index + 1} · ${transcript.status}", !state.busy && transcript.id != state.transcriptId) {
                        controller.selectTranscript(transcript.id)
                    }
                }
            }
            button("Transcript", tab != "Transcript") { tab = "Transcript"; render(controller.state.value) }
            button("Notes", tab != "Notes") { tab = "Notes"; render(controller.state.value) }
            val transcript = state.transcripts.singleOrNull { it.id == state.transcriptId }
            if (tab == "Transcript") {
                text("Transcript", 22f)
                text(transcript?.text ?: if (transcript == null) "No transcript is available." else "Transcript ${transcript.status}.")
            } else {
                text("General notes", 22f)
                val summary = state.summaries.firstOrNull { it.status == "completed" } ?: state.summaries.firstOrNull()
                val notes = summary?.notes
                if (notes == null) text(if (summary == null) "No notes are available for this transcript." else "Notes ${summary.status}.") else {
                    text(notes.overview)
                    listOf("Key points" to notes.keyPoints, "Action items" to notes.actionItems,
                        "Participants" to notes.participants, "Decisions" to notes.decisions).forEach { (title, lines) ->
                        if (lines.isNotEmpty()) { text(title, 20f); lines.forEach { text("• $it") } }
                    }
                }
            }
        }
    }
    override fun onStop() {
        clearCredentialFields()
        controller.signOut("Session cleared when the app left the foreground.")
        render(controller.state.value)
        super.onStop()
    }
    override fun onDestroy() {
        controller.detach()
        scope.cancel() // View collection ends; process-owned reader retirement keeps running.
        super.onDestroy()
    }
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.clear() // Credentials/content are never restored by Android saved-view state.
    }
    @Deprecated("Uses the ordinary library back action")
    @SuppressLint("GestureBackNavigation") // API33+ uses the native callback above; this is the API29–32 fallback.
    override fun onBackPressed() = back()
    private fun back() { if (controller.state.value.selected != null) controller.back() else finish() }
}
