import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../auth/auth_controller.dart';
import '../booking/booking_controller.dart';
import '../events/event_details_repository.dart';
import 'artwork_cache.dart';
import 'components.dart';
import 'liquid_glass.dart';
import 'theme.dart';
import 'wallet_screen.dart';

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({
    super.key,
    required this.auth,
    required this.event,
    required this.quantities,
    this.repository,
    this.gateway,
  });
  final AuthController auth;
  final EventDetails event;
  final Map<String, int> quantities;
  final BookingsRepository? repository;
  final PaymentGateway? gateway;
  @override
  Widget build(BuildContext context) => _BookingFlow(
    auth: auth,
    event: event,
    quantities: quantities,
    repository: repository,
    gateway: gateway,
  );
}

class BookingStatusScreen extends StatelessWidget {
  const BookingStatusScreen({
    super.key,
    required this.auth,
    required this.orderId,
    this.repository,
    this.gateway,
  });
  final AuthController auth;
  final String orderId;
  final BookingsRepository? repository;
  final PaymentGateway? gateway;
  @override
  Widget build(BuildContext context) => _BookingFlow(
    auth: auth,
    orderId: orderId,
    repository: repository,
    gateway: gateway,
  );
}

class _BookingFlow extends StatefulWidget {
  const _BookingFlow({
    required this.auth,
    this.event,
    this.quantities = const {},
    this.orderId,
    this.repository,
    this.gateway,
  });
  final AuthController auth;
  final EventDetails? event;
  final Map<String, int> quantities;
  final String? orderId;
  final BookingsRepository? repository;
  final PaymentGateway? gateway;
  @override
  State<_BookingFlow> createState() => _BookingFlowState();
}

