import 'dart:async';
import 'package:flutter/foundation.dart';
import 'bookings_repository.dart';
export 'bookings_repository.dart';

class WalletController extends ChangeNotifier {
  WalletController(this.repository, {this.orderId});
  final BookingsRepository repository;
  final String? orderId;
  List<WalletTicket> tickets = [];
  List<PendingBooking> pendingBookings = [];
  bool loading = false, loadingMore = false, hasMore = false;
  String? error;
  String tab = 'upcoming', query = '';
  int total = 0, page = 1, _revision = 0;
  bool _disposed = false;
  Timer? _debounce;
  Future<void> load({bool append = false}) async {
    if (_disposed || (append && (loading || loadingMore || !hasMore))) return;
    _debounce?.cancel();
    final revision = ++_revision;
    if (append) {
      loadingMore = true;
    } else {
      loading = true;
      loadingMore = false;
      tickets = [];
      pendingBookings = [];
      total = 0;
      hasMore = false;
    }
    error = null;
    notifyListeners();
    try {
      if (orderId != null && !append) await repository.order(orderId!);
      final result = await repository.wallet(
        tab: tab,
        query: query,
        page: append ? page + 1 : 1,
        orderId: orderId,
      );
      if (_disposed || revision != _revision) return;
      final known = tickets.map((t) => t.id).toSet();
      tickets = append
          ? [...tickets, ...result.tickets.where((t) => !known.contains(t.id))]
          : result.tickets;
      pendingBookings = result.pendingBookings;
      total = result.total;
      page = result.page;
      hasMore = result.hasMore;
    } on BookingFailure catch (e) {
      if (!_disposed && revision == _revision) error = e.message;
    } catch (_) {
      if (!_disposed && revision == _revision) {
        error = 'Your tickets could not be loaded. Please retry.';
      }
    } finally {
      if (!_disposed && revision == _revision) {
        loading = false;
        loadingMore = false;
        notifyListeners();
      }
    }
  }

  void setTab(String value) {
    tab = value;
    unawaited(load());
  }

  void setQuery(String value) {
    query = value.trim();
    _debounce?.cancel();
    _revision++;
    loading = true;
    tickets = [];
    error = null;
    notifyListeners();
    _debounce = Timer(
      const Duration(milliseconds: 350),
      () => unawaited(load()),
    );
  }

  Future<TicketDetails> detail(String id) => repository.detail(id);
  Future<Uint8List> pdf(String id) => repository.pdf(id);
  Future<void> resend(String id) => repository.resend(id);
  @override
  void dispose() {
    _disposed = true;
    _revision++;
    _debounce?.cancel();
    repository.close();
    super.dispose();
  }
}
