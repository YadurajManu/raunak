import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';
import 'package:raunak_mobile/events/event_details_controller.dart';

class TestAuth extends AuthRepository {
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async => null;
  @override
  Future<AppUser> signIn(String e, String p) => throw UnimplementedError();
  @override
  Future<AppUser> signUp(String n, String e, String p) =>
      throw UnimplementedError();
  @override
  Future<void> resetPassword(String e) async {}
  @override
  Future<void> signOut() async {}
}

EventDetails fixture({
  int remaining = 8,
  bool available = true,
  bool saved = false,
}) => EventDetails.fromJson({
  'id': 'event',
  'slug': 'dance-night',
  'title': 'Dance night',
  'dateLabel': 'Saturday',
  'timeLabel': '6 pm IST',
  'timezone': 'Asia/Kolkata',
  'mode': 'IN_PERSON',
  'status': 'PUBLISHED',
  'organizerName': 'Host',
  'organizerUrl': 'https://raunak.yaduraj.me/organizers/host',
  'publicUrl': 'https://raunak.yaduraj.me/e/dance-night',
  'saved': saved,
  'images': [],
  'people': [],
  'tickets': [
    {
      'id': 'ticket',
      'name': 'Group entry',
      'pricePaise': 500,
      'remaining': remaining,
      'minPerOrder': 2,
      'maxPerOrder': 5,
      'available': available,
      'label': available ? 'On sale now' : 'Sold out',
    },
  ],
});

class FixtureRepository extends EventDetailsRepository {
  FixtureRepository() : super(TestAuth());
  EventDetails next = fixture();
  bool failSave = false;
  @override
  Future<EventDetails> fetch(String slug) async => next;
  @override
  Future<bool> save(String id, bool saved) async {
    if (failSave) throw const EventDetailsFailure('Retry saving.');
    return saved;
  }
}

void main() {
  test(
    'ticket quantities honor minimum, maximum and rupee arithmetic',
    () async {
      final repo = FixtureRepository();
      final c = EventDetailsController(repo, 'dance-night');
      await c.load();
      final t = c.event!.tickets.first;
      c.increment(t);
      expect(c.count, 2);
      expect(c.totalPaise, 1000);
      for (var i = 0; i < 10; i++) {
        c.increment(t);
      }
      expect(c.count, 5);
      c.decrement(t);
      c.decrement(t);
      c.decrement(t);
      expect(c.count, 2);
      c.decrement(t);
      expect(c.count, 0);
      c.dispose();
    },
  );
  test(
    'Continue rechecks availability and preserves selections in checkout URL',
    () async {
      final repo = FixtureRepository();
      final c = EventDetailsController(repo, 'dance-night');
      await c.load();
      c.increment(c.event!.tickets.first);
      final uri = await c.checkout();
      expect(uri!.path, '/checkout/dance-night');
      expect(jsonDecode(uri.queryParameters['tickets']!), {'ticket': 2});
      repo.next = fixture(remaining: 0, available: false);
      expect(await c.checkout(), isNull);
      expect(c.count, 0);
      expect(c.notice, contains('availability changed'));
      c.dispose();
    },
  );
  test('a failed save rolls back the optimistic heart', () async {
    final repo = FixtureRepository()..failSave = true;
    final c = EventDetailsController(repo, 'dance-night');
    await c.load();
    await c.toggleSaved();
    expect(c.event!.saved, false);
    expect(c.notice, 'Retry saving.');
    c.dispose();
  });
  test(
    'unavailable tickets cannot be selected and empty total is zero',
    () async {
      final repo = FixtureRepository()
        ..next = fixture(remaining: 0, available: false);
      final c = EventDetailsController(repo, 'dance-night');
      await c.load();
      c.increment(c.event!.tickets.first);
      expect(c.count, 0);
      expect(c.totalPaise, 0);
      expect(await c.checkout(), isNull);
      c.dispose();
    },
  );
}