class _BookingFlowState extends State<_BookingFlow>
    with WidgetsBindingObserver {
  late final BookingController _booking;
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.auth.user?.name ?? '');
  final _phone = TextEditingController();
  bool _whatsapp = false,
      _submitting = false,
      _allowPop = false,
      _celebrated = false;
  String _paymentMethod = 'upi_gpay';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final repo =
        widget.repository ?? BookingsRepository(widget.auth.repository);
    _booking = widget.orderId == null
        ? BookingController(
            repo,
            eventId: widget.event!.id,
            quantities: Map.from(widget.quantities),
            gateway: widget.gateway,
          )
        : BookingController.resume(
            repo,
            widget.orderId!,
            gateway: widget.gateway,
          );
    _booking.addListener(_changed);
    unawaited(
      widget.orderId == null ? _booking.loadQuote() : _booking.restore(),
    );
  }

  void _changed() {
    if (_booking.confirmed && !_celebrated) {
      _celebrated = true;
      unawaited(HapticFeedback.mediumImpact());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _booking.order != null &&
        _booking.pending &&
        !_booking.verifying) {
      unawaited(_booking.refresh());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _booking.removeListener(_changed);
    _booking.dispose();
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  String? _phoneDigits() {
    var value = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (value.length == 12 && value.startsWith('91')) {
      value = value.substring(2);
    }
    if (value.length == 11 && value.startsWith('0')) {
      value = value.substring(1);
    }
    return RegExp(r'^[6-9]\d{9}$').hasMatch(value) ? value : null;
  }

  String _money(int value) =>
      '₹${value % 100 == 0 ? value ~/ 100 : (value / 100).toStringAsFixed(2)}';
  bool get _working => _booking.busy || _booking.verifying || _submitting;
  bool get _canPay {
    final order = _booking.order;
    return order != null &&
        _booking.pending &&
        order.paymentSessionId?.isNotEmpty == true &&
        order.expiresAt.isAfter(DateTime.now());
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _booking,
    builder: (context, _) => PopScope(
      canPop: !_booking.pending || _allowPop,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(_back());
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            tooltip: 'Back to event',
            onPressed: _working ? null : _back,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          title: Text(
            _booking.order == null ? 'Checkout' : 'Your booking',
            style: Theme.of(
              context,
            ).textTheme.headlineLarge?.copyWith(fontSize: 28),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 20),
              child: Icon(
                Icons.lock_outline_rounded,
                size: 19,
                color: Theme.of(context).textTheme.bodySmall?.color,
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          bottom: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child:
                  _booking.loading &&
                      _booking.order == null &&
                      _booking.quote == null
                  ? _loading()
                  : _booking.order != null
                  ? _orderContent(_booking.order!)
                  : _booking.quote != null
                  ? _checkoutContent()
                  : _loadFailure(),
            ),
          ),
        ),
        bottomNavigationBar: _bottomBar(),
      ),
    ),
  );
  Widget _loading() => const Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        SizedBox(height: 18),
        Text('Checking your tickets…'),
      ],
    ),
  );
  Widget _loadFailure() => SingleChildScrollView(
    padding: const EdgeInsets.all(26),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.receipt_long_outlined,
          size: 35,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 20),
        Text(
          'Let’s try that again.',
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.headlineLarge?.copyWith(fontSize: 33),
        ),
        const SizedBox(height: 12),
        Text(
          _booking.error ?? 'Your booking details could not be loaded.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 25),
        SecondaryButton(
          label: 'Try again',
          onPressed: () => widget.orderId == null
              ? _booking.loadQuote()
              : _booking.restore(),
        ),
      ],
    ),
  );
  Widget _checkoutContent() {
    final quote = _booking.quote!;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(24, 9, 24, 28),
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Eyebrow('Your next good plan'),
              const SizedBox(height: 13),
              _eventHeader(
                widget.event!.title,
                widget.event!.dateLabel,
                [
                  widget.event!.venueName,
                  widget.event!.city,
                ].whereType<String>().where((v) => v.isNotEmpty).join(' · '),
                widget.event!.images.isEmpty
                    ? null
                    : widget.event!.images.first.url,
              ),
              const SizedBox(height: 27),
              _summary(
                quote.items,
                quote.subtotalPaise,
                quote.feePaise,
                quote.totalPaise,
              ),
              const SizedBox(height: 29),
              Text(
                'Who’s joining?',
                style: Theme.of(
                  context,
                ).textTheme.headlineLarge?.copyWith(fontSize: 31),
              ),
              const SizedBox(height: 8),
              Text(
                'Your booking will be linked to your Raunak account.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 22),
              if (_booking.error != null)
                FeedbackBanner(message: _booking.error!),
              if (_booking.notice != null)
                FeedbackBanner(message: _booking.notice!, isError: false),
              _label('Full name'),
              TextFormField(
                controller: _name,
                enabled: !_working,
                autofillHints: const [AutofillHints.name],
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                maxLength: 100,
                decoration: const InputDecoration(
                  hintText: 'Your name',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                  counterText: '',
                ),
                validator: (value) => value == null || value.trim().length < 2
                    ? 'Enter your full name.'
                    : null,
              ),
              const SizedBox(height: 18),
              _label('Account email'),
              TextFormField(
                initialValue: widget.auth.user?.email ?? '',
                readOnly: true,
                enableInteractiveSelection: true,
                autofillHints: const [AutofillHints.email],
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.alternate_email_rounded),
                  suffixIcon: Icon(Icons.lock_outline_rounded, size: 17),
                ),
              ),
              const SizedBox(height: 7),
              Text(
                'Tickets belong to this account.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 18),
              _label('Mobile number'),
              TextFormField(
                controller: _phone,
                enabled: !_working,
                keyboardType: TextInputType.phone,
                autofillHints: const [AutofillHints.telephoneNumber],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                maxLength: 16,
                decoration: const InputDecoration(
                  hintText: '98765 43210',
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(left: 16, right: 12),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        'IN +91',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  counterText: '',
                ),
                validator: (_) => _phoneDigits() == null
                    ? 'Enter a valid 10-digit Indian mobile number.'
                    : null,
              ),
              const SizedBox(height: 8),
              Text(
                quote.totalPaise > 0
                    ? 'Used for secure payment and booking communication.'
                    : 'Used for booking communication.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (quote.whatsappAvailable) ...[
                const SizedBox(height: 15),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _whatsapp,
                  onChanged: _working
                      ? null
                      : (value) => setState(() => _whatsapp = value ?? false),
                  title: const Text(
                    'Send my tickets and updates on WhatsApp',
                    style: TextStyle(fontSize: 13, height: 1.4),
                  ),
                  subtitle: Text(
                    'Optional. You can book without WhatsApp.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  activeColor: RaunakColors.coral,
                  checkColor: RaunakColors.ink,
                ),
              ],
              if (quote.totalPaise > 0) ...[
                const SizedBox(height: 22),
                _label('Pay with UPI / Cards'),
                _paymentMethodSelector(),
              ],
              if (widget.event?.refundPolicy?.isNotEmpty == true) ...[
                const SizedBox(height: 16),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text(
                    'Event refund policy',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          widget.event!.refundPolicy!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              Text(
                'By continuing, you agree to Raunak’s Terms and the event’s refund policy.',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 3),
              const LegalLinks(intro: ''),
            ],
          ),
        ),
      ),
    );
  }

  Widget _paymentMethodSelector() {
    final methods = [
      (id: 'upi_gpay', label: 'Google Pay', icon: Icons.account_balance_wallet_outlined),
      (id: 'upi_phonepe', label: 'PhonePe', icon: Icons.bolt_rounded),
      (id: 'upi_paytm', label: 'Paytm', icon: Icons.payment_rounded),
      (id: 'cashfree_pg', label: 'Cards / NetBanking', icon: Icons.credit_card_rounded),
    ];
    return Row(
      children: [
        for (int i = 0; i < methods.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _working
                    ? null
                    : () {
                        unawaited(HapticFeedback.selectionClick());
                        setState(() => _paymentMethod = methods[i].id);
                      },
                borderRadius: BorderRadius.circular(12),
                child: _paymentMethod == methods[i].id
                    ? TintedLiquidGlass(
                        borderRadius: 12,
                        padding: const EdgeInsets.symmetric(
                          vertical: 10,
                          horizontal: 4,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              methods[i].icon,
                              size: 18,
                              color: RaunakColors.coral,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              methods[i].label,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: RaunakColors.coral,
                              ),
                            ),
                          ],
                        ),
                      )
                    : LiquidGlass(
                        borderRadius: 12,
                        padding: const EdgeInsets.symmetric(
                          vertical: 10,
                          horizontal: 4,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              methods[i].icon,
                              size: 18,
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              methods[i].label,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _label(String label) => Padding(
    padding: const EdgeInsets.only(bottom: 9),
    child: Text(
      label,
      style: Theme.of(
        context,
      ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
    ),
  );
  Widget _eventHeader(String title, String date, String venue, String? image) =>
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (image != null) ...[
            SizedBox(
              width: 66,
              height: 84,
              child: CachedArtworkImage(
                imageUrl: image,
                borderRadius: 10,
              ),
            ),
            const SizedBox(width: 14),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontSize: 19, height: 1.3),
                ),
                const SizedBox(height: 7),
                Text(date, style: Theme.of(context).textTheme.bodySmall),
                if (venue.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(venue, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      );
  Widget _summary(
    List<BookingLine> items,
    int subtotal,
    int fee,
    int total,
  ) =>
      LiquidGlass(
        borderRadius: 18,
        blur: 16,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 13),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item.name} × ${item.quantity}',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${_money(item.unitPricePaise)} per ticket',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      _money(item.lineTotalPaise),
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            Divider(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: .2),
            ),
            const SizedBox(height: 13),
            _amountRow('Subtotal', subtotal),
            if (fee != 0) ...[const SizedBox(height: 9), _amountRow('Fees', fee)],
            const SizedBox(height: 14),
            _amountRow('Total', total, strong: true),
          ],
        ),
      );
  Widget _amountRow(String label, int amount, {bool strong = false}) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Text(
          label,
          style: strong
              ? Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 19)
              : Theme.of(context).textTheme.bodyMedium,
        ),
      ),
      const SizedBox(width: 12),
      Text(
        _money(amount),
        style: strong
            ? Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 20)
            : Theme.of(context).textTheme.bodyMedium,
      ),
    ],
  );
  Widget _orderContent(OrderSnapshot order) {
    final confirmed = _booking.confirmed;
    final terminal = _booking.terminal;
    final title = confirmed
        ? 'You’re on the list.'
        : terminal
        ? _terminalTitle(order.status)
        : 'Your booking is pending.';
    final message = confirmed
        ? 'Your booking is confirmed. Open My tickets for your admission passes and booking details.'
        : terminal
        ? _terminalMessage(order.status)
        : _booking.verifying
        ? 'We’re checking your payment with the provider. Your tickets appear after Raunak verifies payment.'
        : 'Your payment hasn’t been confirmed yet. Check its status or continue payment using this booking.';
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 17, 24, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: .88, end: 1),
              duration: Duration(
                milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 360,
              ),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) =>
                  Transform.scale(scale: value, child: child),
              child: confirmed
                  ? TintedLiquidGlass(
                      borderRadius: 20,
                      padding: const EdgeInsets.all(16),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        size: 34,
                        color: RaunakColors.coral,
                      ),
                    )
                  : LiquidGlass(
                      borderRadius: 20,
                      padding: const EdgeInsets.all(16),
                      child: Icon(
                        terminal
                            ? Icons.receipt_long_outlined
                            : Icons.schedule_rounded,
                        size: 34,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 23),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.headlineLarge?.copyWith(fontSize: 37, height: 1.08),
          ),
          const SizedBox(height: 13),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 23),
          if (_booking.error != null) FeedbackBanner(message: _booking.error!),
          if (_booking.notice != null)
            FeedbackBanner(message: _booking.notice!, isError: false),
          _eventHeader(
            order.event.title,
            order.event.dateLabel,
            order.event.venueLabel,
            order.event.imageUrl,
          ),
          const SizedBox(height: 23),
          _summary(
            order.items,
            order.subtotalPaise,
            order.feePaise,
            order.totalPaise,
          ),
          const SizedBox(height: 24),
          _label('Booking reference'),
          LiquidGlass(
            borderRadius: 14,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    order.id,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                  ),
                ),
                IconButton(
                  tooltip: 'Copy booking reference',
                  icon: const Icon(Icons.copy_rounded, size: 17),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: order.id));
                    unawaited(HapticFeedback.selectionClick());
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Booking reference copied to clipboard'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 19),
          _label('Booked for'),
          Text(order.buyerName, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 3),
          Text(order.buyerEmail, style: Theme.of(context).textTheme.bodySmall),
          if (order.buyerPhone?.isNotEmpty == true) ...[
            const SizedBox(height: 3),
            Text(
              order.buyerPhone!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (order.whatsappOptIn) ...[
            const SizedBox(height: 13),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 17,
                  color: Theme.of(context).textTheme.bodySmall?.color,
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    'WhatsApp ticket delivery requested.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ],
          if (_booking.pending) ...[
            const SizedBox(height: 22),
            if (order.expiresAt.isAfter(DateTime.now()))
              Text(
                'Reservation expires at ${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(order.expiresAt.toLocal()))}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            const SizedBox(height: 10),
            SecondaryButton(
              label: _booking.verifying
                  ? 'Checking payment…'
                  : 'Check payment status',
              icon: Icons.refresh_rounded,
              onPressed: _working ? null : () => _booking.refresh(),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => _wallet(order.id),
              child: const Text('Find this booking in My tickets'),
            ),
          ],
          const SizedBox(height: 23),
          const LegalLinks(intro: ''),
        ],
      ),
    );
  }

  String _terminalTitle(String status) => switch (status) {
    'EXPIRED' => 'This reservation expired.',
    'REFUNDED' => 'This booking was refunded.',
    'CANCELLED' => 'This booking was cancelled.',
    'FAILED' => 'Payment wasn’t completed.',
    _ => 'Check your booking status.',
  };
  String _terminalMessage(String status) => switch (status) {
    'EXPIRED' =>
      'The reservation window ended. Return to the event to check current availability.',
    'REFUNDED' =>
      'This booking is marked refunded. View My tickets for its current payment and ticket status.',
    'CANCELLED' =>
      'This booking is marked cancelled. It cannot be used for admission.',
    'FAILED' =>
      'This booking is marked failed. Open My tickets to review its payment status before making another booking.',
    _ => 'View this booking in My tickets for its latest details.',
  };
  Widget _bottomBar() {
    if (_booking.loading && _booking.order == null ||
        _booking.order == null && _booking.quote == null) {
      return const SizedBox.shrink();
    }
    final order = _booking.order;
    String label;
    VoidCallback? action;
    if (_booking.confirmed) {
      label = 'View my tickets';
      action = () => _wallet(order!.id);
    } else if (_booking.terminal) {
      label = 'View booking';
      action = () => _wallet(order!.id);
    } else if (order != null) {
      label = _canPay
          ? 'Continue payment · ${_money(order.totalPaise)}'
          : 'Check booking status';
      action = _working ? null : () => _canPay ? _pay() : _booking.refresh();
    } else {
      final total = _booking.quote!.totalPaise;
      label = total == 0 ? 'Book free tickets' : 'Pay ${_money(total)}';
      action = _working ? null : _submit;
    }
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 13, 24, 10),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(
            top: BorderSide(
              color: Theme.of(
                context,
              ).colorScheme.outline.withValues(alpha: .3),
            ),
          ),
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 632),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PrimaryButton(
                  label: label,
                  onPressed: action,
                  loading: _working,
                  icon: _booking.confirmed
                      ? Icons.confirmation_number_outlined
                      : Icons.arrow_forward_rounded,
                ),
                const SizedBox(height: 5),
                Text(
                  _booking.confirmed
                      ? 'Show each ticket’s QR at the entrance.'
                      : order != null
                      ? 'One booking. Payment is verified by Raunak.'
                      : 'Secure payment. Your total is checked by Raunak.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontSize: 11),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_working ||
        _booking.order != null ||
        !(_form.currentState?.validate() ?? false)) {
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _submitting = true);
    try {
      unawaited(HapticFeedback.selectionClick());
      final reserved = await _booking.reserve(
        name: _name.text.trim(),
        phone: '+91${_phoneDigits()!}',
        whatsappOptIn:
            _whatsapp && (_booking.quote?.whatsappAvailable ?? false),
      );
      if (reserved && !_booking.confirmed && !_booking.terminal && mounted) {
        await _booking.pay();
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pay() async {
    if (_working || !_canPay) return;
    unawaited(HapticFeedback.selectionClick());
    await _booking.pay();
  }

  Future<void> _wallet(String orderId) => Navigator.push(
    context,
    MaterialPageRoute<void>(
      builder: (_) => WalletScreen(auth: widget.auth, orderId: orderId),
    ),
  );
  Future<void> _back() async {
    if (_working) return;
    if (!_booking.pending) {
      Navigator.pop(context);
      return;
    }
    final leave = await showModalBottomSheet<bool>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Your booking is still pending.',
                style: Theme.of(
                  context,
                ).textTheme.headlineLarge?.copyWith(fontSize: 31),
              ),
              const SizedBox(height: 13),
              Text(
                'Leaving this screen won’t confirm or cancel a payment. You can find this booking and check its status in My tickets.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 23),
              PrimaryButton(
                label: 'Keep checkout open',
                onPressed: () => Navigator.pop(sheet, false),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.pop(sheet, true),
                child: const Text('Leave checkout'),
              ),
            ],
          ),
        ),
      ),
    );
    if (leave == true && mounted) {
      setState(() => _allowPop = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context);
      });
    }
  }
}
