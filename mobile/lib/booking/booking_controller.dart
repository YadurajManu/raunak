import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'bookings_repository.dart';
import 'payment_gateway.dart';
export 'bookings_repository.dart';
export 'payment_gateway.dart';

class BookingController extends ChangeNotifier {
  BookingController(
    this.repository, {
    required this.eventId,
    required Map<String, int> quantities,
    PaymentGateway? gateway,
  }) : quantities = Map.unmodifiable(quantities),
       gateway = gateway ?? CashfreePaymentGateway();
  BookingController.resume(
    this.repository,
    String orderId, {
    PaymentGateway? gateway,
  }) : eventId = '',
       quantities = const {},
       _resumeId = orderId,
       gateway = gateway ?? CashfreePaymentGateway();
  final BookingsRepository repository;
  final String eventId;
  final Map<String, int> quantities;
  final PaymentGateway gateway;
  String? _resumeId, _fingerprint;
  final String _idempotencyKey = const Uuid().v4();
  Quote? quote;
  OrderSnapshot? order;
  bool loading = false, busy = false, verifying = false;
  String? error, notice;
  bool _disposed = false, _polling = false;
  int _revision = 0;
  bool get confirmed => order?.status == 'PAID';
  bool get pending => order?.status == 'PENDING';
  bool get terminal => order != null && !confirmed && !pending;
  String get status => order?.status ?? '';
  Future<void> loadQuote() async {
    if (loading || order != null) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      quote = await repository.quote(eventId, quantities);
    } on BookingFailure catch (e) {
      if (!_disposed) error = e.message;
    } catch (_) {
      if (!_disposed) error = 'Checkout could not be loaded. Please retry.';
    } finally {
      if (!_disposed) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<bool> reserve({
    required String name,
    required String phone,
    required bool whatsappOptIn,
  }) async {
    if (busy || order != null || quote == null) return false;
    final fingerprint = jsonEncode([name.trim(), phone.trim(), whatsappOptIn]);
    if (_fingerprint != null && _fingerprint != fingerprint) {
      error =
          'A reservation may already exist. Check My tickets before changing your details.';
      notifyListeners();
      return false;
    }
    _fingerprint = fingerprint;
    busy = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      final result = await repository.create(
        eventId: eventId,
        quantities: quantities,
        name: name.trim(),
        phone: phone.trim(),
        whatsappOptIn: whatsappOptIn,
        idempotencyKey: _idempotencyKey,
      );
      if (_disposed) return false;
      order = result;
      return true;
    } on BookingFailure catch (e) {
      if (!_disposed) error = e.message;
      return false;
    } catch (_) {
      if (!_disposed) {
        error =
            'We couldn’t confirm the reservation. Retry with the same details or check My tickets.';
      }
      return false;
    } finally {
      if (!_disposed) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> restore() async {
    if (_resumeId == null) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      order = await repository.order(_resumeId!);
    } on BookingFailure catch (e) {
      if (!_disposed) error = e.message;
    } catch (_) {
      if (!_disposed) {
        error = 'Booking status could not be loaded. Please retry.';
      }
    } finally {
      if (!_disposed) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> refresh() async {
    final id = order?.id ?? _resumeId;
    if (id == null || verifying || _disposed) return;
    final revision = ++_revision;
    verifying = true;
    error = null;
    notifyListeners();
    try {
      final fresh = await repository.order(id);
      if (!_disposed && revision == _revision) {
        order = fresh;
        if (fresh.status != "PENDING") gateway.settled();
        if (fresh.verificationDelayed) {
          notice =
              'Your payment is still being checked. Please check again shortly.';
        }
      }
    } on BookingFailure catch (e) {
      if (!_disposed) error = e.message;
    } catch (_) {
      if (!_disposed) {
        error =
            'We couldn’t check the payment. Please retry; don’t pay again yet.';
      }
    } finally {
      if (!_disposed && revision == _revision) {
        verifying = false;
        notifyListeners();
      }
    }
  }

  Future<void> pay() async {
    if (busy || order == null || !pending || _disposed) return;
    busy = true;
    notice = null;
    error = null;
    notifyListeners();
    try {
      await refresh();
      if (!pending || error != null || _disposed) return;
      await gateway.pay(order!);
    } on BookingFailure catch (e) {
      if (!_disposed) notice = e.message;
    } catch (_) {
      if (!_disposed) {
        notice =
            'Payment could not be completed. Check your booking status before retrying.';
      }
    } finally {
      if (!_disposed) {
        busy = false;
        notifyListeners();
      }
    }
    if (!_disposed) await poll();
  }

  Future<void> poll() async {
    if (_polling || _disposed) return;
    _polling = true;
    try {
      for (var i = 0; i < 8 && !_disposed; i++) {
        await refresh();
        if (confirmed || terminal || error != null) break;
        await Future<void>.delayed(const Duration(seconds: 2));
      }
      if (!_disposed && pending) {
        notice ??=
            'Payment is pending. You can check it again here or in My tickets.';
        notifyListeners();
      }
    } finally {
      _polling = false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    repository.close();
    super.dispose();
  }
}
