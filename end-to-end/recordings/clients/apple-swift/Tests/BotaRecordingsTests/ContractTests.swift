import Foundation
import XCTest
@testable import BotaRecordings

final class ContractTests: XCTestCase {
    func json(_ value: Any) throws -> Data { try JSONSerialization.data(withJSONObject: value) }
    var row: [String: Any] { ["id": "rec_one", "name": NSNull(), "status": "completed", "created_at": "2026-01-15T09:30:00Z", "duration_seconds": NSNull(), "upload_verified": true] }
    func testConfigurationRejectsAuthorityEscapesAndBotaCredentials() throws {
        let token = String(repeating: "a", count: 32)
        for origin in ["http://backend.example", "https://user:pass@backend.example", "https://backend.example/api", "https://backend.example/%2f", "https://backend.example?x=1", "https://backend.example#x", "https://backend.example\\@localhost", "http://127.0.0.2", "http://localhost.evil", "file:///tmp/test"] {
            XCTAssertThrowsError(try BackendConfiguration(origin: origin, token: token), origin)
        }
        for bad in ["short", String(repeating: "a", count: 257), "sk_" + token, "rk_" + token, "dtok_" + token, "up_" + token, "rct_" + token, token + "\r\nHeader:value", token + "é", token + " a", token + " "] {
            XCTAssertThrowsError(try BackendConfiguration(origin: "https://backend.example", token: bad))
        }
        for origin in ["https://backend.example/", "http://127.0.0.1:8787", "http://localhost:8787", "http://[::1]:8787"] {
            XCTAssertNoThrow(try BackendConfiguration(origin: origin, token: token))
        }
    }
    func testRequiredNullableFieldsAndUTF16Caps() throws {
        XCTAssertNoThrow(try decode(Recording.self, json(row)))
        for key in ["name", "duration_seconds", "upload_verified"] {
            var value = row; value.removeValue(forKey: key)
            XCTAssertThrowsError(try decode(Recording.self, json(value)))
        }
        var value = row; value["name"] = String(repeating: "😀", count: 128)
        XCTAssertThrowsError(try decode(Recording.self, json(value)))
        value["name"] = String(repeating: "😀", count: 127)
        XCTAssertNoThrow(try decode(Recording.self, json(value)))
        for invalid in ["foreign", "rec_", "rec_../other", "rec_é", "rec_one\n", "rec_one\r\n", "rec_one\u{2028}"] {
            value["id"] = invalid
            XCTAssertThrowsError(try decode(Recording.self, json(value)))
        }
    }
    func testAllResourcePrefixesRejectLineTerminators() throws {
        for suffix in ["\n", "\r\n", "\u{2028}", "\u{2029}"] {
            for prefix in ["rec", "txn", "sum"] { XCTAssertFalse(Contract.id("\(prefix)_one" + suffix, prefix)) }
            let transcript: [String: Any] = ["id": "txn_one" + suffix, "recording_id": "rec_one", "status": "pending"]
            XCTAssertThrowsError(try decode(Transcript.self, json(transcript)))
            let summary: [String: Any] = ["id": "sum_one" + suffix, "transcription_id": "txn_one", "recording_id": "rec_one", "status": "pending", "template_id": "tmpl_general_notes"]
            XCTAssertThrowsError(try decode(Summary.self, json(summary)))
        }
    }
    func testBoundedPagesRequireUniqueRowsAndConsistentCursor() throws {
        for page: [String: Any] in [
            ["data": [row, row], "has_more": false, "next_cursor": NSNull()],
            ["data": [], "has_more": true, "next_cursor": "cursor"],
            ["data": [row], "has_more": true, "next_cursor": NSNull()],
            ["data": [row], "has_more": false, "next_cursor": "cursor"],
            ["data": [row], "has_more": true, "next_cursor": "bad\n"],
            ["data": [row], "has_more": false],
        ] { XCTAssertThrowsError(try decode(RecordingPage.self, json(page))) }
        let rows = (0..<21).map { index in var row = self.row; row["id"] = "rec_\(index)"; return row }
        XCTAssertThrowsError(try decode(RecordingPage.self, json(["data": rows, "has_more": false, "next_cursor": NSNull()])))
        XCTAssertNoThrow(try decode(RecordingPage.self, json(["data": [row], "has_more": true, "next_cursor": "cursor"])))
    }
    func testOnlyCompletedBoundedContentIsRendered() throws {
        var transcript: [String: Any] = ["id": "txn_one", "recording_id": "rec_one", "status": "pending", "full_text": ["not": "text"]]
        XCTAssertNil(try decode(Transcript.self, json(transcript)).text)
        transcript["status"] = "completed"
        XCTAssertThrowsError(try decode(Transcript.self, json(transcript)))
        transcript["full_text"] = String(repeating: "😀", count: 500_001)
        XCTAssertThrowsError(try decode(Transcript.self, json(transcript)))
        transcript["full_text"] = "<script>inert plain text</script>"
        XCTAssertEqual(try decode(Transcript.self, json(transcript)).text, "<script>inert plain text</script>")
        var notes: [String: Any] = ["overview": "Notes", "key_points": [], "action_items": [], "participants": [], "decisions": []]
        notes["overview"] = String(repeating: "😀", count: 5_001)
        XCTAssertThrowsError(try decode(Notes.self, json(notes)))
        notes["overview"] = "Notes"; notes["decisions"] = Array(repeating: "decision", count: 201)
        XCTAssertThrowsError(try decode(Notes.self, json(notes)))
        XCTAssertThrowsError(try decode(Recording.self, Data([0x7b, 0xff, 0x7d])))
        XCTAssertThrowsError(try decode(Recording.self, Data("not JSON".utf8)))
    }
}
