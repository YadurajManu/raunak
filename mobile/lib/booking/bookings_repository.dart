import 'dart:convert';
import 'dart:typed_data';
import '../auth/auth_repository.dart';

class BookingFailure implements Exception {
  const BookingFailure(this.message);
  final String message;
}

class EventSummary {
  EventSummary.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      slug = j['slug'] as String,
      title = j['title'] as String,
      dateLabel = j['dateLabel'] as String,
      venueLabel = j['venueLabel'] as String,
      imageUrl = j['imageUrl'] as String?,
      organizerName = j['organizerName'] as String? ?? '',
      publicUrl = j['publicUrl'] as String? ?? '',
      directionsUrl = j['directionsUrl'] as String?,
      calendarUrl = j['calendarUrl'] as String?;
  final String id, slug, title, dateLabel, venueLabel, organizerName, publicUrl;
  final String? imageUrl, directionsUrl, calendarUrl;
}

class BookingLine {
  BookingLine.fromJson(Map<String, dynamic> j)
    : ticketTypeId = j['ticketTypeId'] as String,
      name = j['name'] as String,
      quantity = j['quantity'] as int,
      unitPricePaise = j['unitPricePaise'] as int,
      lineTotalPaise = j['lineTotalPaise'] as int;
  final String ticketTypeId, name;
  final int quantity, unitPricePaise, lineTotalPaise;
}

class Quote {
  Quote.fromJson(Map<String, dynamic> j, {this.whatsappAvailable = false})
    : items = (j['items'] as List)
          .map((v) => BookingLine.fromJson(v as Map<String, dynamic>))
          .toList(),
      quantity = j['quantity'] as int,
      subtotalPaise = j['subtotalPaise'] as int,
      feePaise = j['feePaise'] as int,
      totalPaise = j['totalPaise'] as int;
  final List<BookingLine> items;
  final int quantity, subtotalPaise, feePaise, totalPaise;
  final bool whatsappAvailable;
}

class OrderSnapshot {
  OrderSnapshot.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      status = j['status'] as String,
      expiresAt = DateTime.parse(j['expiresAt'] as String),
      paymentSessionId = j['paymentSessionId'] as String?,
      cashfreeOrderId = j['cashfreeOrderId'] as String?,
      cashfreeEnvironment = j['cashfreeEnvironment'] as String,
      buyerName = j['buyerName'] as String,
      buyerEmail = j['buyerEmail'] as String,
      buyerPhone = j['buyerPhone'] as String?,
      whatsappOptIn = j['whatsappOptIn'] as bool,
      subtotalPaise = j['subtotalPaise'] as int,
      feePaise = j['feePaise'] as int,
      totalPaise = j['totalPaise'] as int,
      items = (j['items'] as List)
          .map((v) => BookingLine.fromJson(v as Map<String, dynamic>))
          .toList(),
      event = EventSummary.fromJson(j['event'] as Map<String, dynamic>),
      verificationDelayed = j['verificationDelayed'] as bool? ?? false;
  final String id, status, cashfreeEnvironment, buyerName, buyerEmail;
  final DateTime expiresAt;
  final String? paymentSessionId, cashfreeOrderId, buyerPhone;
  final bool whatsappOptIn, verificationDelayed;
  final int subtotalPaise, feePaise, totalPaise;
  final List<BookingLine> items;
  final EventSummary event;
}

class WalletTicket {
  WalletTicket.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      code = j['code'] as String,
      orderId = j['orderId'] as String,
      ticketType = j['ticketType'] as String,
      holderName = j['holderName'] as String,
      status = j['status'] as String,
      orderStatus = j['orderStatus'] as String,
      admissionLabel = j['admissionLabel'] as String,
      quantity = j['quantity'] as int,
      active = j['active'] as bool,
      pdfAvailable = j['pdfAvailable'] as bool,
      event = EventSummary.fromJson(j['event'] as Map<String, dynamic>);
  final String id,
      code,
      orderId,
      ticketType,
      holderName,
      status,
      orderStatus,
      admissionLabel;
  final int quantity;
  final bool active, pdfAvailable;
  final EventSummary event;
}

class TicketSibling {
  TicketSibling.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      code = j['code'] as String;
  final String id, code;
}

class TicketDetails extends WalletTicket {
  TicketDetails.fromJson(super.j)
    : qrPayload = j['qrPayload'] as String?,
      siblings = (j['siblings'] as List)
          .map((v) => TicketSibling.fromJson(v as Map<String, dynamic>))
          .toList(),
      super.fromJson();
  final String? qrPayload;
  final List<TicketSibling> siblings;
}

