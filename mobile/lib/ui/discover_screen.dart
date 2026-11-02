import 'dart:async';
import 'package:flutter/material.dart';
import '../auth/auth_controller.dart';
import '../booking/wallet_controller.dart';
import '../discovery/discovery_controller.dart';
import 'account_sheet.dart';
import 'artwork_cache.dart';
import 'components.dart';
import 'event_details_screen.dart';
import 'liquid_glass.dart';
import 'profile_screen.dart';
import 'theme.dart';
import 'wallet_screen.dart';

/// Redesigned Discover Screen with iOS 26 Liquid Glass navigation and header.
///
/// Features:
/// 1. Uncluttered, native top bar with spacious breathing room.
/// 2. Floating Liquid Glass bottom tab bar (Home, Explore, Tickets with live badge, Profile).
/// 3. Collapsing Liquid Glass header that emerges smoothly on scroll.
/// 4. Circular Liquid Glass avatar opening the Account glass sheet / popover.
/// 5. Sculpted glass search bar & tinted coral glass filter chips.
/// 6. Photo caching, state preservation across tabs, skeleton loaders, and offline retry states.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({
    super.key,
    required this.auth,
    required this.onTheme,
    this.repository,
  });

  final AuthController auth;
  final VoidCallback onTheme;
  final DiscoveryRepository? repository;

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  int _currentTab = 0;
  late final DiscoveryController _discovery;
  late final WalletController _wallet;
  final _search = TextEditingController();
  final _scrollController = ScrollController();
  bool _showCompactHeader = false;
  int _upcomingTicketCount = 0;

  @override
  void initState() {
    super.initState();
    _discovery = DiscoveryController(
      widget.repository ??
          DiscoveryRepository(apiBase: widget.auth.repository.apiBase),
    );
    _wallet = WalletController(
      BookingsRepository(widget.auth.repository),
    );
    _wallet.addListener(_onWalletUpdated);
    _scrollController.addListener(_onScroll);

    unawaited(_discovery.load());
    unawaited(_wallet.load());
  }

  void _onWalletUpdated() {
    if (!mounted) return;
    setState(() {
      final activeCount = _wallet.tickets.where((t) => t.active).length;
      _upcomingTicketCount = activeCount > 0 ? activeCount : _wallet.total;
    });
  }

  void _onScroll() {
    final shouldShow = _scrollController.hasClients && _scrollController.offset > 80;
    if (shouldShow != _showCompactHeader) {
      setState(() => _showCompactHeader = shouldShow);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _search.dispose();
    _wallet.removeListener(_onWalletUpdated);
    _wallet.dispose();
    _discovery.dispose();
    super.dispose();
  }

  void _clear() {
    _search.clear();
    _discovery.clearFilters();
    FocusScope.of(context).unfocus();
  }

  Future<void> _account(BuildContext context) {
    return AccountGlassSheet.show(
      context,
      auth: widget.auth,
      onTheme: widget.onTheme,
      onOpenTickets: () => setState(() => _currentTab = 2),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: Stack(
        children: [
          // Screen views with preserved state
          IndexedStack(
            index: _currentTab,
            children: [
              _buildHomeFeed(context),
              _ExploreView(
                controller: _discovery,
                onSelectCategory: (cat) {
                  _discovery.setCategory(cat);
                  setState(() => _currentTab = 0);
                },
                onSelectCity: (c) {
                  _discovery.setCity(c);
                  setState(() => _currentTab = 0);
                },
              ),
              WalletScreen(auth: widget.auth),
              ProfileScreen(
                auth: widget.auth,
                onThemeChanged: widget.onTheme,
              ),
            ],
          ),

          // Collapsing Liquid Glass Top Header (Home Tab only when scrolled)
          if (_currentTab == 0 && _showCompactHeader)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildCompactHeader(context),
            ),

          // Floating Liquid Glass Bottom Navigation Bar (Goal 2)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: LiquidGlassBottomBar(
              currentIndex: _currentTab,
              onTap: (index) {
                if (index == _currentTab && index == 0 && _scrollController.hasClients) {
                  _scrollController.animateTo(
                    0,
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                  );
                }
                setState(() => _currentTab = index);
              },
              items: [
                const LiquidBarItem(
                  icon: Icons.explore_outlined,
                  selectedIcon: Icons.explore_rounded,
                  label: 'Home',
                ),
                const LiquidBarItem(
                  icon: Icons.grid_view_outlined,
                  selectedIcon: Icons.grid_view_rounded,
                  label: 'Explore',
                ),
                LiquidBarItem(
                  icon: Icons.confirmation_number_outlined,
                  selectedIcon: Icons.confirmation_number_rounded,
                  label: 'Tickets',
                  badgeCount: _upcomingTicketCount,
                ),
                const LiquidBarItem(
                  icon: Icons.person_outline_rounded,
                  selectedIcon: Icons.person_rounded,
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Compact Collapsing Glass Header docked at the top on scroll (Goal 3)
  Widget _buildCompactHeader(BuildContext context) {
    final topPadding = MediaQuery.paddingOf(context).top;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, topPadding + 6, 16, 0),
      child: LiquidGlass(
        borderRadius: 24,
        blur: 28,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          children: [
            const BrandLockup(size: 26, showName: true),
            const Spacer(),

            // City quick-filter chip
            InkWell(
              onTap: () => _city(context),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.06),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.location_on_outlined, size: 14, color: RaunakColors.coral),
                    const SizedBox(width: 4),
                    Text(
                      _discovery.city.isEmpty ? 'All cities' : _discovery.city,
                      style: const TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Scroll to search trigger
            IconButton(
              icon: const Icon(Icons.search_rounded, size: 20),
              tooltip: 'Search events',
              visualDensity: VisualDensity.compact,
              onPressed: () {
                _scrollController.animateTo(
                  0,
                  duration: const Duration(milliseconds: 350),
                  curve: Curves.easeOutCubic,
                );
              },
            ),
            const SizedBox(width: 4),

            // Circular Glass Profile Avatar
            LiquidGlassAvatar(
              size: 34,
              name: widget.auth.user?.name,
              onTap: () => _account(context),
              tooltip: 'Your account',
            ),
          ],
        ),
      ),
    );
  }

  /// Main Home Feed (Discover Screen)
  Widget _buildHomeFeed(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: _discovery,
        builder: (context, _) => RefreshIndicator(
          onRefresh: () async {
            await Future.wait([
              _discovery.load(),
              _wallet.load(),
            ]);
          },
          color: Theme.of(context).colorScheme.primary,
          child: CustomScrollView(
            controller: _scrollController,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _bounded(
                  context,
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Spacious, uncluttered top bar (Goal 1 & 4)
                        _unclutteredTopBar(context),
                        const SizedBox(height: 24),

                        // Hero Eyebrow & Headline
                        const Eyebrow('Good people. Great plans.'),
                        const SizedBox(height: 10),
                        Text.rich(
                          TextSpan(
                            children: [
                              const TextSpan(text: 'Find your next '),
                              TextSpan(
                                text: 'raunak.',
                                style: TextStyle(
                                  fontStyle: FontStyle.italic,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                            ],
                          ),
                          style: Theme.of(context).textTheme.displayMedium?.copyWith(
                            fontSize: 43,
                            height: 1.03,
                          ),
                        ),
                        const SizedBox(height: 22),

                        // Liquid Glass Search bar (Goal 5)
                        _searchField(context),
                        const SizedBox(height: 14),

                        // Liquid Glass Date chips
                        _dateFilters(context),

                        // Liquid Glass Category chips
                        if (_discovery.categories.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _categories(context),
                        ],
                        const SizedBox(height: 22),

                        // Offline cached notice with retry action (Priority 6)
                        if (_discovery.error != null && _discovery.events.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: LiquidGlass(
                              borderRadius: 14,
                              blur: 18,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.cloud_off_rounded,
                                    size: 18,
                                    color: RaunakColors.coral,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'Showing cached plans · Tap to reconnect',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => _discovery.load(),
                                    child: const Text('Retry'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],

                        // Feed Section Header
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _discovery.city.isEmpty
                                    ? 'Upcoming events'
                                    : 'In ${_discovery.city}',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            if (_discovery.hasFilters)
                              TextButton(
                                onPressed: _clear,
                                child: const Text('Clear filters'),
                              ),
                          ],
                        ),
                        if (!_discovery.loading && _discovery.events.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '${_discovery.total} ${_discovery.total == 1 ? 'event' : 'events'} · ${_sortLabel(_discovery.sort)}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
              ),

              // Loading Skeleton with zero layout shift (Priority 3)
              if (_discovery.loading && _discovery.events.isEmpty)
                SliverToBoxAdapter(
                  child: _bounded(context, const _GlassSkeletonLoading()),
                )
              // Empty error state if no cached events exist
              else if (_discovery.events.isEmpty && _discovery.error != null)
                SliverToBoxAdapter(
                  child: _bounded(
                    context,
                    _state(
                      context,
                      icon: Icons.wifi_off_rounded,
                      title: 'A little interruption.',
                      message: _discovery.error!,
                      action: 'Try again',
                      onPressed: () => _discovery.load(),
                    ),
                  ),
                )
              // Empty search / filter results state
              else if (_discovery.events.isEmpty)
                SliverToBoxAdapter(
                  child: _bounded(
                    context,
                    _state(
                      context,
                      icon: _discovery.hasFilters
                          ? Icons.search_off_rounded
                          : Icons.auto_awesome_outlined,
                      title: _discovery.hasFilters
                          ? 'No plans match just yet.'
                          : 'Good plans are on their way.',
                      message: _discovery.hasFilters
                          ? 'Try another city or date, or clear your filters to explore everything.'
                          : 'Published events will appear here. Come back soon for something worth stepping out for.',
                      action: _discovery.hasFilters
                          ? 'Clear filters'
                          : 'Refresh events',
                      onPressed: _discovery.hasFilters
                          ? _clear
                          : () => _discovery.load(),
                    ),
                  ),
                )
              // Event Cards List
              else ...[
                SliverToBoxAdapter(
                  child: _bounded(
                    context,
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 22),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final columns = constraints.maxWidth >= 700 ? 2 : 1;
                          if (columns == 1) {
                            return Column(
                              children: [
                                for (final event in _discovery.events)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 24),
                                    child: _EventCard(
                                      event: event,
                                      auth: widget.auth,
                                    ),
                                  ),
                              ],
                            );
                          }
                          final width = (constraints.maxWidth - 24) / 2;
                          return Wrap(
                            spacing: 24,
                            runSpacing: 24,
                            children: [
                              for (final event in _discovery.events)
                                SizedBox(
                                  width: width,
                                  child: _EventCard(
                                    event: event,
                                    auth: widget.auth,
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
                if (_discovery.error != null && _discovery.events.isEmpty)
                  SliverToBoxAdapter(
                    child: _bounded(
                      context,
                      Padding(
                        padding: const EdgeInsets.fromLTRB(22, 0, 22, 12),
                        child: FeedbackBanner(message: _discovery.error!),
                      ),
                    ),
                  ),
                if (_discovery.hasMore || (_discovery.error != null && _discovery.events.isEmpty))
                  SliverToBoxAdapter(
                    child: _bounded(
                      context,
                      Padding(
                        padding: const EdgeInsets.fromLTRB(22, 0, 22, 16),
                        child: SecondaryButton(
                          label: _discovery.loadingMore
                              ? 'Loading more…'
                              : 'Load more events',
                          onPressed: _discovery.loadingMore
                              ? null
                              : () => _discovery.load(append: true),
                          icon: Icons.expand_more_rounded,
                        ),
                      ),
                    ),
                  ),
              ],

              // Padding to allow scrolling well above the floating bottom bar
              SliverToBoxAdapter(
                child: SizedBox(
                  height: MediaQuery.paddingOf(context).bottom + 104,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bounded(BuildContext context, Widget child) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 1020),
      child: child,
    ),
  );

  /// Uncluttered, premium, native top bar (Goal 1 & 4)
  Widget _unclutteredTopBar(BuildContext context) => Row(
    children: [
      const Expanded(
        child: Align(
          alignment: Alignment.centerLeft,
          child: BrandLockup(size: 32),
        ),
      ),
      // Circular Liquid Glass Avatar (Goal 4 & matches find.byTooltip('Your account'))
      LiquidGlassAvatar(
        size: 42,
        name: widget.auth.user?.name,
        onTap: () => _account(context),
        tooltip: 'Your account',
      ),
    ],
  );

  /// Sculpted Liquid Glass Search Bar (Goal 5)
  Widget _searchField(BuildContext context) => Column(
    children: [
      LiquidGlass(
        borderRadius: 16,
        blur: 20,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, size: 21),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _search,
                onChanged: _discovery.setQuery,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) {
                  FocusScope.of(context).unfocus();
                  unawaited(_discovery.load());
                },
                decoration: const InputDecoration(
                  hintText: 'Events, venues or organizers',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                  contentPadding: EdgeInsets.symmetric(vertical: 14),
                ),
                maxLength: 100,
                buildCounter:
                    (_, {required currentLength, required isFocused, maxLength}) =>
                        null,
              ),
            ),
            if (_search.text.isNotEmpty)
              IconButton(
                tooltip: 'Clear search',
                icon: const Icon(Icons.close_rounded, size: 19),
                onPressed: () {
                  _search.clear();
                  _discovery.setQuery('');
                },
              ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: LiquidGlass(
              borderRadius: 12,
              blur: 16,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              child: InkWell(
                onTap: () => _city(context),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 17,
                        color: RaunakColors.coral,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _discovery.city.isEmpty ? 'All cities' : _discovery.city,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Geist',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.arrow_drop_down_rounded, size: 20),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          LiquidGlass(
            borderRadius: 12,
            blur: 16,
            child: IconButton(
              onPressed: () => _filters(context),
              tooltip: 'Price and sorting filters',
              icon: Badge(
                isLabelVisible:
                    _discovery.price.isNotEmpty || _discovery.sort != 'soonest',
                smallSize: 6,
                backgroundColor: RaunakColors.coral,
                child: const Icon(Icons.tune_rounded, size: 20),
              ),
            ),
          ),
        ],
      ),
    ],
  );

  /// Liquid Glass Date Filter Chips (Goal 5)
  Widget _dateFilters(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        LiquidGlassChip(
          label: 'Any time',
          selected: _discovery.period.isEmpty,
          onTap: () => _discovery.setPeriod(''),
        ),
        LiquidGlassChip(
          label: 'Today',
          selected: _discovery.period == 'today',
          onTap: () => _discovery.setPeriod(
            _discovery.period == 'today' ? '' : 'today',
          ),
        ),
        LiquidGlassChip(
          label: 'Tomorrow',
          selected: _discovery.period == 'tomorrow',
          onTap: () => _discovery.setPeriod(
            _discovery.period == 'tomorrow' ? '' : 'tomorrow',
          ),
        ),
        LiquidGlassChip(
          label: 'This weekend',
          selected: _discovery.period == 'weekend',
          onTap: () => _discovery.setPeriod(
            _discovery.period == 'weekend' ? '' : 'weekend',
          ),
        ),
      ],
    ),
  );

  /// Liquid Glass Category Filter Chips (Goal 5)
  Widget _categories(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        LiquidGlassChip(
          label: 'All categories',
          selected: _discovery.category.isEmpty,
          onTap: () => _discovery.setCategory(''),
        ),
        for (final category in _discovery.categories)
          LiquidGlassChip(
            label: category,
            selected: _discovery.category == category,
            onTap: () => _discovery.setCategory(
              _discovery.category == category ? '' : category,
            ),
          ),
      ],
    ),
  );

  Widget _state(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String message,
    required String action,
    required VoidCallback onPressed,
  }) => Padding(
    padding: const EdgeInsets.fromLTRB(22, 4, 22, 28),
    child: LiquidGlass(
      borderRadius: 20,
      blur: 24,
      padding: const EdgeInsets.all(26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary, size: 28),
          const SizedBox(height: 18),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.headlineLarge?.copyWith(fontSize: 31),
          ),
          const SizedBox(height: 12),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 22),
          SecondaryButton(
            label: action,
            onPressed: onPressed,
            icon: Icons.arrow_forward_rounded,
          ),
        ],
      ),
    ),
  );

  Future<void> _city(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _CitySheet(controller: _discovery),
  );

  Future<void> _filters(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => ListenableBuilder(
      listenable: _discovery,
      builder: (context, _) => SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          4,
          24,
          MediaQuery.paddingOf(context).bottom + 24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Make it your kind of plan.',
              style: Theme.of(
                context,
              ).textTheme.headlineLarge?.copyWith(fontSize: 32),
            ),
            const SizedBox(height: 24),
            const Eyebrow('Ticket price'),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                LiquidGlassChip(
                  label: 'All prices',
                  selected: _discovery.price.isEmpty,
                  onTap: () => _discovery.setPrice(''),
                ),
                LiquidGlassChip(
                  label: 'Free',
                  selected: _discovery.price == 'free',
                  onTap: () => _discovery.setPrice(
                    _discovery.price == 'free' ? '' : 'free',
                  ),
                ),
                LiquidGlassChip(
                  label: 'Paid',
                  selected: _discovery.price == 'paid',
                  onTap: () => _discovery.setPrice(
                    _discovery.price == 'paid' ? '' : 'paid',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            const Eyebrow('Show first'),
            const SizedBox(height: 8),
            for (final option in [
              ('soonest', 'Soonest'),
              ('newest', 'Recently added'),
              ('price', 'Lowest price'),
              ('price-desc', 'Highest price'),
            ])
              ListTile(
                contentPadding: EdgeInsets.zero,
                minVerticalPadding: 8,
                title: Text(option.$2),
                leading: Icon(
                  _discovery.sort == option.$1
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: _discovery.sort == option.$1
                      ? Theme.of(context).colorScheme.primary
                      : null,
                ),
                onTap: () => _discovery.setSort(option.$1),
              ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Show events',
              onPressed: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    ),
  );

  String _sortLabel(String sort) => switch (sort) {
    'newest' => 'Recently added',
    'price' => 'Lowest price',
    'price-desc' => 'Highest price',
    _ => 'Soonest first',
  };
}

/// Explore Tab View
class _ExploreView extends StatelessWidget {
  const _ExploreView({
    required this.controller,
    required this.onSelectCategory,
    required this.onSelectCity,
  });

  final DiscoveryController controller;
  final ValueChanged<String> onSelectCategory;
  final ValueChanged<String> onSelectCity;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          22,
          16,
          22,
          MediaQuery.paddingOf(context).bottom + 100,
        ),
        children: [
          const Eyebrow('Curated Discovery'),
          const SizedBox(height: 8),
          Text(
            'Explore\nby scene & city.',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 22),

          const Eyebrow('Popular Hubs'),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final city in [
                  'Delhi',
                  'Mumbai',
                  'Bengaluru',
                  'Goa',
                  'Pune',
                  'Jaipur',
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: InkWell(
                      onTap: () => onSelectCity(city),
                      borderRadius: BorderRadius.circular(16),
                      child: LiquidGlass(
                        borderRadius: 16,
                        blur: 20,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.location_on_outlined,
                              size: 16,
                              color: RaunakColors.coral,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              city,
                              style: const TextStyle(
                                fontFamily: 'Geist',
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 28),
          const Eyebrow('Experience Categories'),
          const SizedBox(height: 14),

          for (final scene in [
            (
              'Music & Nightlife',
              'Indie showcases, Sufi evenings, techno clubs',
              Icons.music_note_rounded,
            ),
            (
              'Arts & Culture',
              'Exhibitions, live poetry, intimate theatre',
              Icons.palette_outlined,
            ),
            (
              'Food & Heritage',
              'Culinary popups, secret dinners, walking tours',
              Icons.restaurant_rounded,
            ),
            (
              'Community & Talks',
              'Founder salons, book club gatherings',
              Icons.forum_outlined,
            ),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: InkWell(
                onTap: () => onSelectCategory(scene.$1),
                borderRadius: BorderRadius.circular(18),
                child: LiquidGlass(
                  borderRadius: 18,
                  blur: 20,
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: RaunakColors.coral.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(scene.$3, color: RaunakColors.coral, size: 24),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              scene.$1,
                              style: const TextStyle(
                                fontFamily: 'Geist',
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              scene.$2,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CitySheet extends StatefulWidget {
  const _CitySheet({required this.controller});
  final DiscoveryController controller;
  @override
  State<_CitySheet> createState() => _CitySheetState();
}

class _CitySheetState extends State<_CitySheet> {
  final _query = TextEditingController();
  Timer? _timer;
  List<CityOption> _options = [];
  bool _loading = false;
  String? _error;
  int _version = 0;
  @override
  void dispose() {
    _timer?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _search(String query) {
    _timer?.cancel();
    final version = ++_version;
    setState(() {
      _loading = query.trim().length >= 2;
      _error = null;
      _options = [];
    });
    if (query.trim().length < 2) return;
    _timer = Timer(const Duration(milliseconds: 300), () async {
      try {
        final options = await widget.controller.cities(query);
        if (mounted && version == _version) {
          setState(() {
            _options = options;
            _loading = false;
          });
        }
      } catch (_) {
        if (mounted && version == _version) {
          setState(() {
            _error =
                'City suggestions are unavailable. You can still enter a city.';
            _loading = false;
          });
        }
      }
    });
  }

  void _select(String city) {
    widget.controller.setCity(city);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final available =
        MediaQuery.sizeOf(context).height -
        keyboard -
        MediaQuery.paddingOf(context).top -
        32;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        4,
        24,
        keyboard + MediaQuery.paddingOf(context).bottom + 16,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: available.clamp(140, 600).toDouble(),
        ),
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Where’s your next plan?',
                style: Theme.of(
                  context,
                ).textTheme.headlineLarge?.copyWith(fontSize: 31),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: _query,
                autofocus: true,
                onChanged: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty) {
                    _select(value.trim());
                  }
                },
                maxLength: 100,
                decoration: const InputDecoration(
                  hintText: 'Search a city',
                  prefixIcon: Icon(Icons.search_rounded),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 9),
              ListTile(
                contentPadding: EdgeInsets.zero,
                minVerticalPadding: 12,
                leading: const Icon(Icons.public_rounded),
                title: const Text('All cities'),
                trailing: widget.controller.city.isEmpty
                    ? Icon(
                        Icons.check_rounded,
                        color: Theme.of(context).colorScheme.primary,
                      )
                    : null,
                onTap: () => _select(''),
              ),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              if (!_loading &&
                  _query.text.trim().length >= 2 &&
                  _options.isEmpty)
                TextButton(
                  onPressed: () => _select(_query.text.trim()),
                  child: Text('Search in ${_query.text.trim()}'),
                ),
              for (final city in _options)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  minVerticalPadding: 10,
                  leading: const Icon(Icons.location_on_outlined, size: 22),
                  title: Text(city.city),
                  subtitle: city.region.isEmpty ? null : Text(city.region),
                  trailing: const Icon(Icons.arrow_forward_rounded, size: 17),
                  onTap: () => _select(city.city),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Event card with Photo Caching (Priority 1) & iOS 26 Glass feel
class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.auth});
  final AuthController auth;
  final DiscoverEvent event;

  String get _price {
    final price = event.pricePaise;
    if (price == null) return 'See tickets';
    if (price == 0) return 'Free';
    return 'From ₹${price % 100 == 0 ? price ~/ 100 : (price / 100).toStringAsFixed(2)}';
  }

  Future<void> _open(BuildContext context) async {
    await Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => EventDetailsScreen(slug: event.slug, auth: auth),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Semantics(
      button: true,
      label:
          '${event.title}. ${event.dateLabel}. ${event.venueLabel}. $_price. View event.',
      onTap: () => _open(context),
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _open(context),
          borderRadius: BorderRadius.circular(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Photo with cached image provider (Priority 1)
              CachedArtworkImage(
                imageUrl: event.imageUrl,
                aspectRatio: 1,
                borderRadius: 18,
                fit: BoxFit.contain,
                semanticLabel: event.title,
              ),
              const SizedBox(height: 15),
              if (event.category?.isNotEmpty == true)
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Text(
                    event.category!.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 1.3,
                      fontWeight: FontWeight.w600,
                      color: scheme.primary,
                    ),
                  ),
                ),
              Text(
                event.title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontSize: 22, height: 1.2),
              ),
              const SizedBox(height: 12),
              _meta(context, Icons.calendar_today_outlined, event.dateLabel),
              const SizedBox(height: 7),
              _meta(
                context,
                event.mode == 'ONLINE'
                    ? Icons.videocam_outlined
                    : Icons.location_on_outlined,
                event.venueLabel,
              ),
              const SizedBox(height: 15),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _price,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    'View event',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: scheme.primary,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 17,
                    color: scheme.primary,
                  ),
                ],
              ),
              const SizedBox(height: 13),
              Divider(color: scheme.outline.withValues(alpha: .3)),
              const SizedBox(height: 10),
              Text(
                'Hosted by ${event.organizerName}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(BuildContext context, IconData icon, String text) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Icon(
          icon,
          size: 15,
          color: Theme.of(context).textTheme.bodySmall?.color,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 13),
        ),
      ),
    ],
  );
}

