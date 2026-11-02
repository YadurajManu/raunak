import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:raunak_mobile/discovery/discovery_controller.dart';

DiscoveryPage result(int total) => DiscoveryPage(
  events: [],
  categories: ['Arts & culture'],
  total: total,
  page: 1,
  hasMore: false,
);

class ControlledRepository extends DiscoveryRepository {
  ControlledRepository() : super(apiBase: 'https://raunak.example');
  final requests = <Completer<DiscoveryPage>>[];
  final requestedQueries = <String>[];
  @override
  Future<DiscoveryPage> fetch({
    String query = '',
    String city = '',
    String category = '',
    String period = '',
    String price = '',
    String sort = 'soonest',
    int page = 1,
  }) {
    requestedQueries.add(query);
    final c = Completer<DiscoveryPage>();
    requests.add(c);
    return c.future;
  }
}

void main() {
  test(
    'discovery forwards filters safely and parses an actual empty result',
    () async {
      final repo = DiscoveryRepository(
        apiBase: 'https://raunak.example',
        client: MockClient((r) async {
          expect(r.url.queryParameters['q'], 'music & dance');
          expect(r.url.queryParameters['city'], 'Greater Noida');
          return http.Response(
            '{"events":[],"categories":["Music & nightlife"],"total":0,"page":1,"hasMore":false}',
            200,
          );
        }),
      );
      final data = await repo.fetch(
        query: 'music & dance',
        city: 'Greater Noida',
      );
      expect(data.events, isEmpty);
      expect(data.total, 0);
      repo.close();
    },
  );
  test('a failed response cannot masquerade as an empty marketplace', () async {
    final repo = DiscoveryRepository(
      apiBase: 'https://raunak.example',
      client: MockClient((_) async => http.Response('{}', 503)),
    );
    await expectLater(repo.fetch(), throwsA(isA<DiscoveryFailure>()));
    repo.close();
  });
  test('a slower old request cannot overwrite a newer filter result', () async {
    final repo = ControlledRepository();
    final controller = DiscoveryController(repo);
    final old = controller.load();
    controller.setCity('Delhi');
    repo.requests[1].complete(result(2));
    await Future<void>.delayed(Duration.zero);
    repo.requests[0].complete(result(9));
    await old;
    expect(controller.total, 2);
    expect(controller.city, 'Delhi');
    controller.dispose();
  });
  test(
    'clear filters keeps All cities and cannot restore the previous city',
    () async {
      final repo = ControlledRepository();
      final controller = DiscoveryController(repo);
      controller.city = 'Khodri';
      controller.category = 'Arts & culture';
      controller.query = 'dance';
      controller.clearFilters();
      repo.requests[0].complete(result(4));
      await Future<void>.delayed(Duration.zero);
      expect(controller.city, '');
      expect(controller.query, '');
      expect(controller.category, '');
      expect(controller.hasFilters, false);
      expect(controller.total, 4);
      controller.dispose();
    },
  );
  test(
    'search waits for typing to settle and requests the latest query',
    () async {
      final repo = ControlledRepository();
      final controller = DiscoveryController(repo);
      controller.setQuery('dan');
      controller.setQuery('dance');
      expect(repo.requests, isEmpty);
      await Future<void>.delayed(const Duration(milliseconds: 400));
      expect(repo.requestedQueries, ['dance']);
      repo.requests[0].complete(result(0));
      await Future<void>.delayed(Duration.zero);
      controller.dispose();
    },
  );
}
