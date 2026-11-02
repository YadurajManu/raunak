import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/app.dart';
import 'package:raunak_mobile/discovery/discovery_repository.dart';
import 'package:raunak_mobile/auth/auth_controller.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';

class ScreenAuth extends AuthRepository {
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async => null;
  @override
  Future<AppUser> signIn(String email, String password) async =>
      AppUser(id: '1', email: email, name: 'Aarav');
  @override
  Future<AppUser> signUp(String name, String email, String password) async =>
      AppUser(id: '1', email: email, name: name);
  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<void> signOut() async {}
}

class EmptyDiscovery extends DiscoveryRepository {
  EmptyDiscovery() : super(apiBase: 'https://raunak.example');
  @override
  Future<DiscoveryPage> fetch({
    String query = '',
    String city = '',
    String category = '',
    String period = '',
    String price = '',
    String sort = 'soonest',
    int page = 1,
  }) async => const DiscoveryPage(
    events: [],
    categories: [],
    total: 0,
    page: 1,
    hasMore: false,
  );
}

Future<AuthController> start(
  WidgetTester tester, {
  Size size = const Size(390, 844),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final auth = AuthController(ScreenAuth());
  await auth.restore();
  await tester.pumpWidget(
    RaunakApp(auth: auth, discoveryRepository: EmptyDiscovery()),
  );
  await tester.pump(const Duration(seconds: 2));
  await tester.pumpAndSettle();
  return auth;
}

void main() {
  testWidgets('welcome, sign-in and sign-out form a connected account flow', (
    tester,
  ) async {
    await start(tester);
    final login = find.text('I already have an account');
    await tester.ensureVisible(login);
    await tester.tap(login);
    await tester.pumpAndSettle();
    expect(find.text('Email address'), findsOneWidget);
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'aarav@example.test',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    final submit = find.text('Sign in').first;
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Your account'));
    await tester.pumpAndSettle();
    expect(find.textContaining('aarav@example.test'), findsOneWidget);
    final logout = find.text('Sign out');
    await tester.ensureVisible(logout);
    await tester.tap(logout);
    await tester.pumpAndSettle();
    expect(find.text('Create an account'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('signup validates inputs and consent before authenticating', (
    tester,
  ) async {
    final auth = await start(tester);
    final signup = find.text('Create an account');
    await tester.ensureVisible(signup);
    await tester.tap(signup);
    await tester.pumpAndSettle();
    final submit = find.text('Create account').first;
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(auth.status, AuthStatus.signedOut);
    expect(find.text('Full name'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  for (final brightness in Brightness.values) {
    testWidgets(
      '320px welcome and auth support ${brightness.name} with large text',
      (tester) async {
        tester.platformDispatcher.platformBrightnessTestValue = brightness;
        tester.platformDispatcher.textScaleFactorTestValue = 1.6;
        addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await start(tester, size: const Size(320, 720));
        expect(tester.takeException(), isNull);
        final login = find.text('I already have an account');
        await tester.ensureVisible(login);
        await tester.tap(login);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      },
    );
  }
}
