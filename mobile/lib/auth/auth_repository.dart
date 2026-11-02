import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AppUser {
  const AppUser({required this.id, required this.email, this.name});
  final String id;
  final String email;
  final String? name;
  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    email: json['email'] as String,
    name: json['name'] as String?,
  );
}

class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
  @override
  String toString() => message;
}

abstract class SessionStore {
  Future<String?> read();
  Future<void> write(String cookie);
  Future<void> clear();
}

class SecureSessionStore implements SessionStore {
  static const _key = 'raunak_session_v1';
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String cookie) => _storage.write(key: _key, value: cookie);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

abstract class AuthRepository {
  String get apiBase => "https://raunak.yaduraj.me";
  bool get configured;
  Future<AppUser?> restore();
  Future<AppUser> signIn(String email, String password);
  Future<AppUser> signUp(String name, String email, String password);
  Future<void> resetPassword(String email);
  Future<void> signOut();
  Future<http.Response> authenticatedRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    throw const AuthFailure('Please sign in again.');
  }
}

class RaunakAuthRepository implements AuthRepository {
  RaunakAuthRepository({
    required this.apiKey,
    required this.apiBase,
    http.Client? client,
    SessionStore? store,
  }) : _client = client ?? http.Client(),
       _store = store ?? SecureSessionStore() {
    final uri = Uri.tryParse(apiBase);
    if (uri == null ||
        !uri.hasAuthority ||
        (uri.scheme != 'https' &&
            !(uri.scheme == 'http' &&
                {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host)))) {
      throw ArgumentError(
        'API_BASE_URL must use HTTPS (HTTP is only allowed for local development).',
      );
    }
  }
  final String apiKey;
  @override
  final String apiBase;
  final http.Client _client;
  final SessionStore _store;
  String? _cookie;
  @override
  bool get configured => apiKey.isNotEmpty;
  Uri get _sessionUrl => Uri.parse(apiBase).resolve('/api/mobile/session');

  Future<http.Response> _request(
    Future<http.Response> Function() action,
  ) async {
    try {
      return await action().timeout(const Duration(seconds: 20));
    } on TimeoutException {
      throw const AuthFailure('That took a little too long. Please try again.');
    } on http.ClientException {
      throw const AuthFailure(
        'We couldn’t connect. Check your connection and try again.',
      );
    }
  }