/// Shimmer Skeleton Loader with zero layout shift (Priority 3)
class _GlassSkeletonLoading extends StatelessWidget {
  const _GlassSkeletonLoading();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading events',
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 8, 22, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (int i = 0; i < 2; i++) ...[
              if (i > 0) const SizedBox(height: 28),
              // Square Poster
              const AspectRatio(
                aspectRatio: 1,
                child: LiquidGlassSkeleton(
                  width: double.infinity,
                  height: double.infinity,
                  borderRadius: 18,
                ),
              ),
              const SizedBox(height: 14),
              // Category tag placeholder
              const LiquidGlassSkeleton(width: 80, height: 12, borderRadius: 6),
              const SizedBox(height: 8),
              // Title lines
              const LiquidGlassSkeleton(width: double.infinity, height: 20, borderRadius: 6),
              const SizedBox(height: 6),
              const LiquidGlassSkeleton(width: 180, height: 20, borderRadius: 6),
              const SizedBox(height: 12),
              // Meta line
              const LiquidGlassSkeleton(width: 220, height: 14, borderRadius: 6),
              const SizedBox(height: 14),
              // Price placeholder
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  LiquidGlassSkeleton(width: 90, height: 18, borderRadius: 6),
                  LiquidGlassSkeleton(width: 80, height: 18, borderRadius: 6),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
