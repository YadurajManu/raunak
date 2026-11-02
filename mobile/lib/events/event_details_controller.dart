import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'event_details_repository.dart';
export 'event_details_repository.dart';

class EventDetailsController extends ChangeNotifier {
  EventDetailsController(this.repository, this.slug);
  final EventDetailsRepository repository;
  final String slug;
  EventDetails? event;
  bool loading = false, saving = false, continuing = false;
  String? error, notice;
  Map<String, int> quantities = {};
  bool _disposed = false;
  int _revision = 0;
  Timer? _timer;
  int get count => quantities.values.fold(0, (a, b) => a + b);
  int get totalPaise =>
      event?.tickets.fold<int>(
        0,
        (sum, t) => sum + t.pricePaise * (quantities[t.id] ?? 0),
      ) ??
      0;
  int? get startingPricePaise {
    final prices =
        event?.tickets
            .where((t) => t.available)
            .map((t) => t.pricePaise)
            .toList() ??
        [];
    return prices.isEmpty ? null : prices.reduce((a, b) => a < b ? a : b);
  }

  Future<void> load() async {
    final revision = ++_revision;
    loading = true;
    error = null;
    if (!_disposed) notifyListeners();
    try {
      final result = await repository.fetch(slug);
      if (_disposed || revision != _revision) return;
      event = result;
      _reconcile();
      _timer ??= Timer.periodic(const Duration(seconds: 45), (_) {
        if (!loading && !continuing && !saving) unawaited(_refreshQuietly());
      });
    } on EventDetailsFailure catch (e) {
      if (!_disposed && revision == _revision) error = e.message;
    } catch (_) {
      if (!_disposed && revision == _revision) {
        error = 'Event details could not be loaded. Please retry.';
      }
    } finally {
      if (!_disposed && revision == _revision) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> _refreshQuietly() async {
    final revision = _revision;
    try {
      final fresh = await repository.fetch(slug);
      if (!_disposed && revision == _revision && !saving && !continuing) {
        event = fresh;
        _reconcile();
        notifyListeners();
      }
    } catch (_) {
      /* Keep the last view; Continue revalidates availability before leaving. */
    }
  }

  bool _reconcile() {
    final previous = Map<String, int>.from(quantities);
    final next = <String, int>{};
    for (final t in event?.tickets ?? <EventTicket>[]) {
      if (!t.available) continue;
      final old = previous[t.id] ?? 0;
      if (old == 0) continue;
      final value = old > t.maxQuantity ? t.maxQuantity : old;
      if (value >= t.minPerOrder) next[t.id] = value;
    }
    quantities = next;
    final changed = !mapEquals(previous, next);
    if (changed) {
      notice = 'Ticket availability changed. Please check your selection.';
    }
    return changed;
  }

  void increment(EventTicket ticket) {
    if (continuing || loading || !ticket.available || count >= 100) return;
    final current = quantities[ticket.id] ?? 0;
    final next = current == 0 ? ticket.minPerOrder : current + 1;
    if (next > ticket.maxQuantity || count - current + next > 100) return;
    quantities = {...quantities, ticket.id: next};
    notice = null;
    notifyListeners();
  }

  void decrement(EventTicket ticket) {
    if (continuing || loading) return;
    final current = quantities[ticket.id] ?? 0;
    final next = current <= ticket.minPerOrder ? 0 : current - 1;
    quantities = {...quantities};
    if (next == 0) {
      quantities.remove(ticket.id);
    } else {
      quantities[ticket.id] = next;
    }
    notice = null;
    notifyListeners();
  }

  Future<void> toggleSaved() async {
    final current = event;
    if (current == null || saving) return;
    _revision++;
    saving = true;
    final previous = current.saved;
    current.saved = !previous;
    notice = null;
    notifyListeners();
    try {
      current.saved = await repository.save(current.id, current.saved);
      if (!_disposed) {
        notice = current.saved
            ? 'Saved for later.'
            : 'Removed from saved events.';
      }
    } on EventDetailsFailure catch (e) {
      current.saved = previous;
      if (!_disposed) notice = e.message;
    } catch (_) {
      current.saved = previous;
      if (!_disposed) notice = 'Couldn’t save this event. Please retry.';
    } finally {
      if (!_disposed) {
        saving = false;
        notifyListeners();
      }
    }
  }

  Future<Uri?> checkout() async {
    if (continuing || count == 0) return null;
    _revision++;
    continuing = true;
    notice = null;
    notifyListeners();
    try {
      final fresh = await repository.fetch(slug);
      if (_disposed) return null;
      event = fresh;
      if (_reconcile() || count == 0) return null;
      return Uri.parse(repository.auth.apiBase)
          .resolve('/checkout/${Uri.encodeComponent(fresh.slug)}')
          .replace(queryParameters: {'tickets': jsonEncode(quantities)});
    } on EventDetailsFailure catch (e) {
      if (!_disposed) notice = e.message;
      return null;
    } catch (_) {
      if (!_disposed) {
        notice = 'We couldn’t check ticket availability. Please retry.';
      }
      return null;
    } finally {
      if (!_disposed) {
        continuing = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    _timer?.cancel();
    repository.close();
    super.dispose();
  }
}
