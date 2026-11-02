import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../auth/auth_controller.dart';
import '../events/event_details_controller.dart';
import 'artwork_cache.dart';
import 'components.dart';
import 'checkout_screen.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Redesigned Event Details Screen with iOS 26 Liquid Glass
///
/// Features:
/// 1. Floating Liquid Glass Booking Bar pinned at bottom with live price calculation.
/// 2. Collapsing Hero Header with translucent back & share controls.
/// 3. Interactive Photo Carousel with pinch-to-zoom full screen viewer.
/// 4. Liquid Glass Organizer and Venue directions cards.
/// 5. Interactive Ticket Tier Selector with tactile (+ / −) glass steppers.
class EventDetailsScreen extends StatefulWidget {
  const EventDetailsScreen({
    super.key,
    required this.slug,
    required this.auth,
    this.repository,
  });

  final String slug;
  final AuthController auth;
  final EventDetailsRepository? repository;

  @override
  State<EventDetailsScreen> createState() => _EventDetailsScreenState();
}

class _EventDetailsScreenState extends State<EventDetailsScreen> {
  late final EventDetailsController _event;
  final _scrollController = ScrollController();
  bool _descriptionExpanded = false;
  bool _showCompactBar = false;

  @override
  void initState() {
    super.initState();
    _event = EventDetailsController(
      widget.repository ?? EventDetailsRepository(widget.auth.repository),
      widget.slug,
    );
    _scrollController.addListener(_onScroll);
    unawaited(_event.load());
  }