class PendingBooking {
  PendingBooking.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      status = j['status'] as String,
      totalPaise = j['totalPaise'] as int,
      event = EventSummary.fromJson(j['event'] as Map<String, dynamic>);
  final String id, status;
  final int totalPaise;
  final EventSummary event;
}

class WalletPage {
  WalletPage.fromJson(Map<String, dynamic> j)
    : tickets = (j['tickets'] as List)
          .map((v) => WalletTicket.fromJson(v as Map<String, dynamic>))
          .toList(),
      pendingBookings = (j['pendingBookings'] as List)
          .map((v) => PendingBooking.fromJson(v as Map<String, dynamic>))
          .toList(),
      total = j['total'] as int,
      page = j['page'] as int,
      hasMore = j['hasMore'] as bool;
  final List<WalletTicket> tickets;
  final List<PendingBooking> pendingBookings;
  final int total, page;
  final bool hasMore;
}

class BookingsRepository {
  BookingsRepository(this.auth);
  final AuthRepository auth;
  Future<Map<String, dynamic>> _json(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await auth.authenticatedRequest(
        method,
        path,
        body: body,
      );
      if (response.statusCode == 401) {
        throw const BookingFailure(
          'Your session expired. Sign in again to continue.',
        );
      }
      Map<String, dynamic>? json;
      try {
        json = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        throw const BookingFailure(
          'We couldn’t read your booking. Please retry.',
        );
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw BookingFailure(
          json['error'] as String? ??
              'Your booking could not be loaded. Please retry.',
        );
      }
      return json;
    } on AuthFailure catch (e) {
      throw BookingFailure(e.message);
    }
  }

  List<Map<String, dynamic>> _items(Map<String, int> quantities) => quantities
      .entries
      .where((e) => e.value > 0)
      .map((e) => {'ticketTypeId': e.key, 'quantity': e.value})
      .toList();
  Future<Quote> quote(String eventId, Map<String, int> quantities) async {
    final quote = await _json(
      'POST',
      '/api/checkout/quote',
      body: {'eventId': eventId, 'items': _items(quantities)},
    );
    final config = await _json(
      'GET',
      '/api/mobile/checkout-config?eventId=${Uri.encodeComponent(eventId)}',
    );
    return Quote.fromJson(
      quote,
      whatsappAvailable: config['whatsappAvailable'] as bool,
    );
  }

  Future<OrderSnapshot> create({
    required String eventId,
    required Map<String, int> quantities,
    required String name,
    required String phone,
    required bool whatsappOptIn,
    required String idempotencyKey,
  }) async => OrderSnapshot.fromJson(
    await _json(
      'POST',
      '/api/checkout',
      body: {
        'eventId': eventId,
        'items': _items(quantities),
        'buyerName': name,
        'buyerPhone': phone,
        'whatsappOptIn': whatsappOptIn,
        'idempotencyKey': idempotencyKey,
      },
    ),
  );
  Future<OrderSnapshot> order(String id) async => OrderSnapshot.fromJson(
    await _json('GET', '/api/mobile/orders/${Uri.encodeComponent(id)}'),
  );
  Future<WalletPage> wallet({
    String tab = 'upcoming',
    String query = '',
    int page = 1,
    String? orderId,
  }) async => WalletPage.fromJson(
    await _json(
      'GET',
      Uri(
        path: '/api/mobile/tickets',
        queryParameters: {
          'tab': tab,
          'q': query,
          'page': '$page',
          'orderId': ?orderId,
        },
      ).toString(),
    ),
  );
  Future<TicketDetails> detail(String id) async => TicketDetails.fromJson(
    await _json('GET', '/api/mobile/tickets/${Uri.encodeComponent(id)}'),
  );
  Future<Uint8List> pdf(String id) async {
    try {
      final response = await auth.authenticatedRequest(
        'GET',
        '/api/tickets/${Uri.encodeComponent(id)}/pdf',
      );
      if (response.statusCode == 202) {
        throw const BookingFailure(
          'Your PDF is being prepared. Please try again shortly.',
        );
      }
      if (response.statusCode != 200 ||
          !response.headers['content-type'].toString().contains(
            'application/pdf',
          )) {
        throw const BookingFailure(
          'This PDF is unavailable. Refresh your ticket and try again.',
        );
      }
      return response.bodyBytes;
    } on AuthFailure catch (e) {
      throw BookingFailure(e.message);
    }
  }

  Future<void> resend(String id) async {
    await _json(
      'POST',
      '/api/orders/${Uri.encodeComponent(id)}/resend',
      body: {},
    );
  }

  void close() {}
}
