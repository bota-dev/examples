import 'models.dart';
import 'api.dart';

/// Local, disposable fixtures. No HTTP, provider calls or device initialization.
class SampleApi implements RecordingsApi {
  final _recordings = <Json>[
    {
      'id': 'rec_sample1',
      'name': 'Team catch-up',
      'status': 'uploaded',
      'created_at': '2026-10-12T09:00:00Z',
      'duration_seconds': 42,
      'upload_verified': true,
    },
    {
      'id': 'rec_sample2',
      'name': 'Planning notes',
      'status': 'uploaded',
      'created_at': '2026-10-11T09:00:00Z',
      'duration_seconds': 65,
      'upload_verified': true,
    },
  ];
  final _transcripts = <String, Json>{};
  final _summaries = <String, Json>{};
  final _operations = <String, Json>{};
  int _sequence = 0;
  bool _closed = false;

  Json _operation(String kind, String resource) {
    final row = <String, dynamic>{
      'id': 'sample_${++_sequence}',
      'kind': kind,
      'state': 'complete',
      'resource_id': resource,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    };
    _operations[row['id']] = row;
    return row;
  }

  void _check() {
    if (_closed) {
      throw const ApiException(401, 'closed', 'The sample session ended.');
    }
  }

  @override
  Future<Json> get(String path) async {
    _check();
    final parts = path.split('/');
    if (path == '/api/library/recordings') {
      return {'data': _recordings, 'has_more': false, 'next_cursor': null};
    }
    if (path == '/api/library/operations') {
      return {'data': _operations.values.toList()};
    }
    if (parts.length == 5 && parts[3] == 'operations') {
      final row = _operations[parts[4]];
      if (row != null) return {'operation': row};
    }
    if (parts.length == 5 && parts[3] == 'recordings') {
      for (final row in _recordings) {
        if (row['id'] == parts[4]) return row;
      }
    }
    if (parts.length == 6 &&
        parts[3] == 'recordings' &&
        parts[5] == 'transcriptions') {
      final row = _transcripts[parts[4]];
      return {
        'data': row == null ? [] : [row],
      };
    }
    if (parts.length == 6 &&
        parts[3] == 'transcriptions' &&
        parts[5] == 'summaries') {
      final row = _summaries[parts[4]];
      return {
        'data': row == null ? [] : [row],
      };
    }
    throw const ApiException(
      404,
      'not_found',
      'The sample recording was not found.',
    );
  }

  @override
  Future<Json> post(String path, Json body) async {
    _check();
    final parts = path.split('/');
    if (parts.length == 6 &&
        parts[3] == 'recordings' &&
        parts[5] == 'transcriptions') {
      final recording = parts[4];
      final row = _transcripts.putIfAbsent(
        recording,
        () => {
          'id': 'txn_$recording',
          'recording_id': recording,
          'status': 'completed',
          'full_text':
              'We agreed to prepare the release notes and share a short update. '
              'Alex will draft the notes, and Sam will review them on Friday. '
              'These are synthetic sample recordings.',
        },
      );
      return {
        'operation': _operation('transcription', row['id']),
        'transcription': row,
      };
    }
    if (parts.length == 6 &&
        parts[3] == 'transcriptions' &&
        parts[5] == 'summaries') {
      final transcription = parts[4];
      final row = _summaries.putIfAbsent(
        transcription,
        () => {
          'id': 'sum_$transcription',
          'transcription_id': transcription,
          'recording_id': transcription.replaceFirst('txn_', ''),
          'template_id': 'tmpl_general_notes',
          'status': 'completed',
          'output': {
            'overview': 'The team agreed on release notes and a Friday review.',
            'key_points': ['Share a short release update.'],
            'action_items': [
              'Alex drafts the notes.',
              'Sam reviews on Friday.',
            ],
          },
        },
      );
      return {'operation': _operation('summary', row['id']), 'summary': row};
    }
    if (parts.length == 6 && parts[3] == 'recordings' && parts[5] == 'ask') {
      return {
        'operation': _operation('ask', 'as_sample$_sequence'),
        'answer':
            'Alex will draft the notes. Sam will review them on Friday. '
            'This answer is a local sample fixture.',
        'citations': [
          {'recording_id': parts[4], 'start_ms': 12000},
        ],
      };
    }
    throw const ApiException(
      404,
      'not_found',
      'This sample action is unavailable.',
    );
  }

  @override
  void close() {
    _closed = true;
  }
}
