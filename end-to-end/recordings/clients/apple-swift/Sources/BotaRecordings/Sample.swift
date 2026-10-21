import Foundation

// Local synthetic DTOs pass through the same decoder. No transport is created.
enum Sample {
    static func api() throws -> LibraryAPI {
        let page = try decode(RecordingPage.self, Data(#"""
        {"data":[
          {"id":"rec_sample_walk","name":"A walk and a few ideas","status":"completed","created_at":"2026-01-15T09:30:00Z","duration_seconds":48,"upload_verified":true},
          {"id":"rec_sample_plan","name":"Planning the weekend","status":"uploaded","created_at":"2026-01-14T16:00:00Z","duration_seconds":32,"upload_verified":true}
        ],"has_more":false,"next_cursor":null}
        """#.utf8))
        let transcript = try decode(Transcript.self, Data(#"""
        {"id":"txn_sample_walk","recording_id":"rec_sample_walk","status":"completed","full_text":"This is a synthetic recording. During a walk I had an idea: make a small shared list of places to visit, then choose one for the weekend. I will add the first three suggestions tonight."}
        """#.utf8))
        let summary = try decode(Summary.self, Data(#"""
        {"id":"sum_sample_walk","recording_id":"rec_sample_walk","transcription_id":"txn_sample_walk","status":"completed","template_id":"tmpl_general_notes","output":{"overview":"A synthetic note about planning a weekend outing.","key_points":["Keep a shared list of places to visit."],"action_items":["Add three suggestions tonight."],"participants":[],"decisions":["Choose an outing from the shared list."]}}
        """#.utf8))
        return LibraryAPI(
            list: { page },
            detail: { id in
                guard let row = page.data.first(where: { $0.id == id }) else { throw LibraryFailure.invalidResponse }
                return row
            },
            transcripts: { id in id == transcript.recordingID ? [transcript] : [] },
            summaries: { id, recording in id == summary.transcriptID && recording == summary.recordingID ? [summary] : [] },
            close: {}
        )
    }
}
