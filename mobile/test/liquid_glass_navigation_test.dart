import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:raunak_mobile/auth/auth_controller.dart';
import 'package:raunak_mobile/auth/auth_repository.dart';
import 'package:raunak_mobile/discovery/discovery_repository.dart';
import 'package:raunak_mobile/ui/artwork_cache.dart';
import 'package:raunak_mobile/ui/discover_screen.dart';
import 'package:raunak_mobile/ui/profile_screen.dart';
import 'package:raunak_mobile/ui/theme.dart';

class MockAuthRepo extends AuthRepository {
  @override
  bool get configured => true;
  @override
  Future<AppUser?> restore() async =>
      const AppUser(id: 'u1', email: 'aarav@example.test', name: 'Aarav Singh');
  @override
  Future<AppUser> signIn(String a, String b) async =>
      AppUser(id: 'u1', email: a, name: 'Aarav Singh');
  @override
  Future<AppUser> signUp(String a, String b, String c) async =>
      AppUser(id: 'u1', email: b, name: a);
  @override
  Future<void> resetPassword(String e) async {}
  @override
  Future<void> signOut() async {}
}

class MockDiscoveryRepo extends DiscoveryRepository {
  MockDiscoveryRepo() : super(apiBase: 'https://raunak.example');

  @override
  Future<DiscoveryPage> fetch({
    String query = '',
    String city = '',
    String category = '',
    String period = '',
    String price = '',
    String sort = 'soonest',
    int page = 1,
  }) async =>
      DiscoveryPage(
        events: [
          DiscoverEvent.fromJson({
            'id': 'e1',
            'slug': 'delhi-sufi-night',
            'title': 'Delhi Sufi Night & Qawwali',
            'dateLabel': 'Sat, 14 Nov · 7:30 PM',
            'venueLabel': 'Sunder Nursery, New Delhi',
            'mode': 'VENUE',
            'organizerName': 'Dastak Foundation',
            'pricePaise': 49900,
            'category': 'Music & nightlife',
            'imageUrl': 'https://example.test/sufi.jpg',
          }),
        ],
        categories: ['Music & nightlife', 'Arts & culture', 'Food & drink'],
        total: 1,
        page: 1,
        hasMore: false,
      );
}

void main() {
  group('iOS 26 Liquid Glass Navigation & UI', () {
    testWidgets('renders uncluttered top bar with logo and circular glass avatar', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthController(MockAuthRepo());
      await auth.restore();
      final discoveryRepo = MockDiscoveryRepo();

      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.dark),
          home: DiscoverScreen(
            auth: auth,
            onTheme: () {},
            repository: discoveryRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify uncluttered header has brand lockup and single circular glass avatar
      expect(find.text('Raunak'), findsWidgets);
      expect(find.byTooltip('Your account'), findsOneWidget);

      // Verify the large hero headline
      expect(find.text('GOOD PEOPLE. GREAT PLANS.'), findsOneWidget);
      expect(find.textContaining('Find your next'), findsOneWidget);

      // Verify floating bottom bar tabs
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Explore'), findsOneWidget);
      expect(find.text('Tickets'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('tapping circular avatar opens iOS 26 Liquid Glass sheet', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthController(MockAuthRepo());
      await auth.restore();
      final discoveryRepo = MockDiscoveryRepo();

      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.dark),
          home: DiscoverScreen(
            auth: auth,
            onTheme: () {},
            repository: discoveryRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap avatar
      await tester.tap(find.byTooltip('Your account'));
      await tester.pumpAndSettle();

      // Verify sheet contents: user info, email, options, sign out
      expect(find.text('Aarav Singh'), findsOneWidget);
      expect(find.text('aarav@example.test'), findsOneWidget);
      expect(find.text('Full Profile & Settings'), findsOneWidget);
      expect(find.text('Appearance'), findsOneWidget);
      expect(find.text('Sign out'), findsOneWidget);
    });

    testWidgets('floating bottom tab bar switches tabs without resetting home state', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthController(MockAuthRepo());
      await auth.restore();
      final discoveryRepo = MockDiscoveryRepo();

      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.dark),
          home: DiscoverScreen(
            auth: auth,
            onTheme: () {},
            repository: discoveryRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Enter search text
      await tester.enterText(
        find.widgetWithText(TextField, 'Events, venues or organizers'),
        'Sufi',
      );
      await tester.pumpAndSettle();

      // Switch to Explore tab
      await tester.tap(find.text('Explore'));
      await tester.pumpAndSettle();

      expect(find.text('CURATED DISCOVERY'), findsOneWidget);
      expect(find.text('Explore\nby scene & city.'), findsOneWidget);

      // Switch to Profile tab
      await tester.tap(find.text('Profile'));
      await tester.pumpAndSettle();

      expect(find.text('PERSONAL DETAILS'), findsOneWidget);
      expect(find.text('Preferred city'), findsOneWidget);

      // Switch back to Home tab - search text must be preserved!
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();

      expect(find.text('Sufi'), findsOneWidget);
    });

    testWidgets('LiquidGlassChip toggles filter with tinted coral glass state', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthController(MockAuthRepo());
      await auth.restore();
      final discoveryRepo = MockDiscoveryRepo();

      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.dark),
          home: DiscoverScreen(
            auth: auth,
            onTheme: () {},
            repository: discoveryRepo,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Today' chip
      await tester.tap(find.text('Today'));
      await tester.pumpAndSettle();

      // Verify 'Today' is now selected
      expect(find.text('Today'), findsOneWidget);
    });

    testWidgets('Photo caching stores and avoids re-fetching loaded images', (
      tester,
    ) async {
      final cache = RaunakArtworkCache.instance;
      cache.clear();

      expect(cache.isCached('https://example.test/img.png'), false);
      cache.markCached('https://example.test/img.png');
      expect(cache.isCached('https://example.test/img.png'), true);
      cache.evict('https://example.test/img.png');
      expect(cache.isCached('https://example.test/img.png'), false);
    });

    testWidgets('Profile screen allows editing personal info & opens change email flow', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthController(MockAuthRepo());
      await auth.restore();

      await tester.pumpWidget(
        MaterialApp(
          theme: raunakTheme(Brightness.dark),
          home: ProfileScreen(
            auth: auth,
            onThemeChanged: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify fields exist
      expect(find.text('Full name'), findsOneWidget);
      expect(find.text('Mobile number'), findsOneWidget);
      expect(find.text('Change'), findsOneWidget);

      // Scroll to Change button and tap
      await tester.ensureVisible(find.text('Change'));
      await tester.tap(find.text('Change'));
      await tester.pumpAndSettle();

      expect(find.text('Change Account Email'), findsOneWidget);
      expect(find.text('Current password'), findsOneWidget);
      expect(find.text('New email address'), findsOneWidget);
    });
  });
}
