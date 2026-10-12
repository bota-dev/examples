import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'models.dart';

abstract interface class RecordingsApi {
  Future<Json> get(String path);
  Future<Json> post(String path, Json body);
  void close();
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
class BackendApi implements RecordingsApi {
  BackendApi(
    String origin,
    this._token, {
    this.timeout = const Duration(seconds: 30),
    this.askTimeout = const Duration(seconds: 210),
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

  Future<Json> _request(String method, String path, [Json? body]) async {
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
        if (body != null) {
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
        method == 'POST' && path.endsWith('/ask') ? askTimeout : timeout,
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
