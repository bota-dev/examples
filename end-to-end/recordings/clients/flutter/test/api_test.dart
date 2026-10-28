import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_recordings_flutter/api.dart';
import 'package:mobile_recordings_flutter/recording_media.dart';

const token = 'application_token_for_local_tests_123456';

void main() {
  late HttpServer server;
  late BackendApi api;
  setUp(() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.defaultResponseHeaders.contentType = ContentType.json;
    api = BackendApi('http://127.0.0.1:${server.port}', token);
  });
  tearDown(() async {
    api.close();
    await server.close(force: true);
  });

  test(
    'raw import sends app Bearer, encoded filename and one bounded body',
    () async {
      var count = 0;
      server.listen((request) async {
        count++;
        expect(request.method, 'POST');
        expect(request.uri.path, '/api/library/uploads');
        expect(request.headers.value('authorization'), 'Bearer $token');
        expect(request.headers.contentType?.mimeType, 'audio/wav');
        expect(request.headers.value('x-file-name'), 'sample%20audio.wav');
        expect(
          await request.fold<int>(0, (size, chunk) => size + chunk.length),
          44,
        );
        request.response.write('{"operation":{"id":"op_1"}}');
        await request.response.close();
      });
      await api.upload(
        AudioImport('sample audio.wav', 'audio/wav', Uint8List(44)),
      );
      expect(count, 1);
    },
  );

  test(
    'WAV fetch validates byte magic, length and Bearer without forwarding URL',
    () async {
      final bytes = Uint8List(44);
      bytes.setRange(0, 4, ascii.encode('RIFF'));
      bytes.setRange(8, 12, ascii.encode('WAVE'));
      ByteData.sublistView(bytes).setUint32(4, 36, Endian.little);
      server.listen((request) async {
        expect(request.uri.path, '/api/library/recordings/rec_1/audio');
        expect(request.headers.value('authorization'), 'Bearer $token');
        expect(request.headers.value('accept'), 'audio/wav');
        request.response.headers.contentType = ContentType('audio', 'wav');
        request.response.add(bytes);
        await request.response.close();
      });
      expect(await api.audio('rec_1'), bytes);
    },
  );

  test('audio redirects are refused without another request', () async {
    var count = 0;
    server.listen((request) async {
      count++;
      request.response.statusCode = 307;
      request.response.headers.set(
        'location',
        '/api/library/recordings/rec_2/audio',
      );
      await request.response.close();
    });
    await expectLater(api.audio('rec_1'), throwsA(isA<ApiException>()));
    expect(count, 1);
  });

  test('audio rejects high-bit magic and declared body truncation', () async {
    var count = 0;
    server.listen((request) async {
      count++;
      final bytes = Uint8List(44);
      bytes.setRange(0, 4, ascii.encode('RIFF'));
      bytes.setRange(8, 12, ascii.encode('WAVE'));
      ByteData.sublistView(
        bytes,
      ).setUint32(4, count == 1 ? 36 : 100, Endian.little);
      if (count == 1) bytes[0] |= 0x80;
      request.response.headers.contentType = ContentType('audio', 'wav');
      request.response.add(bytes);
      await request.response.close();
    });
    await expectLater(api.audio('rec_1'), throwsA(isA<ApiException>()));
    await expectLater(api.audio('rec_1'), throwsA(isA<ApiException>()));
  });

  test('audio 401 remains identifiable for session teardown', () async {
    server.listen((request) async {
      request.response.statusCode = 401;
      await request.response.close();
    });
    await expectLater(
      api.audio('rec_1'),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
    );
  });

  test(
    'audio deadline and declared-size bound abort without a retry',
    () async {
      var count = 0;
      server.listen((request) async {
        count++;
        request.response.headers.contentType = ContentType('audio', 'wav');
        if (count == 1) {
          request.response.contentLength = maxAudioBytes + 1;
          await request.response.flush();
        } else {
          await Future<void>.delayed(const Duration(milliseconds: 150));
        }
        await request.response.close().catchError((Object _) {});
      });
      api.close();
      api = BackendApi(
        'http://127.0.0.1:${server.port}',
        token,
        audioTimeout: const Duration(milliseconds: 50),
      );
      await expectLater(api.audio('rec_1'), throwsA(isA<ApiException>()));
      await expectLater(api.audio('rec_1'), throwsA(isA<ApiException>()));
      expect(count, 2);
    },
  );

  test('origin and token validation prevent sending Bota credentials', () {
    for (final origin in [
      'http://example.com',
      'https://name:secret@example.com',
      'https://example.com/path',
      'https://example.com?x=y',
      'file:///tmp',
      'https://example.com#x',
    ]) {
      expect(() => BackendApi(origin, token), throwsFormatException);
    }
    for (final key in [
      'short',
      'sk_test_${'a' * 40}',
      'rk_${'a' * 40}',
      'dtok_${'a' * 40}',
      'up_${'a' * 40}',
      'rct_${'a' * 40}',
      '${'a' * 32} x',
    ]) {
      expect(
        () => BackendApi('https://example.com', key),
        throwsFormatException,
      );
    }
  });

  test(
    'actual HTTP uses app Bearer and JSON without cookie or Origin',
    () async {
      var count = 0;
      server.listen((request) async {
        count++;
        expect(request.method, 'POST');
        expect(request.headers.value('authorization'), 'Bearer $token');
        expect(request.headers.value('origin'), isNull);
        expect(request.headers.value('cookie'), isNull);
        expect(request.headers.contentType?.mimeType, 'application/json');
        expect(jsonDecode(await utf8.decoder.bind(request).join()), {
          'question': 'Next steps?',
        });
        request.response.write('{"ok":true}');
        await request.response.close();
      });
      expect(
        await api.post('/api/library/recordings/rec_test/ask', {
          'question': 'Next steps?',
        }),
        {'ok': true},
      );
      expect(count, 1);
    },
  );

  test('redirect is refused and target never receives credentials', () async {
    var count = 0;
    server.listen((request) async {
      count++;
      request.response.statusCode = 307;
      request.response.headers.set('location', '/api/library/target');
      await request.response.close();
    });
    await expectLater(
      api.post('/api/library/recordings/rec_test/transcriptions', {}),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'redirect_refused'),
      ),
    );
    expect(count, 1);
  });

  test('chunked bodies are bounded even without a declared length', () async {
    api.close();
    api = BackendApi('http://127.0.0.1:${server.port}', token, maxBytes: 32);
    server.listen((request) async {
      request.response.write('{"text":"${'a' * 100}"}');
      await request.response.close();
    });
    await expectLater(
      api.get('/api/library/recordings'),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'response_too_large'),
      ),
    );
  });

  test('non-JSON unauthorized response still expires the session', () async {
    server.listen((request) async {
      request.response.statusCode = 401;
      request.response.headers.contentType = ContentType.text;
      request.response.write('Unauthorized');
      await request.response.close();
    });
    await expectLater(
      api.get('/api/library/recordings'),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
    );
  });

  test('invalid JSON fails without repeating a POST', () async {
    var count = 0;
    server.listen((request) async {
      count++;
      request.response.write('bad JSON');
      await request.response.close();
    });
    await expectLater(
      api.post('/api/library/recordings/rec_test/transcriptions', {}),
      throwsA(isA<ApiException>()),
    );
    expect(count, 1);
  });

  test('deadline aborts one uncertain write without retry', () async {
    api.close();
    api = BackendApi(
      'http://127.0.0.1:${server.port}',
      token,
      timeout: const Duration(milliseconds: 100),
    );
    var count = 0;
    server.listen((request) async {
      count++;
      await request.drain<void>();
    });
    await expectLater(
      api.post('/api/library/recordings/rec_test/transcriptions', {}),
      throwsA(
        isA<ApiException>().having((e) => e.code, 'code', 'outcome_unknown'),
      ),
    );
    expect(count, 1);
  });

  test(
    'Ask gets its separate deadline while normal reads retain theirs',
    () async {
      api.close();
      api = BackendApi(
        'http://127.0.0.1:${server.port}',
        token,
        timeout: const Duration(milliseconds: 80),
        askTimeout: const Duration(seconds: 1),
      );
      server.listen((request) async {
        await request.drain<void>();
        await Future<void>.delayed(const Duration(milliseconds: 180));
        try {
          request.response.write('{"ok":true}');
          await request.response.close();
        } catch (_) {}
      });
      expect(
        await api.post('/api/library/recordings/rec_test/ask', {
          'question': 'Next?',
        }),
        {'ok': true},
      );
      await expectLater(
        api.get('/api/library/recordings'),
        throwsA(isA<ApiException>()),
      );
    },
  );

  test(
    'error retains known sanitized operation and metadata-presence flag',
    () async {
      server.listen((request) async {
        request.response.statusCode = 409;
        request.response.write(
          jsonEncode({
            'error': {'code': 'outcome_unknown'},
            'operation': {
              'id': 'op_1',
              'kind': 'transcription',
              'state': 'uncertain',
              'resource_id': 'txn_1',
              'updated_at': '2026-10-12T12:00:00Z',
            },
          }),
        );
        await request.response.close();
      });
      await expectLater(
        api.post('/api/library/recordings/rec_test/transcriptions', {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.operation?.id, 'operation', 'op_1')
              .having((e) => e.operationPresent, 'present', true),
        ),
      );
    },
  );
}