  Map<String, dynamic> _json(http.Response response) {
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw const AuthFailure(
        'We couldn’t read the server response. Please try again.',
      );
    }
  }

  void _requireConfiguration() {
    if (kIsWeb) {
      throw const AuthFailure(
        'This browser build previews the design. Use the Android or iOS app to sign in.',
      );
    }
    if (!configured) {
      throw const AuthFailure(
        'Add the Firebase public API key to the app configuration to enable sign-in.',
      );
    }
  }

  Future<Map<String, dynamic>> _firebase(
    String operation,
    Map<String, dynamic> data,
  ) async {
    final url = Uri.https(
      'identitytoolkit.googleapis.com',
      '/v1/accounts:$operation',
      {'key': apiKey},
    );
    final response = await _request(
      () => _client.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(data),
      ),
    );
    final result = _json(response);
    if (response.statusCode != 200) {
      final code = (result['error'] as Map?)?['message']
          ?.toString()
          .split(' : ')
          .first;
      throw AuthFailure(switch (code) {
        'EMAIL_EXISTS' => 'An account already uses this email. Try signing in.',
        'INVALID_EMAIL' => 'Enter a valid email address.',
        'INVALID_LOGIN_CREDENTIALS' ||
        'EMAIL_NOT_FOUND' ||
        'INVALID_PASSWORD' =>
          'The email or password doesn’t match. Please try again.',
        'USER_DISABLED' =>
          'This account is unavailable. Please contact Raunak support.',
        'TOO_MANY_ATTEMPTS_TRY_LATER' =>
          'Too many attempts. Please try again later.',
        'WEAK_PASSWORD' =>
          'Choose a stronger password with at least 8 characters.',
        'OPERATION_NOT_ALLOWED' =>
          'Email sign-in is not available. Please contact Raunak support.',
        _ => 'We couldn’t complete that request. Please try again.',
      });
    }
    return result;
  }

  Future<AppUser> _exchange(String token) async {
    final response = await _request(
      () => _client.post(
        _sessionUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'idToken': token}),
      ),
    );
    if (response.statusCode != 200) {
      throw AuthFailure(
        response.statusCode == 429
            ? 'Too many sign-in attempts. Try again in 15 minutes.'
            : 'Your account could not connect to Raunak. Please try signing in again.',
      );
    }
    final cookie = RegExp(
      r'(?:^|,\s*)(eventra_session=[^;,\s]+)',
    ).firstMatch(response.headers['set-cookie'] ?? '')?.group(1);
    if (cookie == null) {
      throw const AuthFailure(
        'A secure session could not be established. Please try again.',
      );
    }
    final user = AppUser.fromJson(
      _json(response)['user'] as Map<String, dynamic>,
    );
    await _store.write(cookie);
    _cookie = cookie;
    return user;
  }

  @override
  Future<AppUser> signIn(String email, String password) async {
    _requireConfiguration();
    final result = await _firebase('signInWithPassword', {
      'email': email.trim(),
      'password': password,
      'returnSecureToken': true,
    });
    return _exchange(result['idToken'] as String);
  }

  @override
  Future<AppUser> signUp(String name, String email, String password) async {
    _requireConfiguration();
    if (name.trim().length < 2 || password.length < 8) {
      throw const AuthFailure(
        'Enter your name and a password with at least 8 characters.',
      );
    }
    final result = await _firebase('signUp', {
      'email': email.trim(),
      'password': password,
      'returnSecureToken': true,
    });
    final token = result['idToken'] as String;
    await _firebase('update', {
      'idToken': token,
      'displayName': name.trim(),
      'returnSecureToken': true,
    });
    // Sign in again so the ID token contains the updated display name.
    final fresh = await _firebase('signInWithPassword', {
      'email': email.trim(),
      'password': password,
      'returnSecureToken': true,
    });
    return _exchange(fresh['idToken'] as String);
  }

  @override
  Future<void> resetPassword(String email) async {
    _requireConfiguration();
    try {
      await _firebase('sendOobCode', {
        'requestType': 'PASSWORD_RESET',
        'email': email.trim(),
      });
    } on AuthFailure catch (e) {
      // Firebase can conceal account existence. Keep the result generic either way.
      if (!e.message.contains('email or password')) {
        rethrow;
      }
    }
  }

  @override
  Future<AppUser?> restore() async {
    if (kIsWeb) {
      return null;
    }
    _cookie = await _store.read();
    if (_cookie == null) {
      return null;
    }
    final response = await _request(
      () => _client.get(
        _sessionUrl,
        headers: {'Cookie': _cookie!, 'Accept': 'application/json'},
      ),
    );
    if (response.statusCode == 401) {
      await _store.clear();
      _cookie = null;
      return null;
    }
    if (response.statusCode != 200) {
      throw const AuthFailure(
        'We couldn’t restore your account. Check your connection and retry.',
      );
    }
    return AppUser.fromJson(_json(response)['user'] as Map<String, dynamic>);
  }

  @override
  Future<http.Response> authenticatedRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    if (!path.startsWith('/') ||
        path.startsWith('//') ||
        !{'GET', 'POST'}.contains(method)) {
      throw ArgumentError('A relative Raunak API path is required.');
    }
    final base = Uri.parse(apiBase);
    final uri = base.resolve(path);
    if (uri.origin != base.origin) {
      throw ArgumentError('Invalid API destination.');
    }
    _cookie ??= await _store.read();
    final headers = <String, String>{
      'Accept': 'application/json',
      'Cookie': ?_cookie,
    };
    if (method == 'GET') {
      return _request(() => _client.get(uri, headers: headers));
    }
    headers['Content-Type'] = 'application/json';
    headers['Origin'] = base.origin;
    return _request(
      () => _client.post(uri, headers: headers, body: jsonEncode(body)),
    );
  }

  @override
  Future<void> signOut() async {
    final cookie = _cookie;
    _cookie = null;
    await _store.clear();
    if (cookie != null) {
      try {
        await _request(
          () => _client.delete(_sessionUrl, headers: {'Cookie': cookie}),
        );
      } catch (_) {
        /* Local credentials are cleared even when offline. */
      }
    }
  }
}
