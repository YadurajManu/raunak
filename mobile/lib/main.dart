import 'dart:async';
import 'package:flutter/material.dart';
import 'app.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_repository.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = FlutterError.presentError;
  assert(() {
    debugPrint('Raunak: main reached');
    return true;
  }());
  final auth = AuthController(
    RaunakAuthRepository(
      apiKey: const String.fromEnvironment('FIREBASE_API_KEY'),
      apiBase: const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'https://raunak.yaduraj.me',
      ),
    ),
  );
  runApp(RaunakApp(auth: auth));
  WidgetsBinding.instance.addPostFrameCallback((_) {
    assert(() {
      debugPrint('Raunak: first frame rendered');
      return true;
    }());
  });
  unawaited(auth.restore());
}
