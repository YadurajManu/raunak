import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../auth/auth_controller.dart';
import '../booking/wallet_controller.dart';
import 'checkout_screen.dart';
import 'components.dart';
import 'event_details_screen.dart';
import 'theme.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({
    super.key,
    required this.auth,
    this.orderId,
    this.repository,
  });
  final AuthController auth;
  final String? orderId;
  final BookingsRepository? repository;
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen>
    with WidgetsBindingObserver {
  late final WalletController _wallet;
  final _search = TextEditingController();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _wallet = WalletController(
      widget.repository ?? BookingsRepository(widget.auth.repository),
      orderId: widget.orderId,
    );
    unawaited(_wallet.load());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        mounted &&
        (ModalRoute.of(context)?.isCurrent ?? false)) {
      unawaited(_wallet.load());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _search.dispose();
    _wallet.dispose();
    super.dispose();
  }

  Future<void> _openTicket(WalletTicket ticket) async {
    unawaited(HapticFeedback.selectionClick());
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _TicketDetailScreen(
          auth: widget.auth,
          wallet: _wallet,
          ticket: ticket,
        ),
      ),
    );
    if (mounted) unawaited(_wallet.load());
  }

  Future<void> _openPending(PendingBooking booking) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BookingStatusScreen(
          auth: widget.auth,
          orderId: booking.id,
          repository: _wallet.repository,
        ),
      ),
    );
    if (mounted) unawaited(_wallet.load());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('My tickets'),
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      surfaceTintColor: Colors.transparent,
      leading: Navigator.of(context).canPop()
          ? IconButton(
              tooltip: 'Back',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded),
            )
          : null,
      actions: [
        ListenableBuilder(
          listenable: _wallet,
          builder: (context, _) => IconButton(
            tooltip: 'Refresh tickets',
            onPressed: _wallet.loading ? null : () => _wallet.load(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ),
        const SizedBox(width: 8),
      ],
    ),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: _wallet,
        builder: (context, _) {
          if (widget.auth.status != AuthStatus.signedIn) {
            return _WalletState(
              icon: Icons.lock_outline_rounded,
              title: 'Your tickets are private.',
              message:
                  'Sign in to the account used for your booking to see your tickets.',
              action: 'Back to sign in',
              onPressed: () =>
                  Navigator.of(context).popUntil((route) => route.isFirst),
            );
          }
          return RefreshIndicator(
            onRefresh: () => _wallet.load(),
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverToBoxAdapter(
                  child: _bounded(
                    Padding(
                      padding: const EdgeInsets.fromLTRB(22, 18, 22, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Eyebrow(
                            widget.orderId == null
                                ? 'Your way in'
                                : 'Your booking',
                          ),
                          const SizedBox(height: 8),
                          Text(
                            widget.orderId == null
                                ? 'Good plans,\nall together.'
                                : 'Your tickets.',
                            style: Theme.of(context).textTheme.headlineLarge,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Find your event. Show your QR. You’re in.',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: Theme.of(
                                    context,
                                  ).textTheme.bodySmall?.color,
                                ),
                          ),
                          if (widget.orderId == null) ...[
                            const SizedBox(height: 23),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  for (final tab in const [
                                    ('upcoming', 'Upcoming'),
                                    ('past', 'Past'),
                                    ('cancelled', 'Cancelled'),
                                    ('refunded', 'Refunded'),
                                  ]) ...[
                                    _WalletTab(
                                      label: tab.$2,
                                      selected: _wallet.tab == tab.$1,
                                      onPressed: () {
                                        unawaited(
                                          HapticFeedback.selectionClick(),
                                        );
                                        _wallet.setTab(tab.$1);
                                      },
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _search,
                              onChanged: _wallet.setQuery,
                              textInputAction: TextInputAction.search,
                              onSubmitted: (_) {
                                FocusScope.of(context).unfocus();
                                unawaited(_wallet.load());
                              },
                              decoration: InputDecoration(
                                hintText: 'Search your tickets',
                                prefixIcon: const Icon(
                                  Icons.search_rounded,
                                  size: 21,
                                ),
                                suffixIcon: _wallet.query.isEmpty
                                    ? null
                                    : IconButton(
                                        tooltip: 'Clear ticket search',
                                        onPressed: () {
                                          _search.clear();
                                          _wallet.setQuery('');
                                        },
                                        icon: const Icon(
                                          Icons.close_rounded,
                                          size: 19,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
                if (_wallet.loading)
                  SliverToBoxAdapter(child: _bounded(const _WalletLoading()))
                else ...[
                  if (_wallet.pendingBookings.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _bounded(
                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Bookings to check',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 12),
                              for (final booking in _wallet.pendingBookings)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _PendingCard(
                                    booking: booking,
                                    onPressed: () => _openPending(booking),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  if (_wallet.error != null)
                    SliverToBoxAdapter(
                      child: _bounded(
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 22),
                          child: Column(
                            children: [
                              FeedbackBanner(message: _wallet.error!),
                              SecondaryButton(
                                label: 'Try again',
                                onPressed: () => _wallet.load(),
                                icon: Icons.refresh_rounded,
                              ),
                              const SizedBox(height: 22),
                            ],
                          ),
                        ),
                      ),
                    ),
                  if (_wallet.tickets.isEmpty && _wallet.error == null)
                    SliverToBoxAdapter(
                      child: _bounded(
                        _WalletState(
                          icon: _wallet.query.isNotEmpty
                              ? Icons.search_off_rounded
                              : Icons.confirmation_number_outlined,
                          title: _wallet.query.isNotEmpty
                              ? 'No matching tickets.'
                              : widget.orderId != null &&
                                    _wallet.pendingBookings.isNotEmpty
                              ? 'We’re checking your booking.'
                              : switch (_wallet.tab) {
                                  'past' => 'More memories to come.',
                                  'cancelled' => 'No cancelled tickets.',
                                  'refunded' => 'No refunded tickets.',
                                  _ => 'Your next plan is out there.',
                                },
                          message: _wallet.query.isNotEmpty
                              ? 'Try the event name, ticket type or booking reference.'
                              : widget.orderId != null &&
                                    _wallet.pendingBookings.isNotEmpty
                              ? 'Tickets appear after your payment is confirmed. Use “Check booking” above to continue.'
                              : switch (_wallet.tab) {
                                  'past' =>
                                    'Tickets from events you’ve attended will appear here.',
                                  'cancelled' =>
                                    'Any cancelled tickets will be listed here.',
                                  'refunded' =>
                                    'Tickets linked to refunded bookings will appear here.',
                                  _ =>
                                    'Your confirmed tickets will appear here when you book an event.',
                                },
                          action: _wallet.query.isNotEmpty
                              ? 'Clear search'
                              : widget.orderId != null &&
                                    _wallet.pendingBookings.isNotEmpty
                              ? 'Refresh booking'
                              : 'Explore events',
                          onPressed: _wallet.query.isNotEmpty
                              ? () {
                                  _search.clear();
                                  _wallet.setQuery('');
                                }
                              : widget.orderId != null &&
                                    _wallet.pendingBookings.isNotEmpty
                              ? () => _wallet.load()
                              : () => Navigator.of(
                                  context,
                                ).popUntil((route) => route.isFirst),
                        ),
                      ),
                    ),
                  if (_wallet.tickets.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: _bounded(
                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 0, 22, 14),
                          child: Text(
                            '${_wallet.total} ${_wallet.total == 1 ? 'ticket' : 'tickets'}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _bounded(
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 22),
                          child: Column(
                            children: [
                              for (final ticket in _wallet.tickets)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 14),
                                  child: _TicketCard(
                                    ticket: ticket,
                                    onPressed: () => _openTicket(ticket),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (_wallet.hasMore)
                      SliverToBoxAdapter(
                        child: _bounded(
                          Padding(
                            padding: const EdgeInsets.fromLTRB(22, 8, 22, 22),
                            child: SecondaryButton(
                              label: _wallet.loadingMore
                                  ? 'Loading tickets…'
                                  : 'Load more tickets',
                              onPressed: _wallet.loadingMore
                                  ? null
                                  : () => _wallet.load(append: true),
                              icon: Icons.expand_more_rounded,
                            ),
                          ),
                        ),
                      ),
                  ],
                ],
                const SliverToBoxAdapter(child: SizedBox(height: 26)),
              ],
            ),
          );
        },
      ),
    ),
  );
}

Widget _bounded(Widget child) => Center(
  child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 720),
    child: SizedBox(width: double.infinity, child: child),
  ),
);

class _WalletTab extends StatelessWidget {
  const _WalletTab({
    required this.label,
    required this.selected,
    required this.onPressed,
  });
  final String label;
  final bool selected;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        backgroundColor: selected ? RaunakColors.coral : Colors.transparent,
        foregroundColor: selected
            ? RaunakColors.ink
            : Theme.of(context).colorScheme.onSurface,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        side: BorderSide(
          color: selected
              ? RaunakColors.ink
              : Theme.of(context).colorScheme.outline.withValues(alpha: .55),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
    ),
  );
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket, required this.onPressed});
  final WalletTicket ticket;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label:
        '${ticket.event.title}, ${ticket.ticketType}, ${ticket.admissionLabel}',
    child: Material(
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: .025),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: .5),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _EventThumbnail(event: ticket.event, width: 68, height: 92),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ticket.event.title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            height: 1.25,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 7),
                        Text(
                          ticket.event.dateLabel,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (ticket.event.venueLabel.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            ticket.event.venueLabel,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const _Perforation(),
              const SizedBox(height: 13),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ticket.ticketType,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          ticket.quantity > 1
                              ? '1 admission · ${ticket.quantity} in booking'
                              : '1 admission',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Icon(
                    ticket.active
                        ? Icons.qr_code_rounded
                        : Icons.confirmation_number_outlined,
                    color: Theme.of(context).colorScheme.primary,
                    size: 25,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _StatusPill(
                    label: ticket.admissionLabel,
                    active: ticket.active,
                  ),
                  Text(
                    ticket.active ? 'Show ticket →' : 'View ticket →',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _EventThumbnail extends StatelessWidget {
  const _EventThumbnail({
    required this.event,
    required this.width,
    required this.height,
  });
  final EventSummary event;
  final double width, height;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(10),
    child: Container(
      width: width,
      height: height,
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: .06),
      child: _https(event.imageUrl) == null
          ? const Icon(Icons.local_activity_outlined, size: 26)
          : Image.network(
              event.imageUrl!,
              fit: BoxFit.contain,
              excludeFromSemantics: true,
              errorBuilder: (_, error, stack) =>
                  const Icon(Icons.local_activity_outlined, size: 26),
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : const Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 1.5),
                      ),
                    ),
            ),
    ),
  );
}

