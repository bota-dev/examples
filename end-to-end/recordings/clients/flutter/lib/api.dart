import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'models.dart';
import 'recording_media.dart';

abstract interface class RecordingsApi {
  Future<Json> get(String path);
  Future<Json> post(String path, Json body);
  void close();
}

abstract interface class MediaRecordingsApi implements RecordingsApi {
  Future<Json> upload(AudioImport file);
  Future<Uint8List> audio(String recordingId);
}

class ApiException implements Exception {
  const ApiException(
    this.status,
    this.code,
    this.message, {
    this.operation,
    this.operationPresent = false,
  });
  final int status;
  final String code;
  final String message;
  final Operation? operation;
  final bool operationPresent;
}

/// This token authenticates to the customer's backend, never to Bota's API.
class BackendApi implements MediaRecordingsApi {
  BackendApi(
    String origin,
    this._token, {
    this.timeout = const Duration(seconds: 30),
    this.askTimeout = const Duration(seconds: 210),
    this.audioTimeout = const Duration(seconds: 120),
    this.maxBytes = 2 * 1024 * 1024,
  }) : _origin = validateOrigin(origin) {
    if (_token.length < 32 ||
        _token.length > 256 ||
        RegExp(r'\s').hasMatch(_token) ||
        RegExp(r'^(sk_|rk_|dtok_|up_|rct_)').hasMatch(_token)) {
      throw const FormatException('Use the separate application token.');
    }
    _client.connectionTimeout = timeout;
  }
  final Uri _origin;
  String _token;
  final Duration timeout;
  final Duration askTimeout;
  final Duration audioTimeout;
  final int maxBytes;
  final HttpClient _client = HttpClient();
  bool _closed = false;

  static Uri validateOrigin(String input) {
    final origin = Uri.parse(input.trim());
    if ((origin.scheme != 'https' &&
            !(origin.scheme == 'http' &&
                ['127.0.0.1', 'localhost', '::1'].contains(origin.host))) ||
        origin.host.isEmpty ||
        origin.userInfo.isNotEmpty ||
        !['', '/'].contains(origin.path) ||
        origin.hasQuery ||
        origin.hasFragment) {
      throw const FormatException(
        'Use HTTPS, or HTTP on loopback for development.',
      );
    }
    return origin;
  }

  @override
  Future<Json> get(String path) => _request('GET', path);
  @override
  Future<Json> post(String path, Json body) => _request('POST', path, body);

  @override
  Future<Json> upload(AudioImport file) =>
      _request('POST', '/api/library/uploads', null, file);

  @override
  Future<Uint8List> audio(String recordingId) async {
    validatedId(recordingId);
    HttpClientRequest? pending;
    bool terminated = false;
    try {
      return await (() async {
        if (_closed) throw const ApiException(0, 'closed', 'Session ended.');
        final request = await _client.getUrl(
          _origin.resolve('/api/library/recordings/$recordingId/audio'),
        );
        pending = request;
        if (terminated || _closed) {
          request.abort();
          throw const ApiException(0, 'closed', 'Session ended.');
        }
        request.followRedirects = false;
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $_token');
        request.headers.set(HttpHeaders.acceptHeader, 'audio/wav');
        final response = await request.close();
        if (response.statusCode == 401) {
          throw const ApiException(
            401,
            'unauthorized',
            'Your session ended. Connect again.',
          );
        }
        if (response.statusCode != 200 ||
            response.headers.contentType?.mimeType != 'audio/wav') {
          throw const ApiException(
            0,
            'audio_unavailable',
            'Audio is unavailable. Only verified ordinary imports support playback.',
          );
        }
        if (response.contentLength > maxAudioBytes) {
          throw const FormatException('Audio is too large.');
        }
        final builder = BytesBuilder(copy: false);
        await for (final chunk in response) {
          if (builder.length + chunk.length > maxAudioBytes) {
            throw const FormatException('Audio is too large.');
          }
          builder.add(chunk);
        }
        final bytes = builder.takeBytes();
        if (bytes.length < 44 ||
            ![
              0x52,
              0x49,
              0x46,
              0x46,
            ].asMap().entries.every((e) => bytes[e.key] == e.value) ||
            ![
              0x57,
              0x41,
              0x56,
              0x45,
            ].asMap().entries.every((e) => bytes[e.key + 8] == e.value)) {
          throw const FormatException('Invalid WAV response.');
        }
        final declared = ByteData.sublistView(
          bytes,
        ).getUint32(4, Endian.little);
        if (declared != 0xffffffff && declared + 8 != bytes.length) {
          throw const FormatException('Incomplete WAV response.');
        }
        return bytes;
      })().timeout(audioTimeout);
    } on ApiException {
      terminated = true;
      pending?.abort();
      rethrow;
    } catch (_) {
      terminated = true;
      pending?.abort();
      throw const ApiException(
        0,
        'audio_unavailable',
        'Audio could not be loaded. Refresh recording and try again.',
      );
    }
  }