  void _onScroll() {
    final show = _scrollController.hasClients && _scrollController.offset > 180;
    if (show != _showCompactBar) {
      setState(() => _showCompactBar = show);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _event.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      extendBody: true,
      body: ListenableBuilder(
        listenable: _event,
        builder: (context, _) {
          if (_event.loading && _event.event == null) {
            return const Center(child: CircularProgressIndicator(strokeWidth: 2));
          }

          final event = _event.event;
          if (event == null) {
            return _buildErrorState(context);
          }

          return Stack(
            children: [
              // Main scrollable content
              RefreshIndicator(
                onRefresh: _event.load,
                color: Theme.of(context).colorScheme.primary,
                child: SingleChildScrollView(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(
                    0,
                    0,
                    0,
                    MediaQuery.paddingOf(context).bottom + 120,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Hero Poster Gallery
                          if (event.images.isNotEmpty)
                            _PosterGallery(
                              photos: event.images,
                              title: event.title,
                            )
                          else
                            const SizedBox(height: 90),

                          Padding(
                            padding: const EdgeInsets.fromLTRB(22, 20, 22, 28),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Status banner if cancelled or ended
                                if (event.status == 'CANCELLED')
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 16),
                                    child: FeedbackBanner(
                                      message:
                                          'This event has been cancelled. Ticket booking is unavailable.',
                                    ),
                                  ),
                                if (event.status == 'ENDED')
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 16),
                                    child: FeedbackBanner(
                                      message: 'This event has ended.',
                                      isError: false,
                                    ),
                                  ),

                                // Title & Tagline
                                Text(
                                  event.title,
                                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                                    fontSize: 38,
                                    height: 1.07,
                                  ),
                                ),
                                if (event.summary?.isNotEmpty == true) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    event.summary!,
                                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                      color: Theme.of(context).textTheme.bodySmall?.color,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 24),

                                // Essentials & Venue Cards
                                _essentialsCard(event),
                                const SizedBox(height: 16),

                                // Organizer Glass Card
                                _organizerCard(event),
                                const SizedBox(height: 16),

                                // Interactive Action Chips (Save, Calendar, Share)
                                _actionChips(event),

                                if (_event.error != null) ...[
                                  const SizedBox(height: 14),
                                  FeedbackBanner(message: _event.error!),
                                ],
                                if (_event.notice != null) ...[
                                  const SizedBox(height: 14),
                                  FeedbackBanner(message: _event.notice!, isError: false),
                                ],

                                // Event Description ("The plan")
                                if (event.description?.isNotEmpty == true) ...[
                                  const SizedBox(height: 28),
                                  _heading('The plan'),
                                  const SizedBox(height: 12),
                                  _description(event.description!),
                                ],

                                // Lineup / Artists
                                if (event.people.isNotEmpty) ...[
                                  const SizedBox(height: 30),
                                  _heading('Meet the lineup'),
                                  const SizedBox(height: 16),
                                  _lineup(event),
                                ],

                                // Where to meet (Venue details & directions)
                                if (event.mode != 'ONLINE' &&
                                    (event.venueName?.isNotEmpty == true ||
                                        event.address?.isNotEmpty == true)) ...[
                                  const SizedBox(height: 30),
                                  _heading('Where to meet'),
                                  const SizedBox(height: 14),
                                  _venueCard(event),
                                ],

                                // Ticket Tiers Selection Section
                                const SizedBox(height: 32),
                                _heading('Your way in'),
                                const SizedBox(height: 8),
                                Text(
                                  'Choose tickets below. Availability is checked again before checkout.',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                const SizedBox(height: 16),

                                if (event.tickets.isEmpty)
                                  LiquidGlass(
                                    borderRadius: 16,
                                    padding: const EdgeInsets.all(20),
                                    child: const Text(
                                      'Tickets are not available for this event yet.',
                                    ),
                                  ),

                                for (final ticket in event.tickets)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 14),
                                    child: _ticketCard(ticket),
                                  ),

                                // Refund Policy
                                if (event.refundPolicy?.isNotEmpty == true) ...[
                                  const SizedBox(height: 14),
                                  LiquidGlass(
                                    borderRadius: 16,
                                    child: ExpansionTile(
                                      tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                      title: Text(
                                        'Refund policy',
                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      children: [
                                        Align(
                                          alignment: Alignment.centerLeft,
                                          child: Text(
                                            event.refundPolicy!,
                                            style: Theme.of(context).textTheme.bodyMedium,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 24),
                                Text(
                                  'Hosted by ${event.organizerName}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Floating Collapsing Header Controls
              _buildTopHeader(context, event),

              // Floating Liquid Glass Booking Bar
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _floatingBookingBar(context),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Collapsing Hero Header with floating liquid glass controls
  Widget _buildTopHeader(BuildContext context, EventDetails event) {
    final topPadding = MediaQuery.paddingOf(context).top;

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.fromLTRB(16, topPadding + 6, 16, 8),
        child: Row(
          children: [
            // Floating back button with Liquid Glass blur
            LiquidGlass(
              borderRadius: 22,
              blur: 24,
              child: IconButton(
                tooltip: 'Back to events',
                icon: const Icon(Icons.arrow_back_rounded, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            const SizedBox(width: 8),

            // Compact title when scrolled
            Expanded(
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 200),
                opacity: _showCompactBar ? 1.0 : 0.0,
                child: LiquidGlass(
                  borderRadius: 20,
                  blur: 24,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Text(
                    event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Geist',
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Bookmark Button
            LiquidGlass(
              borderRadius: 22,
              blur: 24,
              child: IconButton(
                tooltip: event.saved ? 'Saved' : 'Save event',
                icon: _event.saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        event.saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        size: 20,
                        color: event.saved ? RaunakColors.coral : null,
                      ),
                onPressed: _event.saving
                    ? null
                    : () {
                        unawaited(HapticFeedback.selectionClick());
                        unawaited(_event.toggleSaved());
                      },
              ),
            ),
            const SizedBox(width: 6),

            // Share Button
            LiquidGlass(
              borderRadius: 22,
              blur: 24,
              child: IconButton(
                tooltip: 'Share event',
                icon: const Icon(Icons.ios_share_rounded, size: 19),
                onPressed: () => _share(event),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Floating Liquid Glass Booking Bar pinned at bottom
  Widget _floatingBookingBar(BuildContext context) {
    final chosen = _event.count > 0;
    final starting = _event.startingPricePaise;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, bottomPadding > 0 ? bottomPadding + 6 : 14),
      child: LiquidGlass(
        borderRadius: 28,
        blur: 30,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shadows: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    chosen
                        ? '${_event.count} ${_event.count == 1 ? 'ticket selected' : 'tickets selected'}'
                        : 'Choose your tickets',
                    style: TextStyle(
                      fontFamily: 'Geist',
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).textTheme.bodySmall?.color,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    chosen
                        ? _money(_event.totalPaise)
                        : starting == null
                            ? 'See ticket options'
                            : starting == 0
                                ? 'Free Admission'
                                : 'From ${_money(starting)}',
                    style: TextStyle(
                      fontFamily: 'Geist',
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: chosen ? RaunakColors.coral : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),

            // Tactile Continue Button
            SizedBox(
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: RaunakColors.coral,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                onPressed: chosen && !_event.continuing ? () => _checkout() : null,
                child: _event.continuing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Continue',
                            style: TextStyle(
                              fontFamily: 'Geist',
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          SizedBox(width: 6),
                          Icon(Icons.arrow_forward_rounded, size: 18),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Essentials Card (Date, Time, Venue)
  Widget _essentialsCard(EventDetails e) => LiquidGlass(
    borderRadius: 20,
    blur: 20,
    padding: const EdgeInsets.all(18),
    child: Column(
      children: [
        _metaRow(
          Icons.calendar_today_rounded,
          e.dateLabel,
          subtitle: e.timeLabel,
        ),
        Divider(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15), height: 24),
        _metaRow(
          e.mode == 'ONLINE' ? Icons.videocam_rounded : Icons.location_on_rounded,
          e.mode == 'ONLINE'
              ? 'Online Event'
              : [e.venueName, e.city].whereType<String>().where((v) => v.isNotEmpty).join(' · '),
          subtitle: e.mode == 'ONLINE'
              ? 'Private stream link provided with tickets'
              : e.address,
        ),
      ],
    ),
  );

  Widget _metaRow(IconData icon, String text, {String? subtitle}) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: RaunakColors.coral.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: RaunakColors.coral, size: 20),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              text.isEmpty ? 'Details to follow' : text,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
            if (subtitle?.isNotEmpty == true) ...[
              const SizedBox(height: 3),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    ],
  );

  /// Organizer Card
  Widget _organizerCard(EventDetails e) => LiquidGlass(
    borderRadius: 20,
    blur: 20,
    padding: const EdgeInsets.all(16),
    child: InkWell(
      onTap: e.organizerUrl.isEmpty ? null : () => _open(e.organizerUrl),
      borderRadius: BorderRadius.circular(16),
      child: Row(
        children: [
          LiquidGlassAvatar(
            size: 48,
            name: e.organizerName,
            imageUrl: e.organizerImageUrl,
            tooltip: e.organizerName,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'HOSTED BY',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 10,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.verified_rounded, size: 13, color: RaunakColors.coral),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  e.organizerName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (e.organizerTagline?.isNotEmpty == true)
                  Text(
                    e.organizerTagline!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_ios_rounded, size: 14),
        ],
      ),
    ),
  );

  /// Venue Card with Directions
  Widget _venueCard(EventDetails e) => LiquidGlass(
    borderRadius: 20,
    blur: 20,
    padding: const EdgeInsets.all(18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (e.venueName?.isNotEmpty == true)
          Text(
            e.venueName!,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        if (e.address?.isNotEmpty == true) ...[
          const SizedBox(height: 4),
          Text(e.address!, style: Theme.of(context).textTheme.bodyMedium),
        ],
        if (e.directionsGoogleUrl != null || e.directionsAppleUrl != null) ...[
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () => _directions(e),
            icon: const Icon(Icons.near_me_rounded, size: 17),
            label: const Text('Get directions'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ],
    ),
  );

  /// Action chips (Save, Calendar, Share)
  Widget _actionChips(EventDetails e) => Row(
    children: [
      Expanded(
        child: LiquidGlass(
          borderRadius: 14,
          blur: 16,
          child: InkWell(
            onTap: _event.saving
                ? null
                : () {
                    unawaited(HapticFeedback.selectionClick());
                    unawaited(_event.toggleSaved());
                  },
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    e.saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    size: 16,
                    color: e.saved ? RaunakColors.coral : null,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    e.saved ? 'Saved' : 'Save',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: LiquidGlass(
          borderRadius: 14,
          blur: 16,
          child: InkWell(
            onTap: e.calendarGoogleUrl == null &&
                    e.calendarOutlookUrl == null &&
                    e.calendarIcsUrl == null
                ? null
                : () => _calendar(e),
            borderRadius: BorderRadius.circular(14),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.calendar_month_rounded, size: 16),
                  SizedBox(width: 6),
                  Text('Calendar', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ],
              ),
            ),
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: LiquidGlass(
          borderRadius: 14,
          blur: 16,
          child: InkWell(
            onTap: () => _share(e),
            borderRadius: BorderRadius.circular(14),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.ios_share_rounded, size: 16),
                  SizedBox(width: 6),
                  Text('Share', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ],
              ),
            ),
          ),
        ),
      ),
    ],
  );

  /// Ticket Tier Card with Liquid Glass Steppers
  Widget _ticketCard(EventTicket ticket) {
    final q = _event.quantities[ticket.id] ?? 0;
    final canAdd = ticket.available && q < ticket.maxPerOrder && q < ticket.remaining;

    return LiquidGlass(
      borderRadius: 18,
      blur: 20,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ticket.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _money(ticket.pricePaise),
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: ticket.pricePaise == 0
                            ? Colors.green
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: ticket.available
                      ? RaunakColors.coral.withValues(alpha: 0.12)
                      : Colors.grey.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  ticket.label,
                  style: TextStyle(
                    fontFamily: 'Geist',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: ticket.available ? RaunakColors.coral : Colors.grey,
                  ),
                ),
              ),
            ],
          ),
          if (ticket.description?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(ticket.description!, style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 14),

          // Stepper row
          Row(
            children: [
              Expanded(
                child: Text(
                  ticket.available
                      ? '${ticket.minPerOrder}–${math.min(ticket.maxPerOrder, ticket.remaining)} per booking'
                      : ticket.label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(width: 10),
              // Tactile Stepper Box
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Remove ${ticket.name}',
                      visualDensity: VisualDensity.compact,
                      onPressed: q > 0 && !_event.continuing
                          ? () {
                              unawaited(HapticFeedback.selectionClick());
                              _event.decrement(ticket);
                            }
                          : null,
                      icon: const Icon(Icons.remove_rounded, size: 18),
                    ),
                    Semantics(
                      liveRegion: true,
                      label: '$q ${ticket.name} selected',
                      child: SizedBox(
                        width: 24,
                        child: Text(
                          '$q',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: 'Geist',
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Add ${ticket.name}',
                      visualDensity: VisualDensity.compact,
                      onPressed: canAdd && !_event.continuing
                          ? () {
                              unawaited(HapticFeedback.selectionClick());
                              _event.increment(ticket);
                            }
                          : null,
                      icon: const Icon(Icons.add_rounded, size: 18),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heading(String text) => Text(
    text,
    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
      fontSize: 28,
      height: 1.1,
    ),
  );

  Widget _description(String text) {
    final clipped = text.length > 600 && !_descriptionExpanded;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MarkdownBody(
          data: clipped ? '${text.substring(0, 600)}…' : text,
          selectable: true,
          onTapLink: (_, href, _) {
            if (href != null) unawaited(_open(href));
          },
          styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
            p: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.65),
          ),
        ),
        if (text.length > 600)
          TextButton(
            onPressed: () => setState(() => _descriptionExpanded = !_descriptionExpanded),
            child: Text(_descriptionExpanded ? 'Show less' : 'Read more'),
          ),
      ],
    );
  }

  Widget _lineup(EventDetails e) => LayoutBuilder(
    builder: (context, box) {
      final width = box.maxWidth >= 500 ? (box.maxWidth - 32) / 3 : (box.maxWidth - 16) / 2;
      return Wrap(
        spacing: 16,
        runSpacing: 20,
        children: [
          for (final person in e.people)
            SizedBox(
              width: width,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LiquidGlassAvatar(
                    size: 58,
                    name: person.name,
                    imageUrl: person.imageUrl,
                    tooltip: person.name,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    person.name,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (person.role?.isNotEmpty == true)
                    Text(
                      person.role!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  if (person.bio?.isNotEmpty == true) ...[
                    const SizedBox(height: 6),
                    Text(
                      person.bio!,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
        ],
      );
    },
  );

  String _money(int value) => value == 0
      ? 'Free'
      : '₹${value % 100 == 0 ? value ~/ 100 : (value / 100).toStringAsFixed(2)}';

  Future<void> _checkout() async {
    final uri = await _event.checkout();
    if (uri != null && mounted && _event.event != null) {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) => CheckoutScreen(
            auth: widget.auth,
            event: _event.event!,
            quantities: Map.from(_event.quantities),
          ),
        ),
      );
      if (mounted) {
        unawaited(_event.load());
      }
    }
  }

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null &&
        (uri.scheme == 'https' ||
            uri.scheme == 'http' &&
                {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host))) {
      try {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {}
    }
  }

  Future<void> _directions(EventDetails e) async {
    final url = Theme.of(context).platform == TargetPlatform.iOS
        ? e.directionsAppleUrl ?? e.directionsGoogleUrl
        : e.directionsGoogleUrl ?? e.directionsAppleUrl;
    if (url != null) await _open(url);
  }

  Future<void> _calendar(EventDetails e) async {
    final url = e.calendarGoogleUrl ?? e.calendarOutlookUrl ?? e.calendarIcsUrl;
    if (url != null) await _open(url);
  }

  Future<void> _share(EventDetails e) async {
    final url = e.publicUrl.isNotEmpty ? e.publicUrl : 'https://raunak.yaduraj.me';
    await SharePlus.instance.share(ShareParams(text: url));
  }

  Widget _buildErrorState(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.event_busy_outlined,
            size: 36,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 20),
          Text(
            'This plan needs a moment.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontSize: 32),
          ),
          const SizedBox(height: 12),
          Text(_event.error ?? 'This event is unavailable.', textAlign: TextAlign.center),
          const SizedBox(height: 24),
          SecondaryButton(
            label: 'Try again',
            onPressed: () => _event.load(),
          ),
        ],
      ),
    ),
  );
}

/// Interactive Photo Gallery Carousel with Liquid Glass pagination pill
class _PosterGallery extends StatefulWidget {
  const _PosterGallery({required this.photos, required this.title});
  final List<EventPhoto> photos;
  final String title;

  @override
  State<_PosterGallery> createState() => _PosterGalleryState();
}

class _PosterGalleryState extends State<_PosterGallery> {
  final _pages = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      LayoutBuilder(
        builder: (context, box) => SizedBox(
          height: math.min(box.maxWidth * 1.12, 440),
          child: Stack(
            children: [
              PageView.builder(
                controller: _pages,
                itemCount: widget.photos.length,
                onPageChanged: (value) => setState(() => _index = value),
                itemBuilder: (context, index) => Semantics(
                  button: true,
                  label: 'Open photo ${index + 1} of ${widget.photos.length}',
                  child: InkWell(
                    onTap: () => _fullscreen(index),
                    child: CachedArtworkImage(
                      imageUrl: widget.photos[index].url,
                      fit: BoxFit.cover,
                      borderRadius: 0,
                      semanticLabel: widget.photos[index].alt,
                    ),
                  ),
                ),
              ),

              // Floating Liquid Glass photo counter pill
              Positioned(
                right: 16,
                bottom: 16,
                child: LiquidGlass(
                  borderRadius: 14,
                  blur: 24,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.photo_library_outlined, size: 14, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        '${_index + 1} / ${widget.photos.length}',
                        style: const TextStyle(
                          fontFamily: 'Geist',
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  void _fullscreen(int index) => Navigator.push(
    context,
    MaterialPageRoute<void>(
      builder: (_) => _FullGallery(
        photos: widget.photos,
        initial: index,
        title: widget.title,
      ),
      fullscreenDialog: true,
    ),
  );
}

/// Fullscreen zoomable photo viewer
class _FullGallery extends StatefulWidget {
  const _FullGallery({
    required this.photos,
    required this.initial,
    required this.title,
  });

  final List<EventPhoto> photos;
  final int initial;
  final String title;

  @override
  State<_FullGallery> createState() => _FullGalleryState();
}

class _FullGalleryState extends State<_FullGallery> {
  late final PageController _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
      title: Text(
        '${_index + 1} of ${widget.photos.length}',
        style: const TextStyle(fontSize: 14),
      ),
      leading: IconButton(
        tooltip: 'Close photos',
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.close_rounded),
      ),
    ),
    body: SafeArea(
      child: PageView.builder(
        controller: _pages,
        itemCount: widget.photos.length,
        onPageChanged: (value) => setState(() => _index = value),
        itemBuilder: (context, index) => InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(
            child: CachedArtworkImage(
              imageUrl: widget.photos[index].url,
              fit: BoxFit.contain,
              borderRadius: 0,
              semanticLabel: widget.photos[index].alt,
            ),
          ),
        ),
      ),
    ),
    bottomNavigationBar: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Text(
          widget.title,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, fontSize: 12),
        ),
      ),
    ),
  );
}
