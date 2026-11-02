import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';

class MemoryStore implements SessionStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String cookie) async {
    value = cookie;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

void main() {
  final profile = {
    'user': {'id': 'user-1', 'email': 'aarav@example.test', 'name': 'Aarav'},
  };
  test(
    'sign-in exchanges Firebase ID token and persists only server session',
    () async {
      final store = MemoryStore();
      final calls = <http.Request>[];
      final repo = RaunakAuthRepository(
        apiKey: 'public-test-key',
        apiBase: 'https://raunak.example',
        store: store,
        client: MockClient((request) async {
          calls.add(request);
          if (request.url.host == 'identitytoolkit.googleapis.com') {
            return http.Response(
              jsonEncode({'idToken': 'signed-id-token'}),
              200,
            );
          }
          expect(jsonDecode(request.body), {'idToken': 'signed-id-token'});
          return http.Response(
            jsonEncode(profile),
            200,
            headers: {
              'set-cookie':
                  'eventra_session=secure-session; Path=/; HttpOnly; Secure; SameSite=Lax',
            },
          );
        }),
      );
      final user = await repo.signIn(' aarav@example.test ', 'password123');
      expect(user.name, 'Aarav');
      expect(store.value, 'eventra_session=secure-session');
      expect(calls.length, 2);
      expect(calls.last.headers.containsKey('origin'), false);
    },
  );
  test(
    'invalid login gives useful feedback without saving credentials',
    () async {
      final store = MemoryStore();
      final repo = RaunakAuthRepository(
        apiKey: 'test',
        apiBase: 'https://raunak.example',
        store: store,
        client: MockClient(
          (_) async => http.Response(
            '{"error":{"message":"INVALID_LOGIN_CREDENTIALS"}}',
            400,
          ),
        ),
      );
      await expectLater(
        repo.signIn('a@example.test', 'bad'),
        throwsA(
          isA<AuthFailure>().having(
            (e) => e.message,
            'message',
            contains('doesn’t match'),
          ),
        ),
      );
      expect(store.value, isNull);
    },
  );
  test(
    'restore preserves session on server failure; expires it on 401',
    () async {
      final store = MemoryStore()..value = 'eventra_session=existing';
      var status = 503;
      final repo = RaunakAuthRepository(
        apiKey: 'test',
        apiBase: 'https://raunak.example',
        store: store,
        client: MockClient((request) async {
          expect(request.headers['Cookie'], 'eventra_session=existing');
          return http.Response('{}', status);
        }),
      );
      await expectLater(repo.restore(), throwsA(isA<AuthFailure>()));
      expect(store.value, isNotNull);
      status = 401;
      expect(await repo.restore(), isNull);
      expect(store.value, isNull);
    },
  );
  test(
    'backend must issue a secure session before sign-in completes',
    () async {
      final store = MemoryStore();
      final repo = RaunakAuthRepository(
        apiKey: 'test',
        apiBase: 'https://raunak.example',
        store: store,
        client: MockClient(
          (r) async => r.url.host == 'identitytoolkit.googleapis.com'
              ? http.Response('{"idToken":"token"}', 200)
              : http.Response(jsonEncode(profile), 200),
        ),
      );
      await expectLater(
        repo.signIn('a@example.test', 'password123'),
        throwsA(isA<AuthFailure>()),
      );
      expect(store.value, isNull);
    },
  );
  test('sign-up updates display name and exchanges a fresh ID token', () async {
    final store = MemoryStore();
    final operations = <String>[];
    final repo = RaunakAuthRepository(
      apiKey: 'test',
      apiBase: 'https://raunak.example',
      store: store,
      client: MockClient((r) async {
        operations.add(r.url.path);
        if (r.url.path.endsWith('accounts:update')) {
          expect(jsonDecode(r.body)['displayName'], 'Aarav');
        }
        if (r.url.path == '/api/mobile/session') {
          expect(jsonDecode(r.body)['idToken'], 'fresh');
          return http.Response(
            jsonEncode(profile),
            200,
            headers: {'set-cookie': 'eventra_session=session; HttpOnly'},
          );
        }
        return http.Response(
          jsonEncode({
            'idToken': r.url.path.endsWith('accounts:signInWithPassword')
                ? 'fresh'
                : 'original',
          }),
          200,
        );
      }),
    );
    await repo.signUp(' Aarav ', 'a@example.test', 'password123');
    expect(operations, [
      '/v1/accounts:signUp',
      '/v1/accounts:update',
      '/v1/accounts:signInWithPassword',
      '/api/mobile/session',
    ]);
  });
  test('password reset does not reveal whether account exists', () async {
    final repo = RaunakAuthRepository(
      apiKey: 'test',
      apiBase: 'https://raunak.example',
      store: MemoryStore(),
      client: MockClient(
        (_) async =>
            http.Response('{"error":{"message":"EMAIL_NOT_FOUND"}}', 400),
      ),
    );
    await repo.resetPassword('not-present@example.test');
  });
  test('API configuration rejects insecure remote servers', () {
    expect(
      () => RaunakAuthRepository(
        apiKey: 'test',
        apiBase: 'http://remote.example',
      ),
      throwsArgumentError,
    );
  });
}
