import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class DiscoverEvent {
  const DiscoverEvent({
    required this.id,
    required this.slug,
    required this.title,
    required this.dateLabel,
    required this.venueLabel,
    required this.organizerName,
    required this.publicUrl,
    required this.mode,
    this.summary,
    this.imageUrl,
    this.city,
    this.category,
    this.pricePaise,
  });
  final String id,
      slug,
      title,
      dateLabel,
      venueLabel,
      organizerName,
      publicUrl,
      mode;
  final String? summary, imageUrl, city, category;
  final int? pricePaise;
  factory DiscoverEvent.fromJson(Map<String, dynamic> value) => DiscoverEvent(
    id: value['id'] as String,
    slug: value['slug'] as String,
    title: value['title'] as String,
    dateLabel: value['dateLabel'] as String,
    venueLabel: value['venueLabel'] as String,
    organizerName: value['organizerName'] as String,
    publicUrl: value['publicUrl'] as String,
    mode: value['mode'] as String,
    summary: value['summary'] as String?,
    imageUrl: value['imageUrl'] as String?,
    city: value['city'] as String?,
    category: value['category'] as String?,
    pricePaise: (value['pricePaise'] as num?)?.toInt(),
  );
}

class CityOption {
  const CityOption({required this.city, required this.region});
  final String city, region;
}

class DiscoveryPage {
  const DiscoveryPage({
    required this.events,
    required this.categories,
    required this.total,
    required this.page,
    required this.hasMore,
  });
  final List<DiscoverEvent> events;
  final List<String> categories;
  final int total, page;
  final bool hasMore;
}

class DiscoveryFailure implements Exception {
  const DiscoveryFailure(this.message);
  final String message;
}

class DiscoveryRepository {
  DiscoveryRepository({required this.apiBase, http.Client? client})
    : _client = client ?? http.Client();
  final String apiBase;
  final http.Client _client;
  Future<Map<String, dynamic>> _get(
    String path,
    Map<String, String> params,
  ) async {
    final uri = Uri.parse(
      apiBase,
    ).resolve(path).replace(queryParameters: params);
    try {
      final result = await _client
          .get(uri, headers: {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 15));
      if (result.statusCode != 200) {
        throw const DiscoveryFailure(
          'We couldn’t load events. Please try again.',
        );
      }
      return jsonDecode(result.body) as Map<String, dynamic>;
    } on TimeoutException {
      throw const DiscoveryFailure(
        'That took a little too long. Check your connection and retry.',
      );
    } on http.ClientException {
      throw const DiscoveryFailure(
        'You appear to be offline. Check your connection and retry.',
      );
    } on FormatException {
      throw const DiscoveryFailure(
        'Events are temporarily unavailable. Please retry.',
      );
    }
  }

  Future<DiscoveryPage> fetch({
    String query = '',
    String city = '',
    String category = '',
    String period = '',
    String price = '',
    String sort = 'soonest',
    int page = 1,
  }) async {
    final data = await _get('/api/mobile/discover', {
      if (query.isNotEmpty) 'q': query,
      if (city.isNotEmpty) 'city': city,
      if (category.isNotEmpty) 'category': category,
      if (period.isNotEmpty) 'period': period,
      if (price.isNotEmpty) 'price': price,
      'sort': sort,
      'page': '$page',
    });
    return DiscoveryPage(
      events: (data['events'] as List)
          .map((v) => DiscoverEvent.fromJson(v as Map<String, dynamic>))
          .toList(),
      categories: (data['categories'] as List).cast<String>(),
      total: data['total'] as int,
      page: data['page'] as int,
      hasMore: data['hasMore'] as bool,
    );
  }

  Future<List<CityOption>> cities(String query) async {
    if (query.trim().length < 2) {
      return [];
    }
    final data = await _get('/api/discover/cities', {'q': query.trim()});
    return (data['cities'] as List)
        .map(
          (v) => CityOption(
            city: v['city'] as String,
            region: v['region'] as String? ?? '',
          ),
        )
        .toList();
  }

  void close() => _client.close();
}
