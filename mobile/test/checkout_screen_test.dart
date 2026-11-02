import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/auth/auth_controller.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';
import 'package:raunak_mobile/booking/booking_controller.dart';
import 'package:raunak_mobile/events/event_details_repository.dart';
import 'package:raunak_mobile/ui/checkout_screen.dart';
import 'package:raunak_mobile/ui/theme.dart';

class CheckoutAuth extends AuthRepository {
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async => null;
  @override
  Future<AppUser> signIn(String email, String password) async =>
      throw UnimplementedError();
  @override
  Future<AppUser> signUp(String name, String email, String password) async =>
      throw UnimplementedError();
  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<void> signOut() async {}
}

const line = {
  'ticketTypeId': 'ticket-1',
  'name': 'Workshop pass',
  'quantity': 1,
  'unitPricePaise': 0,
  'lineTotalPaise': 0,
};
const summary = {
  'id': 'event-1',
  'slug': 'test-workshop',
  'title': 'Test workshop',
  'dateLabel': 'Saturday, 14 November',
  'venueLabel': 'Test venue · Delhi',
};

class FreeBookings extends BookingsRepository {
  FreeBookings(super.auth);
  int creates = 0;
  String? submittedName, submittedPhone;
  bool? consent;
  @override
  Future<Quote> quote(String eventId, Map<String, int> quantities) async {
    expect(eventId, 'event-1');
    expect(quantities, {'ticket-1': 1});
    return Quote.fromJson({
      'items': [line],
      'quantity': 1,
      'subtotalPaise': 0,
      'feePaise': 0,
      'totalPaise': 0,
    }, whatsappAvailable: true);
  }

  @override
  Future<OrderSnapshot> create({
    required String eventId,
    required Map<String, int> quantities,
    required String name,
    required String phone,
    required bool whatsappOptIn,
    required String idempotencyKey,
  }) async {
    creates++;
    submittedName = name;
    submittedPhone = phone;
    consent = whatsappOptIn;
    expect(idempotencyKey, isNotEmpty);
    return OrderSnapshot.fromJson({
      'id': 'booking-1',
      'status': 'PAID',
      'expiresAt': DateTime.now()
          .add(const Duration(minutes: 10))
          .toIso8601String(),
      'cashfreeEnvironment': 'sandbox',
      'buyerName': name,
      'buyerEmail': 'aarav@example.test',
      'buyerPhone': phone,
      'whatsappOptIn': whatsappOptIn,
      'subtotalPaise': 0,
      'feePaise': 0,
      'totalPaise': 0,
      'items': [line],
      'event': summary,
    });
  }
}

class UnusedGateway extends PaymentGateway {
  int calls = 0;
  @override
  Future<void> pay(OrderSnapshot order) async {
    calls++;
  }
}

void main() {
  testWidgets(
    'free checkout validates phone and confirms only the server-paid order without opening Cashfree',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = AuthController(CheckoutAuth())
        ..user = const AppUser(
          id: 'user-1',
          name: 'Aarav Singh',
          email: 'aarav@example.test',
        )
        ..status = AuthStatus.signedIn;
      final repository = FreeBookings(auth.repository);
      final gateway = UnusedGateway();
      final event = EventDetails.fromJson({
        ...summary,
        'timeLabel': '6:00 pm IST',
        'timezone': 'Asia/Kolkata',
        'mode': 'IN_PERSON',
        'status': 'PUBLISHED',
        'organizerName': 'Test host',
        'organizerUrl': 'https://raunak.example/organizers/test',
        'publicUrl': 'https://raunak.example/e/test-workshop',
        'saved': false,
        'images': [],
        'people': [],
        'tickets': [],
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.light),
          home: CheckoutScreen(
            auth: auth,
            event: event,
            quantities: const {'ticket-1': 1},
            repository: repository,
            gateway: gateway,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final fields = find.byType(TextFormField);
      expect(fields, findsNWidgets(3));
      expect(
        tester.widget<TextFormField>(fields.at(0)).controller!.text,
        'Aarav Singh',
      );
      expect(tester.widget<TextField>(find.byType(TextField).at(1)).readOnly, true);
      expect(find.text('aarav@example.test'), findsOneWidget);
      await tester.tap(find.text('Book free tickets'));
      await tester.pumpAndSettle();
      expect(repository.creates, 0);
      expect(
        find.text('Enter a valid 10-digit Indian mobile number.'),
        findsOneWidget,
      );
      await tester.ensureVisible(fields.at(2));
      await tester.enterText(fields.at(2), '98765 43210');
      await tester.tap(find.text('Book free tickets'));
      await tester.pumpAndSettle();
      expect(repository.creates, 1);
      expect(repository.submittedName, 'Aarav Singh');
      expect(repository.submittedPhone, '+919876543210');
      expect(repository.consent, false);
      expect(gateway.calls, 0);
      expect(find.text('View my tickets'), findsOneWidget);
      expect(find.text('You’re on the list.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