class _PendingCard extends StatelessWidget {
  const _PendingCard({required this.booking, required this.onPressed});
  final PendingBooking booking;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      border: Border.all(
        color: Theme.of(context).colorScheme.outline.withValues(alpha: .6),
      ),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.schedule_rounded,
              size: 18,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Payment pending',
                style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          booking.event.title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        Text(
          'Your ticket is issued after payment confirmation.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: onPressed,
          icon: const Icon(Icons.refresh_rounded, size: 17),
          label: const Text('Check booking'),
        ),
      ],
    ),
  );
}

class _WalletLoading extends StatelessWidget {
  const _WalletLoading();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 22),
    child: Semantics(
      label: 'Loading your tickets',
      child: Column(
        children: List.generate(
          3,
          (index) => Container(
            height: 148,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: .045),
              borderRadius: BorderRadius.circular(16),
            ),
            child: index == 0
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : null,
          ),
        ),
      ),
    ),
  );
}

class _WalletState extends StatelessWidget {
  const _WalletState({
    required this.icon,
    required this.title,
    required this.message,
    required this.action,
    required this.onPressed,
  });
  final IconData icon;
  final String title, message, action;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(26, 26, 26, 34),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 35, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 19),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.headlineLarge?.copyWith(fontSize: 33),
        ),
        const SizedBox(height: 12),
        Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).textTheme.bodySmall?.color,
          ),
        ),
        const SizedBox(height: 24),
        SecondaryButton(label: action, onPressed: onPressed),
      ],
    ),
  );
}

