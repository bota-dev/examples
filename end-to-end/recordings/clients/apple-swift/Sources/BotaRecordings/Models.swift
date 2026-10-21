import Foundation

enum LibraryFailure: Error, Equatable {
    case configuration, invalidResponse, unavailable, unauthorized, network, cleanup

    var message: String {
        switch self {
        case .configuration: "Enter an HTTPS backend origin and a separate 32–256 character application token."
        case .invalidResponse: "The backend response could not be verified. Refresh to read current results."
        case .unavailable: "This read is unavailable. Check the customer backend and current recording access."
        case .unauthorized: "The application token was rejected. Connect again."
        case .network: "The read was interrupted. Check connectivity, then refresh explicitly."
        case .cleanup: "Reader cleanup failed. Restart the application before opening another session."
        }
    }
}

enum Contract {
    static func id(_ value: String, _ prefix: String) -> Bool {
        value.range(of: "\\A\(prefix)_[A-Za-z0-9_-]{1,128}\\z", options: .regularExpression) != nil
    }
    static func timestamp(_ value: String) -> Bool {
        guard value.utf16.count <= 64, value.contains("T") else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: value) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value) != nil
    }
    static func require(_ condition: Bool) throws {
        if !condition { throw LibraryFailure.invalidResponse }
    }
    static func unique<T: Identifiable>(_ rows: [T], max: Int) throws where T.ID: Hashable {
        try require(rows.count <= max && Set(rows.map(\.id)).count == rows.count)
    }
}

struct Recording: Decodable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String?
    let status: String
    let createdAt: String
    let durationSeconds: Double?
    let uploadVerified: Bool
    enum CodingKeys: String, CodingKey {
        case id, name, status, createdAt = "created_at", durationSeconds = "duration_seconds", uploadVerified = "upload_verified"
    }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String?.self, forKey: .name)
        status = try c.decode(String.self, forKey: .status)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        durationSeconds = try c.decode(Double?.self, forKey: .durationSeconds)
        uploadVerified = try c.decode(Bool.self, forKey: .uploadVerified)
        try Contract.require(Contract.id(id, "rec") && (name?.utf16.count ?? 0) <= 255 && Contract.timestamp(createdAt))
        try Contract.require(["pending", "streaming", "uploaded", "processing", "completed", "failed", "integrity_failure"].contains(status))
        if let durationSeconds { try Contract.require(durationSeconds.isFinite && durationSeconds >= 0) }
    }
}

struct RecordingPage: Decodable, Sendable {
    let data: [Recording]
    let hasMore: Bool
    let nextCursor: String?
    enum CodingKeys: String, CodingKey { case data, hasMore = "has_more", nextCursor = "next_cursor" }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        data = try c.decode([Recording].self, forKey: .data)
        hasMore = try c.decode(Bool.self, forKey: .hasMore)
        nextCursor = try c.decode(String?.self, forKey: .nextCursor)
        try Contract.unique(data, max: 20)
        if let nextCursor {
            try Contract.require(!nextCursor.isEmpty && nextCursor.utf16.count <= 1024 &&
                !nextCursor.unicodeScalars.contains { $0.value < 32 || $0.value == 127 })
        }
        try Contract.require(hasMore ? !data.isEmpty && nextCursor != nil : nextCursor == nil)
    }
}

enum JobStatus: String, Decodable, Sendable { case pending, processing, completed, failed }

struct Transcript: Decodable, Identifiable, Equatable, Sendable {
    let id: String
    let recordingID: String
    let status: JobStatus
    let text: String?
    enum CodingKeys: String, CodingKey { case id, recordingID = "recording_id", status, text = "full_text", createdAt = "created_at" }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        recordingID = try c.decode(String.self, forKey: .recordingID)
        status = try c.decode(JobStatus.self, forKey: .status)
        try Contract.require(Contract.id(id, "txn") && Contract.id(recordingID, "rec"))
        if let created = try c.decodeIfPresent(String.self, forKey: .createdAt) { try Contract.require(Contract.timestamp(created)) }
        text = status == .completed ? try c.decode(String.self, forKey: .text) : nil
        if let text { try Contract.require(text.utf16.count <= 1_000_000) }
    }
}

struct Notes: Decodable, Equatable, Sendable {
    let overview: String
    let keyPoints: [String]
    let actionItems: [String]
    let participants: [String]
    let decisions: [String]
    enum CodingKeys: String, CodingKey {
        case overview, keyPoints = "key_points", actionItems = "action_items", participants, decisions
    }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        overview = try c.decode(String.self, forKey: .overview)
        keyPoints = try c.decode([String].self, forKey: .keyPoints)
        actionItems = try c.decode([String].self, forKey: .actionItems)
        participants = try c.decode([String].self, forKey: .participants)
        decisions = try c.decode([String].self, forKey: .decisions)
        try Contract.require(overview.utf16.count <= 10_000)
        for items in [keyPoints, actionItems, participants, decisions] {
            try Contract.require(items.count <= 200 && items.allSatisfy { $0.utf16.count <= 10_000 })
        }
    }
}

struct Summary: Decodable, Identifiable, Equatable, Sendable {
    let id: String
    let recordingID: String
    let transcriptID: String
    let status: JobStatus
    let output: Notes?
    enum CodingKeys: String, CodingKey { case id, recordingID = "recording_id", transcriptID = "transcription_id", status, templateID = "template_id", output }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        recordingID = try c.decode(String.self, forKey: .recordingID)
        transcriptID = try c.decode(String.self, forKey: .transcriptID)
        status = try c.decode(JobStatus.self, forKey: .status)
        let templateID = try c.decode(String.self, forKey: .templateID)
        try Contract.require(Contract.id(id, "sum") && Contract.id(recordingID, "rec") && Contract.id(transcriptID, "txn") &&
            templateID == "tmpl_general_notes")
        output = status == .completed ? try c.decode(Notes.self, forKey: .output) : nil
    }
}

struct Collection<Row: Decodable & Sendable>: Decodable, Sendable { let data: [Row] }

func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
    guard String(data: data, encoding: .utf8) != nil else { throw LibraryFailure.invalidResponse }
    do { return try JSONDecoder().decode(type, from: data) }
    catch { throw LibraryFailure.invalidResponse }
}
