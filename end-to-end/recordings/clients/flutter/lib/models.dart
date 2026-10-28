typedef Json = Map<String, dynamic>;

Json object(Object? value) {
  if (value is! Json) throw const FormatException('Expected an object.');
  return value;
}

String text(Object? value, {int max = 1000000}) {
  if (value is! String || value.length > max) {
    throw const FormatException('Invalid text.');
  }
  return value;
}

String validatedId(Object? value) {
  final result = text(value, max: 256);
  if (!RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(result)) {
    throw const FormatException('Invalid identifier.');
  }
  return result;
}

List<T> collection<T>(Object? value, T Function(Json) parse) {
  final data = object(value)['data'];
  if (data is! List || data.length > 500) {
    throw const FormatException('Invalid collection.');
  }
  return data.map((row) => parse(object(row))).toList();
}

class Recording {
  Recording.fromJson(Json row)
    : id = validatedId(row['id']),
      name = row['name'] == null ? null : text(row['name'], max: 1000),
      status = text(row['status'], max: 64),
      createdAt = DateTime.parse(text(row['created_at'], max: 64)),
      durationSeconds = row['duration_seconds'] == null
          ? null
          : (row['duration_seconds'] as num).toDouble(),
      uploadVerified = row['upload_verified'] as bool;
  final String id;
  final String? name;
  final String status;
  final DateTime createdAt;
  final double? durationSeconds;
  final bool uploadVerified;
  String get title =>
      name == null || name!.isEmpty ? 'Untitled recording' : name!;
}

class Transcript {
  Transcript.fromJson(Json row)
    : id = validatedId(row['id']),
      recordingId = validatedId(row['recording_id']),
      status = text(row['status'], max: 64),
      fullText = row['full_text'] == null ? null : text(row['full_text']);
  final String id;
  final String recordingId;
  final String status;
  final String? fullText;
}

class Summary {
  Summary.fromJson(Json row)
    : id = validatedId(row['id']),
      recordingId = validatedId(row['recording_id']),
      transcriptionId = validatedId(row['transcription_id']),
      status = text(row['status'], max: 64),
      templateId = validatedId(row['template_id']),
      output = row['output'] == null ? null : object(row['output']) {
    if (templateId != 'tmpl_general_notes') {
      throw const FormatException('This template displays general notes only.');
    }
  }
  final String id;
  final String recordingId;
  final String transcriptionId;
  final String status;
  final String templateId;
  final Json? output;
  String? get overview =>
      output?['overview'] == null ? null : text(output!['overview']);
  List<String> lines(String key) {
    final value = output?[key];
    if (value == null) return [];
    if (value is! List || value.length > 1000) {
      throw const FormatException('Invalid summary.');
    }
    return value.map((item) => text(item)).toList();
  }
}

class Operation {
  Operation.fromJson(Json row)
    : id = validatedId(row['id']),
      kind = text(row['kind'], max: 32),
      state = text(row['state'], max: 32),
      resourceId = row['resource_id'] == null
          ? null
          : validatedId(row['resource_id']),
      updatedAt = DateTime.parse(text(row['updated_at'], max: 64)) {
    if (!['upload', 'transcription', 'summary', 'ask'].contains(kind) ||
        ![
          'claimed',
          'creating',
          'created',
          'uploading',
          'verifying',
          'verification_pending',
          'starting',
          'sending',
          'submitted',
          'complete',
          'uncertain',
        ].contains(state)) {
      throw const FormatException('Invalid operation.');
    }
  }
  final String id;
  final String kind;
  final String state;
  final String? resourceId;
  final DateTime updatedAt;
}

class Answer {
  Answer.fromJson(Json row, String recordingId)
    : answer = row['answer'] == null ? null : text(row['answer']),
      citations = _citations(row['citations'], recordingId);
  final String? answer;
  final List<Duration> citations;
  static List<Duration> _citations(Object? value, String recordingId) {
    if (value == null) return [];
    if (value is! List || value.length > 1000) {
      throw const FormatException('Invalid citations.');
    }
    return value.map((entry) {
      final row = object(entry);
      final time = row['start_ms'];
      if (row['recording_id'] != recordingId || time is! int || time < 0) {
        throw const FormatException('Citation belongs to another recording.');
      }
      return Duration(milliseconds: time);
    }).toList();
  }
}
