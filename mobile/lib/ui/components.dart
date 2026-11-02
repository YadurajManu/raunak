import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'theme.dart';

class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.size = 34, this.showName = true});
  final double size;
  final bool showName;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      label: 'Raunak',
      child: ExcludeSemantics(
        child: MediaQuery.withNoTextScaling(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ExcludeSemantics(
                  child: Image.asset(
                    dark
                        ? 'assets/brand/mark-dark.png'
                        : 'assets/brand/mark.png',
                    width: size,
                    height: size,
                    fit: BoxFit.contain,
                  ),
                ),
                if (showName) ...[
                  const SizedBox(width: 9),
                  Text(
                    'Raunak',
                    style: TextStyle(
                      fontFamily: 'InstrumentSerif',
                      fontSize: size * .95,
                      height: 1,
                      letterSpacing: -.6,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(
      fontSize: 10,
      letterSpacing: 2.3,
      height: 1.5,
      fontWeight: FontWeight.w600,
      color: color ?? Theme.of(context).colorScheme.primary,
    ),
  );
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon = Icons.arrow_forward_rounded,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return Padding(
      padding: const EdgeInsets.only(right: 3, bottom: 4),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(13),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF82796A)
                  : RaunakColors.ink,
              offset: const Offset(3, 4),
              blurRadius: 0,
            ),
          ],
        ),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: enabled ? onPressed : null,
            style: FilledButton.styleFrom(
              backgroundColor: RaunakColors.coral,
              foregroundColor: RaunakColors.ink,
              disabledBackgroundColor:
                  Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFFB98878)
                  : const Color(0xFFE3B5A5),
              disabledForegroundColor: RaunakColors.ink,
              minimumSize: const Size(0, 56),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              textStyle: const TextStyle(
                fontFamily: 'Geist',
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(13),
                side: const BorderSide(color: RaunakColors.ink, width: 1.2),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (loading) ...[
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: RaunakColors.ink,
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Flexible(child: Text(label, textAlign: TextAlign.center)),
                if (!loading) ...[
                  const SizedBox(width: 12),
                  Icon(icon, size: 19),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: OutlinedButton.icon(
      onPressed: onPressed,
      icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        minimumSize: const Size(0, 54),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        textStyle: const TextStyle(
          fontFamily: 'Geist',
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
        side: BorderSide(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: .65),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
      ),
    ),
  );
}

class FeedbackBanner extends StatelessWidget {
  const FeedbackBanner({super.key, required this.message, this.isError = true});
  final String message;
  final bool isError;
  @override
  Widget build(BuildContext context) {
    final color = isError
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 20),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .08),
          border: Border.all(color: color.withValues(alpha: .3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isError
                  ? Icons.info_outline_rounded
                  : Icons.check_circle_outline_rounded,
              size: 18,
              color: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: color, height: 1.5, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> openPublicPage(BuildContext context, String path) async {
  var opened = false;
  try {
    opened = await launchUrl(
      Uri.https('raunak.yaduraj.me', path),
      mode: LaunchMode.externalApplication,
    );
  } catch (_) {
    opened = false;
  }
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open the link. Please try again.'),
      ),
    );
  }
}

class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key, this.intro = 'Good plans. Your peace of mind.'});
  final String intro;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (intro.isNotEmpty)
          Text(
            intro,
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 0,
          children: [
            TextButton(
              onPressed: () => openPublicPage(context, '/terms'),
              child: const Text('Terms', style: TextStyle(fontSize: 12)),
            ),
            Text('·', style: Theme.of(context).textTheme.bodySmall),
            TextButton(
              onPressed: () => openPublicPage(context, '/privacy'),
              child: const Text('Privacy', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
      ],
    ),
  );
}

class EnterTransition extends StatelessWidget {
  const EnterTransition({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 450),
  });
  final Widget child;
  final Duration duration;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 15 * (1 - value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
