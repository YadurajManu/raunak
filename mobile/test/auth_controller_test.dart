import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/auth/auth_controller.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';

class FakeAuthRepository extends AuthRepository {
  @override
  String get apiBase => "https://raunak.example";
  bool failRestore = false;
  Completer<AppUser>? pending;
  int signInCalls = 0;
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async {
    if (failRestore) throw const AuthFailure('offline');
    return null;
  }

  @override
  Future<AppUser> signIn(String email, String password) {
    signInCalls++;
    return pending!.future;
  }

  @override
  Future<AppUser> signUp(String name, String email, String password) =>
      signIn(email, password);
  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<void> signOut() async {}
}

void main() {
  test('failed restoration has its own retryable state', () async {
    final repo = FakeAuthRepository()..failRestore = true;
    final auth = AuthController(repo);
    await auth.restore();
    expect(auth.status, AuthStatus.unavailable);
    repo.failRestore = false;
    await auth.restore();
    expect(auth.status, AuthStatus.signedOut);
  });
  test('prevents duplicate submissions and clears user on sign-out', () async {
    final repo = FakeAuthRepository()..pending = Completer<AppUser>();
    final auth = AuthController(repo);
    final first = auth.signIn('a@example.test', 'password');
    expect(auth.busy, true);
    expect(await auth.signIn('a@example.test', 'password'), false);
    expect(repo.signInCalls, 1);
    repo.pending!.complete(
      const AppUser(id: '1', email: 'a@example.test', name: 'Aarav'),
    );
    expect(await first, true);
    expect(auth.status, AuthStatus.signedIn);
    await auth.signOut();
    expect(auth.user, isNull);
    expect(auth.status, AuthStatus.signedOut);
  });
}
