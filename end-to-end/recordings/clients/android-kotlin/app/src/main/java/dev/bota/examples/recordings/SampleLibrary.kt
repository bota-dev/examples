package dev.bota.examples.recordings

/** Entirely local, synthetic content. This source constructs no HTTP client. */
class SampleLibrary : LibrarySource {
    private val recordings = listOf(
        Recording("rec_sample1", "Planning a community garden", "completed", "2026-01-01T12:00:00Z", 42.0, true),
        Recording("rec_sample2", "Weekend ideas", "uploaded", "2026-01-02T12:00:00Z", 18.0, true),
    )
    override fun list(cancel: ReadCancellation): RecordingPage { cancel.check(); return RecordingPage(recordings, false) }
    override fun detail(id: String, cancel: ReadCancellation): Recording {
        cancel.check(); return recordings.singleOrNull { it.id == id } ?: invalid()
    }
    override fun transcripts(recordingId: String, cancel: ReadCancellation): List<Transcript> {
        detail(recordingId, cancel)
        return if (recordingId == "rec_sample1") listOf(Transcript("txn_sample1", recordingId, "completed",
            "This is a synthetic conversation. We agreed to ask the neighborhood about a shared garden. Morgan will draft a short invitation.")) else emptyList()
    }
    override fun summaries(transcriptionId: String, recordingId: String, cancel: ReadCancellation): List<Summary> {
        detail(recordingId, cancel)
        if (transcriptionId != "txn_sample1" || recordingId != "rec_sample1") invalid()
        return listOf(Summary("sum_sample1", transcriptionId, recordingId, "completed", Notes(
            "Synthetic example: neighbors discuss starting a community garden.", listOf("Ask neighbors about interest and available space."),
            listOf("Morgan: draft an invitation."), listOf("Morgan", "Sam"), listOf("Gather interest before choosing a location."))))
    }
}