class _TicketDetailScreen extends StatefulWidget {
  const _TicketDetailScreen({
    required this.auth,
    required this.wallet,
    required this.ticket,
  });
  final AuthController auth;
  final WalletController wallet;
  final WalletTicket ticket;
  @override
  State<_TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<_TicketDetailScreen>
    with WidgetsBindingObserver {
  late WalletTicket _record;
  late String _id;
  TicketDetails? _detail;
  Timer? _refreshTimer;
  bool _checking = true,
      _actionBusy = false,
      _fullscreen = false,
      _foreground = true;
  String? _error;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    _record = widget.ticket;
    _id = widget.ticket.id;
    WidgetsBinding.instance.addObserver(this);
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_foreground &&
          !_fullscreen &&
          (ModalRoute.of(context)?.isCurrent ?? false)) {
        unawaited(_refresh());
      }
    });
    unawaited(_refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (!_foreground) {
      _revision++;
      if (mounted) {
        setState(() {
          _detail = null;
          _checking = true;
        });
      }
    } else if (!_fullscreen) {
      unawaited(_refresh());
    }
  }

  Future<void> _refresh() async {
    if (!_foreground) return;
    final revision = ++_revision;
    if (mounted) {
      setState(() {
        _detail = null;
        _checking = true;
        _error = null;
      });
    }
    try {
      final detail = await widget.wallet.detail(_id);
      if (!mounted || revision != _revision) return;
      setState(() {
        _detail = detail;
        _record = detail;
      });
    } on BookingFailure catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = error.message);
      }
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(
          () => _error =
              'We couldn’t verify this ticket. Please check your connection and retry.',
        );
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _checking = false);
    }
  }

  @override
  void dispose() {
    _revision++;
    _refreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _fullQr() async {
    if (_detail?.qrPayload?.isNotEmpty != true || !_record.active || _checking) {
      return;
    }
    unawaited(HapticFeedback.lightImpact());
    setState(() => _fullscreen = true);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _FullQrScreen(
          wallet: widget.wallet,
          id: _id,
          eventTitle: _record.event.title,
        ),
      ),
    );
    if (mounted) {
      setState(() => _fullscreen = false);
      await _refresh();
    }
  }

  Future<void> _pdf(BuildContext source) async {
    if (_actionBusy || _checking || !_record.pdfAvailable) return;
    final renderBox = source.findRenderObject() as RenderBox?;
    final origin = renderBox != null && renderBox.hasSize
        ? renderBox.localToGlobal(Offset.zero) & renderBox.size
        : const Rect.fromLTWH(0, 0, 1, 1);
    setState(() => _actionBusy = true);
    try {
      final bytes = await widget.wallet.pdf(_id);
      if (!mounted) return;
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'application/pdf')],
          fileNameOverrides: ['raunak-ticket.pdf'],
          title: 'Your Raunak ticket',
          sharePositionOrigin: origin,
        ),
      );
    } on BookingFailure catch (error) {
      _notice(error.message);
    } catch (_) {
      _notice('Your ticket could not be saved. Please try again.');
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  Future<void> _resend() async {
    if (_actionBusy || _checking || !_record.active) return;
    setState(() => _actionBusy = true);
    try {
      await widget.wallet.resend(_record.orderId);
      _notice(
        'Ticket delivery queued. Check your email and enabled delivery channels shortly.',
      );
    } on BookingFailure catch (error) {
      _notice(error.message);
    } catch (_) {
      _notice('We couldn’t queue ticket delivery. Please try again.');
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  void _notice(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your ticket'),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Refresh ticket status',
            onPressed: _checking ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 12, 22, 26),
          child: _bounded(
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _EventThumbnail(
                      event: _record.event,
                      width: 72,
                      height: 96,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _record.event.title,
                            style: Theme.of(
                              context,
                            ).textTheme.headlineLarge?.copyWith(fontSize: 30),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _record.event.dateLabel,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (_record.event.venueLabel.isNotEmpty) ...[
                            const SizedBox(height: 5),
                            Text(
                              _record.event.venueLabel,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                if (_record.event.organizerName.isNotEmpty)
                  Text(
                    'Hosted by ${_record.event.organizerName}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: 16),
                if (detail != null && detail.siblings.length > 1) ...[
                  const Text(
                    'Tickets in this booking',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (
                        var index = 0;
                        index < detail.siblings.length;
                        index++
                      )
                        ChoiceChip(
                          label: Text('Ticket ${index + 1}'),
                          selected: detail.siblings[index].id == _id,
                          onSelected: _checking
                              ? null
                              : (_) {
                                  unawaited(HapticFeedback.selectionClick());
                                  _id = detail.siblings[index].id;
                                  unawaited(_refresh());
                                },
                          selectedColor: RaunakColors.coral.withValues(
                            alpha: .2,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: Theme.of(
                        context,
                      ).colorScheme.outline.withValues(alpha: .65),
                    ),
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: .025),
                  ),
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Eyebrow('Admission ticket'),
                                const SizedBox(height: 7),
                                Text(
                                  _record.ticketType,
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Icon(
                            Icons.confirmation_number_outlined,
                            size: 25,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _InfoLine(
                        label: 'Ticket holder',
                        value: _record.holderName,
                      ),
                      const SizedBox(height: 11),
                      _InfoLine(
                        label: 'Payment',
                        value: _orderLabel(_record.orderStatus),
                      ),
                      const SizedBox(height: 18),
                      const _Perforation(),
                      const SizedBox(height: 20),
                      if (_checking) ...[
                        const Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                        const SizedBox(height: 13),
                        const Text(
                          'Checking admission status…',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13),
                        ),
                      ] else if (_error != null) ...[
                        FeedbackBanner(message: _error!),
                        SecondaryButton(
                          label: 'Verify ticket again',
                          onPressed: _refresh,
                          icon: Icons.refresh_rounded,
                        ),
                      ] else if (detail != null &&
                          detail.active &&
                          detail.qrPayload?.isNotEmpty == true) ...[
                        Center(child: _AdmissionQr(payload: detail.qrPayload!)),
                        const SizedBox(height: 15),
                        Center(
                          child: _StatusPill(
                            label: detail.admissionLabel,
                            active: true,
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Show this QR at the entrance. Keep it private.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, height: 1.5),
                        ),
                        const SizedBox(height: 6),
                        TextButton.icon(
                          onPressed: _fullQr,
                          icon: const Icon(Icons.fullscreen_rounded, size: 20),
                          label: const Text('Show full-screen QR'),
                        ),
                      ] else ...[
                        Icon(
                          _record.status == 'USED'
                              ? Icons.check_circle_outline_rounded
                              : Icons.block_outlined,
                          size: 36,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(height: 13),
                        Text(
                          detail?.admissionLabel ?? _record.admissionLabel,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'This ticket cannot currently be used for entry.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, height: 1.5),
                        ),
                      ],
                      const SizedBox(height: 20),
                      const _Perforation(),
                      const SizedBox(height: 17),
                      const Eyebrow('Ticket reference'),
                      const SizedBox(height: 7),
                      SelectableText(
                        _record.code,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (_record.pdfAvailable) ...[
                  Builder(
                    builder: (source) => PrimaryButton(
                      label: _actionBusy ? 'Please wait…' : 'Save ticket PDF',
                      loading: _actionBusy,
                      onPressed: _checking || _actionBusy || _detail == null
                          ? null
                          : () => _pdf(source),
                      icon: Icons.file_download_outlined,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                if (_record.active) ...[
                  SecondaryButton(
                    label: 'Resend my tickets',
                    onPressed: _checking || _actionBusy || _detail == null
                        ? null
                        : _resend,
                    icon: Icons.send_outlined,
                  ),
                  const SizedBox(height: 18),
                ],
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (_https(_record.event.directionsUrl) != null)
                      OutlinedButton.icon(
                        onPressed: () =>
                            _openLink(context, _record.event.directionsUrl!),
                        icon: const Icon(Icons.directions_outlined, size: 18),
                        label: const Text('Directions'),
                      ),
                    if (_https(_record.event.calendarUrl) != null)
                      OutlinedButton.icon(
                        onPressed: () =>
                            _openLink(context, _record.event.calendarUrl!),
                        icon: const Icon(
                          Icons.calendar_month_outlined,
                          size: 18,
                        ),
                        label: const Text('Add to calendar'),
                      ),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => EventDetailsScreen(
                            slug: _record.event.slug,
                            auth: widget.auth,
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.event_outlined, size: 18),
                      label: const Text('Event details'),
                    ),
                  ],
                ),
                const SizedBox(height: 23),
                const Eyebrow('Booking reference'),
                const SizedBox(height: 6),
                SelectableText(
                  _record.orderId,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 18),
                Text(
                  'Need help with your event? Open event details to contact the organizer.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                TextButton(
                  onPressed: () => openPublicPage(context, '/help'),
                  child: const Text('Raunak support'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FullQrScreen extends StatefulWidget {
  const _FullQrScreen({
    required this.wallet,
    required this.id,
    required this.eventTitle,
  });
  final WalletController wallet;
  final String id, eventTitle;
  @override
  State<_FullQrScreen> createState() => _FullQrScreenState();
}

class _FullQrScreenState extends State<_FullQrScreen>
    with WidgetsBindingObserver {
  TicketDetails? _detail;
  bool _loading = true, _foreground = true;
  String? _error;
  Timer? _timer;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_foreground) unawaited(_load());
    });
    unawaited(_load());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      unawaited(_load());
    } else if (mounted) {
      _revision++;
      setState(() {
        _detail = null;
        _loading = true;
      });
    }
  }

  Future<void> _load() async {
    if (!_foreground) return;
    final revision = ++_revision;
    if (mounted) {
      setState(() {
        _detail = null;
        _loading = true;
        _error = null;
      });
    }
    try {
      final detail = await widget.wallet.detail(widget.id);
      if (mounted && revision == _revision) setState(() => _detail = detail);
    } on BookingFailure catch (error) {
      if (mounted && revision == _revision) {
        setState(() => _error = error.message);
      }
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(
          () => _error =
              'Your ticket could not be verified. Check your connection and retry.',
        );
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _revision++;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      backgroundColor: RaunakColors.ink,
      appBar: AppBar(
        backgroundColor: RaunakColors.ink,
        surfaceTintColor: Colors.transparent,
        foregroundColor: RaunakColors.paper,
        leading: IconButton(
          tooltip: 'Close QR',
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close_rounded),
        ),
        title: const Text(
          'Your way in',
          style: TextStyle(color: RaunakColors.paper),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(26),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.eventTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'InstrumentSerif',
                      color: RaunakColors.paper,
                      fontSize: 32,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 30),
                  if (_loading) ...[
                    const CircularProgressIndicator(
                      color: RaunakColors.paper,
                      strokeWidth: 2,
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Checking your ticket…',
                      style: TextStyle(color: RaunakColors.paper),
                    ),
                  ] else if (_error != null) ...[
                    const Icon(
                      Icons.wifi_off_rounded,
                      color: RaunakColors.paper,
                      size: 32,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: RaunakColors.paper),
                    ),
                    const SizedBox(height: 20),
                    PrimaryButton(
                      label: 'Verify ticket again',
                      onPressed: _load,
                      icon: Icons.refresh_rounded,
                    ),
                  ] else if (detail != null &&
                      detail.active &&
                      detail.qrPayload?.isNotEmpty == true) ...[
                    _AdmissionQr(payload: detail.qrPayload!, maxSize: 320),
                    const SizedBox(height: 25),
                    Text(
                      detail.admissionLabel,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: RaunakColors.paper,
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      detail.code,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFC9C2B6),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Let the entrance team scan this QR.\nDo not share it with anyone else.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFFC9C2B6),
                        height: 1.5,
                        fontSize: 13,
                      ),
                    ),
                  ] else ...[
                    const Icon(
                      Icons.block_outlined,
                      size: 42,
                      color: RaunakColors.paper,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      detail?.admissionLabel ?? 'Ticket unavailable',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: RaunakColors.paper,
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'This ticket cannot be used for entry.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFFC9C2B6)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AdmissionQr extends StatelessWidget {
  const _AdmissionQr({required this.payload, this.maxSize = 260});
  final String payload;
  final double maxSize;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final size = math.min(
        maxSize,
        constraints.maxWidth.isFinite ? constraints.maxWidth : maxSize,
      );
      return Semantics(
        label: 'Private admission QR code',
        image: true,
        child: ExcludeSemantics(
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: QrImageView(
              data: payload,
              version: QrVersions.auto,
              errorCorrectionLevel: QrErrorCorrectLevel.M,
              size: math.max(80, size - 32),
              padding: EdgeInsets.zero,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Colors.black,
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Colors.black,
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 3),
      Text(
        value,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ],
  );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.active});
  final String label;
  final bool active;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: .055),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: active
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.onSurface,
        fontSize: 11,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _Perforation extends StatelessWidget {
  const _Perforation();
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => CustomPaint(
      size: Size(constraints.maxWidth, 1),
      painter: _PerforationPainter(
        Theme.of(context).colorScheme.outline.withValues(alpha: .45),
      ),
    ),
  );
}

class _PerforationPainter extends CustomPainter {
  const _PerforationPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 8) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(math.min(x + 4, size.width), 0),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_PerforationPainter oldDelegate) =>
      color != oldDelegate.color;
}

String _orderLabel(String status) => switch (status) {
  'PAID' => 'Confirmed',
  'REFUNDED' => 'Refunded',
  'PARTIALLY_REFUNDED' => 'Partially refunded',
  'CANCELLED' => 'Cancelled',
  'PENDING' => 'Awaiting confirmation',
  'EXPIRED' => 'Expired',
  _ => 'Not confirmed',
};
Uri? _https(String? value) {
  if (value == null || value.isEmpty) return null;
  final uri = Uri.tryParse(value);
  return uri != null &&
          uri.scheme == 'https' &&
          uri.host.isNotEmpty &&
          uri.userInfo.isEmpty
      ? uri
      : null;
}

Future<void> _openLink(BuildContext context, String value) async {
  final url = _https(value);
  if (url == null) return;
  try {
    if (await launchUrl(url, mode: LaunchMode.externalApplication)) return;
  } catch (_) {}
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open the link. Please try again.'),
      ),
    );
  }
}
