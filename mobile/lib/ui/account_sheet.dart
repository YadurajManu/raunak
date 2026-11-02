import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../auth/auth_controller.dart';
import 'components.dart';
import 'liquid_glass.dart';
import 'profile_screen.dart';
import 'theme.dart';
import 'wallet_screen.dart';

/// iOS 26 Liquid Glass Account Bottom Sheet / Popover (Goal 4)
class AccountGlassSheet extends StatelessWidget {
  const AccountGlassSheet({
    super.key,
    required this.auth,
    required this.onTheme,
    this.onOpenTickets,
  });

  final AuthController auth;
  final VoidCallback onTheme;
  final VoidCallback? onOpenTickets;

  static Future<void> show(
    BuildContext context, {
    required AuthController auth,
    required VoidCallback onTheme,
    VoidCallback? onOpenTickets,
  }) {
    unawaited(HapticFeedback.selectionClick());
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AccountGlassSheet(
        auth: auth,
        onTheme: onTheme,
        onOpenTickets: onOpenTickets,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final user = auth.user;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        MediaQuery.paddingOf(context).bottom + 16,
      ),
      child: LiquidGlass(
        borderRadius: 28,
        blur: 32,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Sheet handle
              Center(
                child: Container(
                  width: 38,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: scheme.onSurface.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // User Info header with Glass Avatar
              Row(
                children: [
                  LiquidGlassAvatar(
                    size: 54,
                    name: user?.name,
                    tooltip: 'Profile avatar',
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name?.trim().isNotEmpty == true
                              ? user!.name!
                              : 'Good to have you here.',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontFamily: 'InstrumentSerif',
                            fontSize: 26,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? '',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),

              const SizedBox(height: 20),
              Divider(color: scheme.outline.withValues(alpha: 0.15)),
              const SizedBox(height: 8),

              // Full Profile Navigation
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: scheme.onSurface.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.person_rounded, size: 20),
                ),
                title: const Text(
                  'Full Profile & Settings',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                subtitle: const Text('Name, phone, city, notifications'),
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ProfileScreen(
                        auth: auth,
                        onThemeChanged: onTheme,
                      ),
                    ),
                  );
                },
              ),

              // My Tickets
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: RaunakColors.coral.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.confirmation_number_outlined,
                    size: 20,
                    color: RaunakColors.coral,
                  ),
                ),
                title: const Text(
                  'My tickets',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                subtitle: const Text('Upcoming admission & QR passes'),
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () {
                  Navigator.pop(context);
                  if (onOpenTickets != null) {
                    onOpenTickets!();
                  } else {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => WalletScreen(auth: auth),
                      ),
                    );
                  }
                },
              ),

              // Saved Events
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: scheme.onSurface.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.bookmark_border_rounded, size: 20),
                ),
                title: const Text(
                  'Saved events',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                subtitle: const Text('Plans you’ve bookmarked'),
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Saved events will appear here.'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),

              // Theme Switcher (moved here from cramped top bar!)
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: scheme.onSurface.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                    size: 20,
                    color: RaunakColors.coral,
                  ),
                ),
                title: const Text(
                  'Appearance',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                subtitle: Text(dark ? 'Dark charcoal' : 'Warm cream'),
                trailing: LiquidGlassChip(
                  label: dark ? 'Light' : 'Dark',
                  selected: false,
                  icon: dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                  showClear: false,
                  onTap: () {
                    unawaited(HapticFeedback.selectionClick());
                    onTheme();
                  },
                ),
              ),

              // Help & Support
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: scheme.onSurface.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.help_outline_rounded, size: 20),
                ),
                title: const Text(
                  'Help & support',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                trailing: const Icon(Icons.arrow_forward_rounded, size: 18),
                onTap: () {
                  Navigator.pop(context);
                  openPublicPage(context, '/help');
                },
              ),

              Divider(color: scheme.outline.withValues(alpha: 0.15)),
              const SizedBox(height: 4),

              // Sign out (matches test requirement: find.text('Sign out'))
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.logout_rounded, color: Colors.red, size: 20),
                ),
                title: const Text(
                  'Sign out',
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                onTap: auth.busy
                    ? null
                    : () async {
                        Navigator.pop(context);
                        await auth.signOut();
                      },
              ),

              const SizedBox(height: 10),
              const LegalLinks(intro: ''),
            ],
          ),
        ),
      ),
    );
  }
}
