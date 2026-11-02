import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../auth/auth_repository.dart';

class EventPhoto {
  const EventPhoto({required this.url, required this.alt});
  final String url, alt;
  factory EventPhoto.fromJson(Map<String, dynamic> j) =>
      EventPhoto(url: j['url'] as String, alt: j['alt'] as String);
}

class LineupPerson {
  const LineupPerson({required this.name, this.role, this.bio, this.imageUrl});
  final String name;
  final String? role, bio, imageUrl;
  factory LineupPerson.fromJson(Map<String, dynamic> j) => LineupPerson(
    name: j['name'] as String,
    role: j['role'] as String?,
    bio: j['bio'] as String?,
    imageUrl: j['imageUrl'] as String?,
  );
}

class EventTicket {
  const EventTicket({
    required this.id,
    required this.name,
    required this.pricePaise,
    required this.remaining,
    required this.minPerOrder,
    required this.maxPerOrder,
    required this.available,
    required this.label,
    this.description,
  });
  final String id, name, label;
  final String? description;
  final int pricePaise, remaining, minPerOrder, maxPerOrder;
  final bool available;
  int get maxQuantity => remaining < maxPerOrder ? remaining : maxPerOrder;
  factory EventTicket.fromJson(Map<String, dynamic> j) => EventTicket(
    id: j['id'] as String,
    name: j['name'] as String,
    description: j['description'] as String?,
    pricePaise: j['pricePaise'] as int,
    remaining: j['remaining'] as int,
    minPerOrder: j['minPerOrder'] as int,
    maxPerOrder: j['maxPerOrder'] as int,
    available: j['available'] as bool,
    label: j['label'] as String,
  );
}

class EventDetails {
  EventDetails.fromJson(Map<String, dynamic> j)
    : id = j['id'] as String,
      slug = j['slug'] as String,
      title = j['title'] as String,
      summary = j['summary'] as String?,
      description = j['description'] as String?,
      dateLabel = j['dateLabel'] as String,
      timeLabel = j['timeLabel'] as String,
      timezone = j['timezone'] as String,
      venueName = j['venueName'] as String?,
      address = j['address'] as String?,
      city = j['city'] as String?,
      mode = j['mode'] as String,
      status = j['status'] as String,
      organizerName = j['organizerName'] as String,
      organizerTagline = j['organizerTagline'] as String?,
      organizerImageUrl = j['organizerImageUrl'] as String?,
      organizerUrl = j['organizerUrl'] as String,
      publicUrl = j['publicUrl'] as String,
      calendarGoogleUrl = j['calendarGoogleUrl'] as String?,
      calendarOutlookUrl = j['calendarOutlookUrl'] as String?,
      calendarIcsUrl = j['calendarIcsUrl'] as String?,
      directionsGoogleUrl = j['directionsGoogleUrl'] as String?,
      directionsAppleUrl = j['directionsAppleUrl'] as String?,
      refundPolicy = j['refundPolicy'] as String?,
      saved = j['saved'] as bool,
      images = (j['images'] as List)
          .map((v) => EventPhoto.fromJson(v as Map<String, dynamic>))
          .toList(),
      people = (j['people'] as List)
          .map((v) => LineupPerson.fromJson(v as Map<String, dynamic>))
          .toList(),
      tickets = (j['tickets'] as List)
          .map((v) => EventTicket.fromJson(v as Map<String, dynamic>))
          .toList();
  final String id,
      slug,
      title,
      dateLabel,
      timeLabel,
      timezone,
      mode,
      status,
      organizerName,
      organizerUrl,
      publicUrl;
  final String? summary,
      description,
      venueName,
      address,
      city,
      organizerTagline,
      organizerImageUrl,
      calendarGoogleUrl,
      calendarOutlookUrl,
      calendarIcsUrl,
      directionsGoogleUrl,
      directionsAppleUrl,
      refundPolicy;
  final List<EventPhoto> images;
  final List<LineupPerson> people;
  final List<EventTicket> tickets;
  bool saved;
}

class EventDetailsFailure implements Exception {
  const EventDetailsFailure(this.message);
  final String message;
}

class EventDetailsRepository {
  EventDetailsRepository(this.auth, {http.Client? client})
    : _client = client ?? http.Client();
  final AuthRepository auth;
  final http.Client _client;
  Future<EventDetails> fetch(String slug) async {
    try {
      final response = await auth.authenticatedRequest(
        'GET',
        '/api/mobile/events/${Uri.encodeComponent(slug)}',
      );
      if (response.statusCode == 404) {
        throw const EventDetailsFailure(
          'This event is no longer available. Explore another plan.',
        );
      }
      if (response.statusCode != 200) {
        throw const EventDetailsFailure(
          'We couldn’t load this event. Please try again.',
        );
      }
      return EventDetails.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>,
      );
    } on AuthFailure catch (e) {
      throw EventDetailsFailure(e.message);
    } on FormatException {
      throw const EventDetailsFailure(
        'This event is temporarily unavailable. Please retry.',
      );
    }
  }

  Future<bool> save(String eventId, bool saved) async {
    try {
      final response = await auth.authenticatedRequest(
        'POST',
        '/api/events/${Uri.encodeComponent(eventId)}/save',
        body: {'saved': saved},
      );
      if (response.statusCode == 401) {
        throw const EventDetailsFailure(
          'Please sign in again to save events. Your selection is still here.',
        );
      }
      if (response.statusCode != 200) {
        throw const EventDetailsFailure(
          'Couldn’t update your saved event. Please try again.',
        );
      }
      return (jsonDecode(response.body) as Map<String, dynamic>)['saved']
          as bool;
    } on AuthFailure catch (e) {
      throw EventDetailsFailure(e.message);
    }
  }

  Future<Uint8List> calendarFile(EventDetails event) async {
    final uri = Uri.tryParse(event.calendarIcsUrl ?? '');
    if (uri == null ||
        uri.origin != Uri.parse(auth.apiBase).origin ||
        !uri.path.startsWith('/api/events/')) {
      throw const EventDetailsFailure('Calendar details are unavailable.');
    }
    try {
      final response = await _client
          .get(uri)
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200 ||
          !response.headers['content-type'].toString().contains(
            'text/calendar',
          ) ||
          response.bodyBytes.length > 1024 * 1024) {
        throw const EventDetailsFailure(
          'Couldn’t download the calendar file. Please retry.',
        );
      }
      return response.bodyBytes;
    } on TimeoutException {
      throw const EventDetailsFailure(
        'The calendar download timed out. Please retry.',
      );
    } on http.ClientException {
      throw const EventDetailsFailure('Check your connection and try again.');
    }
  }

  void close() => _client.close();
}
