import 'package:flutter/foundation.dart';
import 'auth_repository.dart';
export 'auth_repository.dart' show AppUser;

enum AuthStatus { restoring, signedOut, signedIn, unavailable }

class AuthController extends ChangeNotifier {
  AuthController(this.repository);
  final AuthRepository repository;
  AuthStatus status = AuthStatus.restoring;
  AppUser? user;
  bool busy = false;
  String? error;
  String? notice;
  bool get configured => repository.configured;
  void clearFeedback() {
    error = null;
    notice = null;
    notifyListeners();
  }

  Future<void> restore() async {
    status = AuthStatus.restoring;
    error = null;
    notifyListeners();
    try {
      user = await repository.restore().timeout(const Duration(seconds: 12));
      status = user == null ? AuthStatus.signedOut : AuthStatus.signedIn;
    } catch (_) {
      status = AuthStatus.unavailable;
      error =
          'We couldn’t restore your session. Check your connection and try again.';
    }
    notifyListeners();
  }

  Future<bool> _authenticate(Future<AppUser> Function() action) async {
    if (busy) {
      return false;
    }
    busy = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      user = await action();
      status = AuthStatus.signedIn;
      return true;
    } on AuthFailure catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'We couldn’t complete sign-in. Please try again.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> signIn(String email, String password) =>
      _authenticate(() => repository.signIn(email, password));
  Future<bool> signUp(String name, String email, String password) =>
      _authenticate(() => repository.signUp(name, email, password));
  Future<bool> resetPassword(String email) async {
    if (busy) {
      return false;
    }
    busy = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      await repository.resetPassword(email);
      notice =
          'If an account uses this email, a password reset link is on its way. Check your inbox and spam folder.';
      return true;
    } on AuthFailure catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'We couldn’t send the reset link. Please try again.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    if (busy) {
      return;
    }
    busy = true;
    notifyListeners();
    try {
      await repository.signOut();
    } finally {
      user = null;
      status = AuthStatus.signedOut;
      busy = false;
      error = null;
      notice = 'You’re signed out.';
      notifyListeners();
    }
  }
}