  Future<Json> _request(
    String method,
    String path, [
    Json? body,
    AudioImport? upload,
  ]) async {
    if (_closed) {
      throw const ApiException(0, 'closed', 'This session has ended.');
    }
    if (!RegExp(r'^/api/library/[A-Za-z0-9_/-]+$').hasMatch(path)) {
      throw const FormatException('Invalid customer-backend route.');
    }
    HttpClientRequest? pending;
    bool terminated = false;
    try {
      // One deadline covers connect, headers and the complete bounded body.
      return await (() async {
        final request = await _client.openUrl(method, _origin.resolve(path));
        pending = request;
        if (terminated || _closed) {
          request.abort();
          throw const ApiException(0, 'closed', 'This request has ended.');
        }
        request.followRedirects = false;
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $_token');
        request.headers.set(HttpHeaders.acceptHeader, 'application/json');
        if (upload != null) {
          request.headers.contentType = ContentType.parse(upload.mimeType);
          request.headers.set('X-File-Name', Uri.encodeComponent(upload.name));
          request.contentLength = upload.bytes.length;
          request.add(upload.bytes);
        } else if (body != null) {
          request.headers.contentType = ContentType.json;
          request.write(jsonEncode(body));
        }
        final response = await request.close();
        if (response.statusCode == 401) {
          throw const ApiException(
            401,
            'unauthorized',
            'Your session ended. Connect again.',
          );
        }
        if (response.statusCode >= 300 && response.statusCode < 400) {
          throw const ApiException(
            502,
            'redirect_refused',
            'The backend redirected this request.',
          );
        }
        if (response.contentLength > maxBytes) {
          throw const ApiException(
            502,
            'response_too_large',
            'The backend response is too large.',
          );
        }
        if (response.headers.contentType?.mimeType != 'application/json') {
          throw const ApiException(
            502,
            'invalid_response',
            'The backend did not return JSON.',
          );
        }
        final bytes = <int>[];
        await for (final chunk in response) {
          if (bytes.length + chunk.length > maxBytes) {
            throw const ApiException(
              502,
              'response_too_large',
              'The backend response is too large.',
            );
          }
          bytes.addAll(chunk);
        }
        final value = object(jsonDecode(utf8.decode(bytes)));
        if (response.statusCode < 200 || response.statusCode >= 300) {
          final detail = value['error'] is Json
              ? value['error'] as Json
              : <String, dynamic>{};
          Operation? operation;
          try {
            if (value['operation'] != null) {
              operation = Operation.fromJson(object(value['operation']));
            }
          } on FormatException {
            /* Keep the lock when returned metadata is invalid. */
          }
          throw ApiException(
            response.statusCode,
            detail['code'] is String
                ? text(detail['code'], max: 128)
                : 'request_failed',
            response.statusCode == 401
                ? 'Your session ended. Connect again.'
                : 'The request could not complete. Refresh its saved request before trying again.',
            operation: operation,
            operationPresent: value.containsKey('operation'),
          );
        }
        return value;
      })().timeout(
        upload != null
            ? const Duration(seconds: 180)
            : method == 'POST' && path.endsWith('/ask')
            ? askTimeout
            : timeout,
      );
    } on ApiException {
      terminated = true;
      pending?.abort();
      rethrow;
    } catch (_) {
      terminated = true;
      pending?.abort();
      throw const ApiException(
        0,
        'outcome_unknown',
        'The response could not be read. Refresh the saved request; do not repeat a processing action.',
      );
    }
  }

  @override
  void close() {
    _closed = true;
    _token = '';
    _client.close(force: true);
  }
}
