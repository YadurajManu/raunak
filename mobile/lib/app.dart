import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'auth/auth_controller.dart';
import 'discovery/discovery_repository.dart';
import 'ui/artwork.dart';
import 'ui/components.dart';
import 'ui/discover_screen.dart';
import 'ui/theme.dart';

class RaunakApp extends StatefulWidget {
  const RaunakApp({super.key, required this.auth, this.discoveryRepository});
  final AuthController auth;
  final DiscoveryRepository? discoveryRepository;
  @override
  State<RaunakApp> createState() => _RaunakAppState();
}

enum _EntryPage { welcome, login, signup }

class _RaunakAppState extends State<RaunakApp> {
  bool _splashFinished = false;
  Timer? _splashTimer;
  ThemeMode _themeMode = ThemeMode.system;
  _EntryPage _entry = _EntryPage.welcome;
  String _email = '';
  AuthStatus? _lastStatus;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _splashTimer ??= Timer(
      Duration(
        milliseconds:
            WidgetsBinding
                .instance
                .platformDispatcher
                .accessibilityFeatures
                .disableAnimations
            ? 120
            : 1850,
      ),
      () {
        if (mounted) setState(() => _splashFinished = true);
      },
    );
  }

  @override
  void dispose() {
    _splashTimer?.cancel();
    super.dispose();
  }

  void _open(_EntryPage page) {
    widget.auth.clearFeedback();
    setState(() => _entry = page);
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Raunak',
    debugShowCheckedModeBanner: false,
    theme: raunakTheme(Brightness.light),
    darkTheme: raunakTheme(Brightness.dark),
    themeMode: _themeMode,
    home: ListenableBuilder(
      listenable: widget.auth,
      builder: (context, child) {
        final auth = widget.auth;
        if (_lastStatus == AuthStatus.signedIn &&
            auth.status == AuthStatus.signedOut) {
          _entry = _EntryPage.welcome;
        }
        _lastStatus = auth.status;
        Widget screen;
        if (!_splashFinished) {
          screen = const _SplashScreen(key: ValueKey('splash'));
        } else if (auth.status == AuthStatus.restoring) {
          screen = const _RestoringScreen(key: ValueKey('restoring'));
        } else if (auth.status == AuthStatus.unavailable) {
          screen = _UnavailableScreen(
            key: const ValueKey('unavailable'),
            auth: auth,
          );
        } else if (auth.status == AuthStatus.signedIn && auth.user != null) {
          screen = DiscoverScreen(
            key: const ValueKey('signed-in'),
            auth: auth,
            repository: widget.discoveryRepository,
            onTheme: () => _switchTheme(context),
          );
        } else if (_entry == _EntryPage.welcome) {
          screen = _WelcomeScreen(
            key: const ValueKey('welcome'),
            onSignIn: () => _open(_EntryPage.login),
            onSignUp: () => _open(_EntryPage.signup),
            onTheme: () => _switchTheme(context),
          );
        } else {
          screen = _AuthScreen(
            key: ValueKey(_entry),
            signup: _entry == _EntryPage.signup,
            auth: auth,
            initialEmail: _email,
            onEmailChanged: (value) => _email = value,
            onBack: () => _open(_EntryPage.welcome),
            onSwitch: () => _open(
              _entry == _EntryPage.login ? _EntryPage.signup : _EntryPage.login,
            ),
          );
        }
        return AnimatedSwitcher(
          duration: Duration(
            milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 260,
          ),
          child: screen,
        );
      },
    ),
  );

  void _switchTheme(BuildContext context) => setState(
    () => _themeMode = Theme.of(context).brightness == Brightness.dark
        ? ThemeMode.light
        : ThemeMode.dark,
  );
}

