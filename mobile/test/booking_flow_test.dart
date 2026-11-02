import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/booking/booking_controller.dart';
import 'event_details_test.dart' show TestAuth;

Map<String, dynamic> line() => {
  'ticketTypeId': 'tier',
  'name': 'Entry',
  'quantity': 2,
  'unitPricePaise': 500,
  'lineTotalPaise': 1000,
};
Map<String, dynamic> event() => {
  'id': 'event',
  'slug': 'dance',
  'title': 'Dance',
  'dateLabel': 'Saturday',
  'venueLabel': 'Studio',
  'organizerName': 'Host',
  'publicUrl': 'https://raunak.yaduraj.me/e/dance',
};
OrderSnapshot snapshot(String status) => OrderSnapshot.fromJson({
  'id': 'order',
  'status': status,
  'expiresAt': DateTime.now()
      .add(const Duration(minutes: 10))
      .toIso8601String(),
  'paymentSessionId': status == 'PENDING' ? 'session' : null,
  'cashfreeOrderId': status == 'PENDING' ? 'cf-order' : null,
  'cashfreeEnvironment': 'sandbox',
  'buyerName': 'Guest',
  'buyerEmail': 'guest@example.test',
  'buyerPhone': '+919876543210',
  'whatsappOptIn': true,
  'subtotalPaise': 1000,
  'feePaise': 100,
  'totalPaise': 1100,
  'items': [line()],
  'event': event(),
});

class FlowRepository extends BookingsRepository {
  FlowRepository() : super(TestAuth());
  bool free = false, failCreate = false;
  final keys = <String>[];
  final reads = <Completer<OrderSnapshot>>[];
  @override
  Future<Quote> quote(String id, Map<String, int> q) async => Quote.fromJson({
    'items': [line()],
    'quantity': 2,
    'subtotalPaise': free ? 0 : 1000,
    'feePaise': free ? 0 : 100,
    'totalPaise': free ? 0 : 1100,
  }, whatsappAvailable: true);
  @override
  Future<OrderSnapshot> create({
    required String eventId,
    required Map<String, int> quantities,
    required String name,
    required String phone,
    required bool whatsappOptIn,
    required String idempotencyKey,
  }) async {
    keys.add(idempotencyKey);
    if (failCreate) {
      failCreate = false;
      throw const BookingFailure('Connection interrupted.');
    }
    return snapshot(free ? 'PAID' : 'PENDING');
  }

  @override
  Future<OrderSnapshot> order(String id) {
    final c = Completer<OrderSnapshot>();
    reads.add(c);
    return c.future;
  }
}

class Gateway extends PaymentGateway {
  int calls = 0;
  bool fail = false;
  @override
  Future<void> pay(OrderSnapshot order) async {
    calls++;
    if (fail) throw const BookingFailure('Payment screen closed.');
  }
}

Future<void> tick() => Future<void>.delayed(Duration.zero);
Future<BookingController> setup(FlowRepository repo, Gateway gateway) async {
  final c = BookingController(
    repo,
    eventId: 'event',
    quantities: {'tier': 2},
    gateway: gateway,
  );
  await c.loadQuote();
  await c.reserve(name: 'Guest', phone: '9876543210', whatsappOptIn: true);
  return c;
}

void main() {
  test(
    'successful SDK return is not confirmation until backend verifies payment',
    () async {
      final repo = FlowRepository(), gateway = Gateway();
      final c = await setup(repo, gateway);
      expect(c.quote!.totalPaise, 1100);
      final payment = c.pay();
      await tick();
      repo.reads[0].complete(snapshot('PENDING'));
      await tick();
      expect(gateway.calls, 1);
      expect(c.confirmed, false);
      expect(repo.reads.length, 2);
      repo.reads[1].complete(snapshot('PAID'));
      await payment;
      expect(c.confirmed, true);
      expect(c.order!.id, 'order');
      c.dispose();
    },
  );
  test(
    'SDK cancellation does not override a payment subsequently verified by the server',
    () async {
      final repo = FlowRepository(), gateway = Gateway()..fail = true;
      final c = await setup(repo, gateway);
      final payment = c.pay();
      await tick();
      repo.reads[0].complete(snapshot('PENDING'));
      await tick();
      repo.reads[1].complete(snapshot('PAID'));
      await payment;
      expect(c.confirmed, true);
      c.dispose();
    },
  );
  test('free booking confirms without opening a payment SDK', () async {
    final repo = FlowRepository()..free = true;
    final gateway = Gateway();
    final c = await setup(repo, gateway);
    expect(c.confirmed, true);
    await c.pay();
    expect(gateway.calls, 0);
    c.dispose();
  });
  test(
    'ambiguous reservation retries reuse one idempotency key and block edited payloads',
    () async {
      final repo = FlowRepository()..failCreate = true;
      final c = BookingController(
        repo,
        eventId: 'event',
        quantities: {'tier': 2},
        gateway: Gateway(),
      );
      await c.loadQuote();
      expect(
        await c.reserve(
          name: 'Guest',
          phone: '9876543210',
          whatsappOptIn: true,
        ),
        false,
      );
      expect(
        await c.reserve(
          name: 'Changed',
          phone: '9876543210',
          whatsappOptIn: true,
        ),
        false,
      );
      expect(repo.keys.length, 1);
      expect(
        await c.reserve(
          name: 'Guest',
          phone: '9876543210',
          whatsappOptIn: true,
        ),
        true,
      );
      expect(repo.keys[0], repo.keys[1]);
      c.dispose();
    },
  );
  test(
    'status refresh before retry avoids charging an already paid order',
    () async {
      final repo = FlowRepository(), gateway = Gateway();
      final c = await setup(repo, gateway);
      final payment = c.pay();
      await tick();
      repo.reads[0].complete(snapshot('PAID'));
      await payment;
      expect(c.confirmed, true);
      expect(gateway.calls, 0);
      c.dispose();
    },
  );
}
