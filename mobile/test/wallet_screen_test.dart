import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:raunak_mobile/ui/wallet_screen.dart';
import 'package:raunak_mobile/ui/theme.dart';
import 'package:raunak_mobile/auth/auth_controller.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';
import 'package:raunak_mobile/booking/bookings_repository.dart';

class Auth extends AuthRepository {
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async =>
      const AppUser(id: 'person', email: 'person@example.test', name: 'Person');
  @override
  Future<AppUser> signIn(String a, String b) async =>
      throw UnimplementedError();
  @override
  Future<AppUser> signUp(String a, String b, String c) async =>
      throw UnimplementedError();
  @override
  Future<void> resetPassword(String e) async {}
  @override
  Future<void> signOut() async {}
}

Map<String, dynamic> event() => {
  'id': 'event',
  'slug': 'event',
  'title': 'A real event title from the API',
  'dateLabel': 'Sat, 7 Nov · 8:00 pm IST',
  'venueLabel': 'Delhi, India',
  'organizerName': 'Organizer',
  'publicUrl': 'https://example.test/e/event',
};
Map<String, dynamic> ticket(bool active) => {
  'id': 'ticket-1',
  'code': 'REF-123',
  'orderId': 'order',
  'ticketType': 'General admission',
  'holderName': 'Person',
  'status': active ? 'VALID' : 'USED',
  'orderStatus': 'PAID',
  'admissionLabel': active ? 'Ready for entry' : 'Already checked in',
  'quantity': 1,
  'active': active,
  'pdfAvailable': true,
  'event': event(),
};

class Repo extends BookingsRepository {
  Repo() : super(Auth());
  bool active = true;
  Completer<TicketDetails>? delayed;
  @override
  Future<WalletPage> wallet({
    String tab = 'upcoming',
    String query = '',
    int page = 1,
    String? orderId,
  }) async => WalletPage.fromJson({
    'tickets': [ticket(active)],
    'pendingBookings': [],
    'total': 1,
    'page': 1,
    'hasMore': false,
  });
  @override
  Future<TicketDetails> detail(String id) async {
    if (delayed != null) return delayed!.future;
    return TicketDetails.fromJson({
      ...ticket(active),
      'qrPayload': active ? 'signed:test:payload' : null,
      'siblings': [
        {'id': 'ticket-1', 'code': 'REF-123'},
      ],
    });
  }
}

void main() {
  testWidgets(
    'ticket periodic verification removes admission QR after check-in',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = AuthController(Auth());
      await auth.restore();
      final repo = Repo();
      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.light),
          home: WalletScreen(auth: auth, repository: repo),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('A real event title from the API'));
      await tester.pumpAndSettle();
      expect(find.byType(QrImageView), findsOneWidget);
      repo.active = false;
      await tester.pump(const Duration(seconds: 31));
      await tester.pumpAndSettle();
      expect(find.byType(QrImageView), findsNothing);
      expect(find.text('Already checked in'), findsOneWidget);
      expect(find.text('Save ticket PDF'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'fullscreen QR clears on pause and revalidates before redisplay',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = AuthController(Auth());
      await auth.restore();
      final repo = Repo();
      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.light),
          home: WalletScreen(auth: auth, repository: repo),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('A real event title from the API'));
      await tester.pumpAndSettle();
      final full = find.text('Show full-screen QR');
      await tester.ensureVisible(full);
      await tester.tap(full);
      await tester.pumpAndSettle();
      expect(find.byType(QrImageView), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.scheduleForcedFrame();
      await tester.pump();
      expect(find.byType(QrImageView), findsNothing);
      repo.delayed = Completer<TicketDetails>();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(find.byType(QrImageView), findsNothing);
      repo.delayed!.complete(
        TicketDetails.fromJson({
          ...ticket(false),
          'qrPayload': null,
          'siblings': [],
        }),
      );
      await tester.pumpAndSettle();
      expect(find.byType(QrImageView), findsNothing);
      expect(find.text('Already checked in'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('wallet and ticket detail tolerate320px and large text', (
    tester,
  ) async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 720);
    tester.platformDispatcher.textScaleFactorTestValue = 1.6;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final auth = AuthController(Auth());
    await auth.restore();
    await tester.pumpWidget(
      MaterialApp(
        theme: raunakTheme(Brightness.dark),
        home: WalletScreen(auth: auth, repository: Repo()),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    final title = find.text('A real event title from the API');
    await tester.scrollUntilVisible(
      title,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(title);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