class _SplashScreen extends StatefulWidget {
  const _SplashScreen({super.key});
  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animation = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );
  bool _started = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      if (MediaQuery.disableAnimationsOf(context)) {
        _animation.value = 1;
      } else {
        _animation.forward();
      }
    }
  }

  @override
  void dispose() {
    _animation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Stack(
        children: [
          Center(
            child: AnimatedBuilder(
              animation: _animation,
              builder: (context, child) {
                final value = Curves.easeOutCubic.transform(_animation.value);
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Transform.scale(
                      scale: .35 + value * .65,
                      child: Transform.rotate(
                        angle: (1 - value) * -.7,
                        child: const Sunburst(size: 112),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Opacity(
                      opacity: value,
                      child: Text(
                        'Raunak',
                        style: TextStyle(
                          fontFamily: 'InstrumentSerif',
                          fontSize: 66,
                          height: 1,
                          letterSpacing: -2,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(height: 13),
                    Opacity(
                      opacity: value,
                      child: const Eyebrow('A little more life.'),
                    ),
                  ],
                );
              },
            ),
          ),
          Positioned(
            bottom: 30,
            left: 24,
            right: 24,
            child: Text(
              'GOOD PEOPLE. GREAT PLANS.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 2.2,
                color: Theme.of(context).textTheme.bodySmall?.color,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _RestoringScreen extends StatelessWidget {
  const _RestoringScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandLockup(size: 40),
              const SizedBox(height: 36),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(height: 20),
              Text(
                'Getting your account ready…',
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _WelcomeScreen extends StatelessWidget {
  const _WelcomeScreen({
    super.key,
    required this.onSignIn,
    required this.onSignUp,
    required this.onTheme,
  });
  final VoidCallback onSignIn;
  final VoidCallback onSignUp;
  final VoidCallback onTheme;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, viewport) {
          final artHeight = (viewport.maxHeight - 550).clamp(175.0, 250.0);
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: SingleChildScrollView(
                physics: const ClampingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(26, 8, 26, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: BrandLockup(),
                          ),
                        ),
                        _ThemeButton(onPressed: onTheme),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      height: artHeight,
                      child: const EnterTransition(child: WelcomeArtwork()),
                    ),
                    const SizedBox(height: 10),
                    const Eyebrow('A good plan starts here'),
                    const SizedBox(height: 8),
                    EnterTransition(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(text: 'Make room for\na little '),
                            TextSpan(
                              text: 'raunak.',
                              style: TextStyle(
                                fontStyle: FontStyle.italic,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                        style: Theme.of(context).textTheme.displayMedium,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Find your people. Discover events worth stepping out for.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      ),
                    ),
                    const SizedBox(height: 20),
                    PrimaryButton(
                      label: 'Create an account',
                      onPressed: onSignUp,
                    ),
                    const SizedBox(height: 10),
                    SecondaryButton(
                      label: 'I already have an account',
                      onPressed: onSignIn,
                    ),
                    const SizedBox(height: 8),
                    const LegalLinks(intro: ''),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}

class _ThemeButton extends StatelessWidget {
  const _ThemeButton({required this.onPressed});
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return IconButton(
      onPressed: onPressed,
      tooltip: dark ? 'Switch to light mode' : 'Switch to dark mode',
      icon: Icon(
        dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
        size: 21,
      ),
    );
  }
}

class _AuthScreen extends StatefulWidget {
  const _AuthScreen({
    super.key,
    required this.signup,
    required this.auth,
    required this.initialEmail,
    required this.onEmailChanged,
    required this.onBack,
    required this.onSwitch,
  });
  final bool signup;
  final AuthController auth;
  final String initialEmail;
  final ValueChanged<String> onEmailChanged;
  final VoidCallback onBack;
  final VoidCallback onSwitch;
  @override
  State<_AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<_AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  late final _email = TextEditingController(text: widget.initialEmail);
  final _password = TextEditingController();
  bool _showPassword = false;
  bool _accepted = false;
  bool _showAcceptanceError = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (widget.auth.busy) return;
    FocusScope.of(context).unfocus();
    final valid = _form.currentState!.validate();
    if (widget.signup && !_accepted) {
      setState(() => _showAcceptanceError = true);
    }
    if (!valid || (widget.signup && !_accepted)) return;
    final result = widget.signup
        ? await widget.auth.signUp(
            _name.text.trim(),
            _email.text.trim(),
            _password.text,
          )
        : await widget.auth.signIn(_email.text.trim(), _password.text);
    if (result) TextInput.finishAutofillContext();
  }

  @override
  Widget build(BuildContext context) {
    final auth = widget.auth;
    final signup = widget.signup;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && !auth.busy) widget.onBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: LayoutBuilder(
                builder: (context, viewport) {
                  final compact = viewport.maxHeight < 800;
                  return SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(26, 8, 26, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              onPressed: auth.busy ? null : widget.onBack,
                              tooltip: 'Back to welcome',
                              icon: const Icon(
                                Icons.arrow_back_rounded,
                                size: 22,
                              ),
                            ),
                            const Flexible(
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: BrandLockup(size: 30),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: compact ? 12 : 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Eyebrow(
                                    signup
                                        ? 'Your next chapter'
                                        : 'Good to see you again',
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    signup
                                        ? 'A little more life.'
                                        : 'Welcome back.',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.headlineLarge,
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(top: 23, left: 6),
                              child: Sunburst(
                                size: 36,
                                rotation: math.pi / 24,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          signup
                              ? 'Good plans start with you.'
                              : 'Sign in to keep your plans close.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.color,
                              ),
                        ),
                        SizedBox(height: compact ? 20 : 26),
                        if (auth.error != null)
                          FeedbackBanner(message: auth.error!),
                        if (auth.notice != null)
                          FeedbackBanner(message: auth.notice!, isError: false),
                        AutofillGroup(
                          child: Form(
                            key: _form,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (signup) ...[
                                  const _FieldLabel('Full name'),
                                  TextFormField(
                                    controller: _name,
                                    enabled: !auth.busy,
                                    autofillHints: const [AutofillHints.name],
                                    textCapitalization:
                                        TextCapitalization.words,
                                    textInputAction: TextInputAction.next,
                                    maxLength: 100,
                                    decoration: const InputDecoration(
                                      hintText: 'What should we call you?',
                                      counterText: '',
                                      prefixIcon: Icon(
                                        Icons.person_outline_rounded,
                                        size: 19,
                                      ),
                                    ),
                                    validator: (value) =>
                                        (value ?? '').trim().length < 2
                                        ? 'Enter your full name.'
                                        : null,
                                  ),
                                  SizedBox(height: compact ? 14 : 20),
                                ],
                                const _FieldLabel('Email address'),
                                TextFormField(
                                  controller: _email,
                                  enabled: !auth.busy,
                                  onChanged: widget.onEmailChanged,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [
                                    AutofillHints.email,
                                    AutofillHints.username,
                                  ],
                                  autocorrect: false,
                                  maxLength: 254,
                                  decoration: const InputDecoration(
                                    hintText: 'you@example.com',
                                    counterText: '',
                                    prefixIcon: Icon(
                                      Icons.alternate_email_rounded,
                                      size: 19,
                                    ),
                                  ),
                                  validator: _validateEmail,
                                ),
                                SizedBox(height: compact ? 14 : 20),
                                const _FieldLabel('Password'),
                                TextFormField(
                                  controller: _password,
                                  enabled: !auth.busy,
                                  obscureText: !_showPassword,
                                  autocorrect: false,
                                  enableSuggestions: false,
                                  textInputAction: TextInputAction.done,
                                  autofillHints: [
                                    signup
                                        ? AutofillHints.newPassword
                                        : AutofillHints.password,
                                  ],
                                  onFieldSubmitted: (_) => _submit(),
                                  decoration: InputDecoration(
                                    hintText: signup
                                        ? 'Make it at least 8 characters'
                                        : 'Your password',
                                    prefixIcon: const Icon(
                                      Icons.lock_outline_rounded,
                                      size: 19,
                                    ),
                                    suffixIcon: IconButton(
                                      tooltip: _showPassword
                                          ? 'Hide password'
                                          : 'Show password',
                                      onPressed: () => setState(
                                        () => _showPassword = !_showPassword,
                                      ),
                                      icon: Icon(
                                        _showPassword
                                            ? Icons.visibility_off_outlined
                                            : Icons.visibility_outlined,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                  validator: (value) {
                                    if ((value ?? '').isEmpty) {
                                      return 'Enter your password.';
                                    }
                                    if (signup && value!.length < 8) {
                                      return 'Use at least 8 characters for your password.';
                                    }
                                    return null;
                                  },
                                ),
                                if (!signup)
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: auth.busy
                                          ? null
                                          : _resetPassword,
                                      child: const Text('Forgot password?'),
                                    ),
                                  ),
                                if (signup) ...[
                                  const SizedBox(height: 8),
                                  _AcceptanceRow(
                                    value: _accepted,
                                    enabled: !auth.busy,
                                    onChanged: (value) => setState(() {
                                      _accepted = value;
                                      _showAcceptanceError = false;
                                    }),
                                  ),
                                  if (_showAcceptanceError)
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        left: 12,
                                        bottom: 10,
                                      ),
                                      child: Semantics(
                                        liveRegion: true,
                                        child: Text(
                                          'Please agree to the Terms and Privacy Policy to continue.',
                                          style: TextStyle(
                                            color: Theme.of(
                                              context,
                                            ).colorScheme.error,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                                SizedBox(height: signup ? 12 : 8),
                                PrimaryButton(
                                  label: auth.busy
                                      ? (signup
                                            ? 'Creating your account…'
                                            : 'Signing you in…')
                                      : (signup ? 'Create account' : 'Sign in'),
                                  loading: auth.busy,
                                  onPressed: auth.busy ? null : _submit,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Center(
                          child: Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                signup
                                    ? 'Already part of Raunak?'
                                    : 'New around here?',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: Theme.of(
                                        context,
                                      ).textTheme.bodySmall?.color,
                                    ),
                              ),
                              TextButton(
                                onPressed: auth.busy ? null : widget.onSwitch,
                                child: Text(
                                  signup ? 'Sign in' : 'Create an account',
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (!signup) const LegalLinks(intro: ''),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _resetPassword() async {
    widget.auth.clearFeedback();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) =>
          _ResetPasswordSheet(auth: widget.auth, initialEmail: _email.text),
    );
    if (mounted) widget.auth.clearFeedback();
  }
}

String? _validateEmail(String? value) {
  final email = (value ?? '').trim();
  if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
    return 'Enter a valid email address.';
  }
  return null;
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      label,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
    ),
  );
}

class _AcceptanceRow extends StatelessWidget {
  const _AcceptanceRow({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        label: 'Agree to the Terms and Privacy Policy',
        child: Checkbox(
          value: value,
          onChanged: enabled ? (value) => onChanged(value ?? false) : null,
        ),
      ),
      Expanded(
        child: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 0,
            children: [
              Text(
                'I agree to the',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              TextButton(
                onPressed: () => openPublicPage(context, '/terms'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                ),
                child: const Text('Terms', style: TextStyle(fontSize: 12)),
              ),
              Text('and', style: Theme.of(context).textTheme.bodySmall),
              TextButton(
                onPressed: () => openPublicPage(context, '/privacy'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                ),
                child: const Text(
                  'Privacy Policy',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _ResetPasswordSheet extends StatefulWidget {
  const _ResetPasswordSheet({required this.auth, required this.initialEmail});
  final AuthController auth;
  final String initialEmail;
  @override
  State<_ResetPasswordSheet> createState() => _ResetPasswordSheetState();
}

class _ResetPasswordSheetState extends State<_ResetPasswordSheet> {
  late final _email = TextEditingController(text: widget.initialEmail);
  final _form = GlobalKey<FormState>();
  bool _sent = false;
  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate() || widget.auth.busy) return;
    final sent = await widget.auth.resetPassword(_email.text.trim());
    if (mounted && sent) setState(() => _sent = true);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.auth,
    builder: (context, child) => SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        26,
        0,
        26,
        28 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'A fresh start.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 12),
            Text(
              _sent
                  ? 'If an account uses that email, you’ll receive a password reset link. Check your inbox and spam folder.'
                  : 'Enter your account email and we’ll help you reset your password.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).textTheme.bodySmall?.color,
              ),
            ),
            const SizedBox(height: 24),
            if (widget.auth.error != null)
              FeedbackBanner(message: widget.auth.error!),
            if (_sent) ...[
              const Icon(Icons.mark_email_read_outlined, size: 42),
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Back to sign in',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ] else ...[
              const _FieldLabel('Email address'),
              TextFormField(
                controller: _email,
                enabled: !widget.auth.busy,
                validator: _validateEmail,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.email],
                autocorrect: false,
                onFieldSubmitted: (_) => _submit(),
                decoration: const InputDecoration(hintText: 'you@example.com'),
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: widget.auth.busy ? 'Sending link…' : 'Send reset link',
                loading: widget.auth.busy,
                onPressed: widget.auth.busy ? null : _submit,
                icon: Icons.mail_outline_rounded,
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _UnavailableScreen extends StatelessWidget {
  const _UnavailableScreen({super.key, required this.auth});
  final AuthController auth;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandLockup(),
                const SizedBox(height: 54),
                const Icon(Icons.cloud_off_outlined, size: 38),
                const SizedBox(height: 24),
                Text(
                  'A little pause.',
                  style: Theme.of(context).textTheme.displayMedium,
                ),
                const SizedBox(height: 18),
                Text(
                  auth.error ??
                      'We couldn’t check your account right now. Please check your connection and try again.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 30),
                PrimaryButton(
                  label: auth.busy ? 'Trying again…' : 'Try again',
                  loading: auth.busy,
                  onPressed: auth.busy ? null : () => auth.restore(),
                  icon: Icons.refresh_rounded,
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => openPublicPage(context, '/help'),
                  child: const Text('Get help'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
