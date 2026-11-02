import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../auth/auth_controller.dart';
import 'components.dart';
import 'liquid_glass.dart';
import 'theme.dart';
import 'wallet_screen.dart';

/// Full Profile Screen (Priority 4 & 5)
///
/// Features:
/// - iOS 26 Liquid Glass aesthetics
/// - Profile photo / initials with change photo trigger
/// - Editable Name, Phone (+91 validation), Preferred City
/// - Read-only Email with secure Change Email flow (Priority 5)
/// - Notification preferences (WhatsApp, reminders, recommendations)
/// - Appearance & Theme toggle (moved here from cramped header)
/// - Support and legal links
/// - Sign out with clear confirmation
/// - Tactile save feedback with animated banner & haptics
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.auth,
    required this.onThemeChanged,
  });

  final AuthController auth;
  final VoidCallback onThemeChanged;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  String _selectedCity = 'Delhi';
  bool _whatsappTickets = true;
  bool _eventReminders = true;
  bool _curatedPicks = true;
  bool _saving = false;
  String? _successBanner;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.auth.user?.name ?? '',
    );
    _phoneController = TextEditingController(text: '9876543210');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _save() {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    unawaited(HapticFeedback.mediumImpact());
    setState(() => _saving = true);

    Future.delayed(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _successBanner = 'Profile preferences updated successfully.';
      });
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) setState(() => _successBanner = null);
      });
    });
  }

  void _openChangeEmail() {
    unawaited(HapticFeedback.selectionClick());
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ChangeEmailSheet(auth: widget.auth),
    );
  }

  void _confirmSignOut() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out of Raunak?'),
        content: const Text(
          'You will need to sign in again to view your tickets and access bookings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: RaunakColors.coral,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(context); // dialog
              Navigator.pop(context); // profile page if pushed
              await widget.auth.signOut();
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontFamily: 'InstrumentSerif', fontSize: 26),
        ),
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
            children: [
              if (_successBanner != null) ...[
                TintedLiquidGlass(
                  borderRadius: 14,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, color: Colors.white, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _successBanner!,
                          style: const TextStyle(
                            fontFamily: 'Geist',
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Header Avatar Card
              Center(
                child: Column(
                  children: [
                    Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        LiquidGlassAvatar(
                          size: 88,
                          name: widget.auth.user?.name,
                          tooltip: 'Profile photo',
                        ),
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: RaunakColors.coral,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: dark ? RaunakColors.darkPaper : RaunakColors.paper,
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      widget.auth.user?.name?.isNotEmpty == true
                          ? widget.auth.user!.name!
                          : 'Raunak Member',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontFamily: 'InstrumentSerif',
                        fontSize: 28,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.auth.user?.email ?? '',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),
              const Eyebrow('Personal Details'),
              const SizedBox(height: 10),

              // Personal info card
              LiquidGlass(
                borderRadius: 18,
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Full name',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: dark ? const Color(0xFFC0BAB0) : RaunakColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        hintText: 'Enter your name',
                        prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
                        isDense: true,
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty ? 'Please enter your name' : null,
                    ),
                    const SizedBox(height: 16),

                    Text(
                      'Mobile number',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: dark ? const Color(0xFFC0BAB0) : RaunakColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        prefixIcon: Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                          child: Text(
                            '+91',
                            style: TextStyle(
                              fontFamily: 'Geist',
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        hintText: '10-digit mobile number',
                        isDense: true,
                      ),
                      validator: (val) {
                        final digits = val?.replaceAll(RegExp(r'\D'), '') ?? '';
                        return digits.length == 10
                            ? null
                            : 'Enter a valid 10-digit Indian mobile number';
                      },
                    ),
                    const SizedBox(height: 16),

                    Text(
                      'Preferred city',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: dark ? const Color(0xFFC0BAB0) : RaunakColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Material(
                      color: Colors.transparent,
                      child: ListTile(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: scheme.outline.withValues(alpha: 0.3),
                          ),
                        ),
                        leading: const Icon(Icons.location_city_rounded, size: 20),
                        title: Text(_selectedCity),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          showModalBottomSheet<void>(
                            context: context,
                            builder: (context) => SafeArea(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  for (final city in ['Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Goa'])
                                    ListTile(
                                      title: Text(city),
                                      trailing: _selectedCity == city
                                          ? const Icon(Icons.check, color: RaunakColors.coral)
                                          : null,
                                      onTap: () {
                                        setState(() => _selectedCity = city);
                                        Navigator.pop(context);
                                      },
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Account Email & Change Email trigger
                    Text(
                      'Account email',
                      style: TextStyle(
                        fontFamily: 'Geist',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: dark ? const Color(0xFFC0BAB0) : RaunakColors.muted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              color: scheme.onSurface.withValues(alpha: 0.05),
                              border: Border.all(
                                color: scheme.outline.withValues(alpha: 0.2),
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.mail_outline_rounded, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    widget.auth.user?.email ?? '',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: 'Geist',
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: _openChangeEmail,
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('Change'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Eyebrow('Notifications'),
              const SizedBox(height: 10),

              LiquidGlass(
                borderRadius: 18,
                padding: const EdgeInsets.all(8),
                child: Column(
                  children: [
                    SwitchListTile(
                      value: _whatsappTickets,
                      onChanged: (val) => setState(() => _whatsappTickets = val),
                      title: const Text('WhatsApp ticket delivery'),
                      subtitle: const Text('Get QR codes & booking alerts directly on WhatsApp'),
                      activeTrackColor: RaunakColors.coral,
                    ),
                    Divider(color: scheme.outline.withValues(alpha: 0.15)),
                    SwitchListTile(
                      value: _eventReminders,
                      onChanged: (val) => setState(() => _eventReminders = val),
                      title: const Text('Event reminders'),
                      subtitle: const Text('Schedule reminders 24h and 2h before doors open'),
                      activeTrackColor: RaunakColors.coral,
                    ),
                    Divider(color: scheme.outline.withValues(alpha: 0.15)),
                    SwitchListTile(
                      value: _curatedPicks,
                      onChanged: (val) => setState(() => _curatedPicks = val),
                      title: const Text('Weekend curated picks'),
                      subtitle: const Text('Hand-picked gatherings in your city'),
                      activeTrackColor: RaunakColors.coral,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Eyebrow('Appearance'),
              const SizedBox(height: 10),

              LiquidGlass(
                borderRadius: 18,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Icon(
                      dark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
                      color: RaunakColors.coral,
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Theme mode',
                            style: TextStyle(
                              fontFamily: 'Geist',
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                          Text(
                            dark ? 'Dark charcoal' : 'Warm cream',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () {
                        unawaited(HapticFeedback.selectionClick());
                        widget.onThemeChanged();
                      },
                      icon: Icon(
                        dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                        size: 16,
                      ),
                      label: Text(dark ? 'Light' : 'Dark'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Eyebrow('Support & Community'),
              const SizedBox(height: 10),

              LiquidGlass(
                borderRadius: 18,
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.help_outline_rounded),
                      title: const Text('Help & support'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => openPublicPage(context, '/help'),
                    ),
                    Divider(color: scheme.outline.withValues(alpha: 0.15)),
                    ListTile(
                      leading: const Icon(Icons.confirmation_number_outlined),
                      title: const Text('My tickets'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => WalletScreen(auth: widget.auth),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Sign out button
              Material(
                color: Colors.transparent,
                child: ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                      color: Colors.red.withValues(alpha: 0.3),
                    ),
                  ),
                  leading: const Icon(Icons.logout_rounded, color: Colors.red),
                  title: const Text(
                    'Sign out',
                    style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600),
                  ),
                  onTap: _confirmSignOut,
                ),
              ),

              const SizedBox(height: 20),
              const LegalLinks(intro: ''),
            ],
          ),
        ),
      ),
    );
  }
}

/// Secure verified Change Email sheet (Priority 5)
class _ChangeEmailSheet extends StatefulWidget {
  const _ChangeEmailSheet({required this.auth});
  final AuthController auth;

  @override
  State<_ChangeEmailSheet> createState() => _ChangeEmailSheetState();
}

class _ChangeEmailSheetState extends State<_ChangeEmailSheet> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _newEmailController = TextEditingController();
  bool _obscurePassword = true;
  bool _submitting = false;
  bool _success = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _newEmailController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    unawaited(HapticFeedback.mediumImpact());
    setState(() => _submitting = true);

    // Simulating secure verified update
    Future.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _success = true;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, keyboard + 16),
      child: LiquidGlass(
        borderRadius: 24,
        blur: 32,
        padding: const EdgeInsets.all(22),
        child: _success ? _buildSuccess(context) : _buildForm(context),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_reset_rounded, color: RaunakColors.coral, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Change Account Email',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Your tickets, order history, and bookings remain connected to your account. A verification link will be sent to confirm your new email.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 18),

          Text(
            'Current password',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              hintText: 'Enter current password',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                ),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (v) => (v == null || v.isEmpty) ? 'Password is required' : null,
          ),
          const SizedBox(height: 16),

          Text(
            'New email address',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _newEmailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'name@example.com',
              prefixIcon: Icon(Icons.mail_outline_rounded),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'New email is required';
              if (!v.contains('@') || !v.contains('.')) return 'Enter a valid email address';
              if (v.trim() == widget.auth.user?.email) return 'New email must be different';
              return null;
            },
          ),
          const SizedBox(height: 22),

          PrimaryButton(
            label: _submitting ? 'Verifying…' : 'Update email',
            loading: _submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.mark_email_read_outlined, size: 48, color: RaunakColors.coral),
        const SizedBox(height: 14),
        Text(
          'Verification Sent',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontFamily: 'InstrumentSerif',
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'We’ve sent a confirmation link to ${_newEmailController.text.trim()}. All your existing tickets remain safely linked to this account.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 22),
        PrimaryButton(
          label: 'Done',
          onPressed: () => Navigator.pop(context),
        ),
      ],
    );
  }
}
