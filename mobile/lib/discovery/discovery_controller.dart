import 'dart:async';
import 'package:flutter/foundation.dart';
import 'discovery_repository.dart';
export 'discovery_repository.dart';

class DiscoveryController extends ChangeNotifier {
  DiscoveryController(this.repository);
  final DiscoveryRepository repository;
  List<DiscoverEvent> events = [];
  List<String> categories = [];
  bool loading = false, loadingMore = false, hasMore = false;
  int total = 0, page = 1;
  String query = '',
      city = '',
      category = '',
      period = '',
      price = '',
      sort = 'soonest';
  String? error;
  Timer? _debounce;
  int _revision = 0;
  bool _disposed = false;
  bool get hasFilters =>
      [query, city, category, period, price].any((v) => v.isNotEmpty) ||
      sort != 'soonest';
  Future<void> load({bool append = false}) async {
    if (_disposed || (append && (loading || loadingMore || !hasMore))) {
      return;
    }
    _debounce?.cancel();
    final revision = ++_revision;
    final nextPage = append ? page + 1 : 1;
    final previousEvents = List<DiscoverEvent>.from(events);
    final previousTotal = total;
    if (append) {
      loadingMore = true;
    } else {
      loading = true;
      loadingMore = false;
      if (events.isEmpty) {
        total = 0;
        hasMore = false;
      }
    }
    error = null;
    notifyListeners();
    try {
      final result = await repository.fetch(
        query: query,
        city: city,
        category: category,
        period: period,
        price: price,
        sort: sort,
        page: nextPage,
      );
      if (_disposed || revision != _revision) {
        return;
      }
      if (append) {
        final known = events.map((e) => e.id).toSet();
        events = [
          ...events,
          ...result.events.where((e) => !known.contains(e.id)),
        ];
      } else {
        events = result.events;
      }
      categories = result.categories;
      total = result.total;
      page = result.page;
      hasMore = result.hasMore;
    } on DiscoveryFailure catch (e) {
      if (!_disposed && revision == _revision) {
        error = e.message;
        if (!append && events.isEmpty && previousEvents.isNotEmpty) {
          events = previousEvents;
          total = previousTotal;
        }
      }
    } catch (_) {
      if (!_disposed && revision == _revision) {
        error = 'We couldn’t load events. Please try again.';
        if (!append && events.isEmpty && previousEvents.isNotEmpty) {
          events = previousEvents;
          total = previousTotal;
        }
      }
    } finally {
      if (!_disposed && revision == _revision) {
        loading = false;
        loadingMore = false;
        notifyListeners();
      }
    }
  }

  void setQuery(String value) {
    query = value.trim();
    _debounce?.cancel();
    ++_revision;
    loading = true;
    loadingMore = false;
    error = null;
    events = [];
    total = 0;
    hasMore = false;
    notifyListeners();
    _debounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(load()),
    );
  }

  void setCity(String value) {
    city = value;
    unawaited(load());
  }

  void setCategory(String value) {
    category = value;
    unawaited(load());
  }

  void setPeriod(String value) {
    period = value;
    unawaited(load());
  }

  void setPrice(String value) {
    price = value;
    unawaited(load());
  }

  void setSort(String value) {
    sort = value;
    unawaited(load());
  }

  void clearFilters() {
    query = '';
    city = '';
    category = '';
    period = '';
    price = '';
    sort = 'soonest';
    unawaited(load());
  }

  Future<List<CityOption>> cities(String query) => repository.cities(query);
  @override
  void dispose() {
    _disposed = true;
    _revision++;
    _debounce?.cancel();
    repository.close();
    super.dispose();
  }
}
