import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme.dart';

/// iOS 26 Liquid Glass Design System for Raunak
///
/// Features:
/// - Double-pass optical blur (`ImageFilter.blur`)
/// - Dynamic specular edge reflection (highlight at top-left, shadow reflection at bottom-right)
/// - Adaptive ambient light refraction based on dark charcoal / paper cream theme
/// - Radiant Coral tinted glass variant for active/selected states
/// - Fluid spring micro-interactions and tactile haptics

class LiquidGlass extends StatelessWidget {
  const LiquidGlass({
    super.key,
    required this.child,
    this.borderRadius = 20,
    this.blur = 24,
    this.tint,
    this.borderGradient,
    this.borderColor,
    this.borderWidth = 1.0,
    this.padding,
    this.margin,
    this.shadows,
    this.clipBehavior = Clip.antiAlias,
  });

  final Widget child;
  final double borderRadius;
  final double blur;
  final Color? tint;
  final Gradient? borderGradient;
  final Color? borderColor;
  final double borderWidth;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final List<BoxShadow>? shadows;
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final radius = BorderRadius.circular(borderRadius);

    // Default iOS 26 Liquid Glass tint
    final surfaceTint = tint ??
        (dark
            ? const Color(0xFF23221D).withValues(alpha: 0.68)
            : const Color(0xFFF5F0E6).withValues(alpha: 0.78));

    final effectiveShadows = shadows ??
        [
          BoxShadow(
            color: dark
                ? Colors.black.withValues(alpha: 0.28)
                : const Color(0xFF786C50).withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ];

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: effectiveShadows,
      ),
      child: ClipRRect(
        borderRadius: radius,
        clipBehavior: clipBehavior,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: CustomPaint(
            foregroundPainter: _SpecularBorderPainter(
              borderRadius: radius,
              borderWidth: borderWidth,
              gradient: borderGradient ??
                  LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: dark
                        ? [
                            Colors.white.withValues(alpha: 0.22),
                            Colors.white.withValues(alpha: 0.05),
                            Colors.black.withValues(alpha: 0.15),
                          ]
                        : [
                            Colors.white.withValues(alpha: 0.85),
                            Colors.white.withValues(alpha: 0.25),
                            const Color(0xFF79746A).withValues(alpha: 0.20),
                          ],
                    stops: const [0.0, 0.45, 1.0],
                  ),
              solidColor: borderColor,
            ),
            child: Container(
              padding: padding,
              decoration: BoxDecoration(
                color: surfaceTint,
                borderRadius: radius,
              ),
              child: Material(
                color: Colors.transparent,
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Specular hairline border painter creating the liquid glass reflection
class _SpecularBorderPainter extends CustomPainter {
  const _SpecularBorderPainter({
    required this.borderRadius,
    required this.borderWidth,
    required this.gradient,
    this.solidColor,
  });

  final BorderRadius borderRadius;
  final double borderWidth;
  final Gradient gradient;
  final Color? solidColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (borderWidth <= 0) return;
    final rect = Offset.zero & size;
    final rrect = borderRadius.toRRect(rect).deflate(borderWidth / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;

    if (solidColor != null) {
      paint.color = solidColor!;
    } else {
      paint.shader = gradient.createShader(rect);
    }

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(_SpecularBorderPainter oldDelegate) =>
      oldDelegate.borderRadius != borderRadius ||
      oldDelegate.borderWidth != borderWidth ||
      oldDelegate.solidColor != solidColor ||
      oldDelegate.gradient != gradient;
}

/// Radiant Coral Liquid Glass container for selected states & badges
class TintedLiquidGlass extends StatelessWidget {
  const TintedLiquidGlass({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.padding,
    this.glow = true,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    return Container(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: glow
            ? [
                BoxShadow(
                  color: RaunakColors.coral.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: radius,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  RaunakColors.coral.withValues(alpha: 0.92),
                  const Color(0xFFD63B1A).withValues(alpha: 0.96),
                ],
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.35),
                width: 1.2,
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Interactive iOS 26 Liquid Glass Filter Chip
class LiquidGlassChip extends StatelessWidget {
  const LiquidGlassChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.showClear = true,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final bool showClear;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Padding(
        padding: const EdgeInsets.only(right: 8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                unawaited(HapticFeedback.selectionClick());
                onTap();
              },
              borderRadius: BorderRadius.circular(14),
              child: selected
                  ? TintedLiquidGlass(
                      borderRadius: 14,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      glow: true,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (icon != null) ...[
                            Icon(icon, size: 14, color: Colors.white),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            label,
                            style: const TextStyle(
                              fontFamily: 'Geist',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                              letterSpacing: -0.2,
                            ),
                          ),
                          if (showClear &&
                              label != 'Any time' &&
                              label != 'All categories' &&
                              label != 'All prices') ...[
                            const SizedBox(width: 6),
                            const Icon(
                              Icons.close_rounded,
                              size: 13,
                              color: Colors.white,
                            ),
                          ],
                        ],
                      ),
                    )
                  : LiquidGlass(
                      borderRadius: 14,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      blur: 16,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (icon != null) ...[
                            Icon(
                              icon,
                              size: 14,
                              color: dark
                                  ? const Color(0xFFC8C1B3)
                                  : RaunakColors.muted,
                            ),
                            const SizedBox(width: 6),
                          ],
                          Text(
                            label,
                            style: TextStyle(
                              fontFamily: 'Geist',
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: scheme.onSurface,
                              letterSpacing: -0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Circular Glass Avatar with initials or photo and specular glow ring
class LiquidGlassAvatar extends StatelessWidget {
  const LiquidGlassAvatar({
    super.key,
    this.name,
    this.imageUrl,
    this.size = 40,
    this.onTap,
    this.tooltip = 'Your account',
  });

  final String? name;
  final String? imageUrl;
  final double size;
  final VoidCallback? onTap;
  final String tooltip;

  String get _initials {
    final trimmed = name?.trim() ?? '';
    if (trimmed.isEmpty) return 'R';
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return trimmed.substring(0, 1).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    Widget avatarContent;
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatarContent = Image.network(
        imageUrl!,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _textAvatar(context),
      );
    } else {
      avatarContent = _textAvatar(context);
    }

    final button = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (onTap != null) {
            unawaited(HapticFeedback.selectionClick());
            onTap!();
          }
        },
        customBorder: const CircleBorder(),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: dark
                    ? Colors.black.withValues(alpha: 0.35)
                    : const Color(0xFF786C50).withValues(alpha: 0.15),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: ClipOval(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: dark
                      ? const Color(0xFF2A2822).withValues(alpha: 0.85)
                      : const Color(0xFFEBE4D5).withValues(alpha: 0.90),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: dark ? 0.30 : 0.80),
                    width: 1.3,
                  ),
                ),
                child: Center(child: avatarContent),
              ),
            ),
          ),
        ),
      ),
    );

    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
        child: button,
      ),
    );
  }

  Widget _textAvatar(BuildContext context) {
    return Text(
      _initials,
      style: TextStyle(
        fontFamily: 'Geist',
        fontSize: size * 0.38,
        fontWeight: FontWeight.w700,
        color: Theme.of(context).colorScheme.primary,
        letterSpacing: -0.5,
      ),
    );
  }
}

/// Floating Liquid Glass Bottom Navigation Bar
class LiquidGlassBottomBar extends StatelessWidget {
  const LiquidGlassBottomBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<LiquidBarItem> items;

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(18, 0, 18, bottomPadding > 0 ? bottomPadding + 6 : 14),
      child: LiquidGlass(
        borderRadius: 32,
        blur: 28,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        shadows: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            for (int i = 0; i < items.length; i++)
              Expanded(
                child: _NavBarTab(
                  item: items[i],
                  isSelected: currentIndex == i,
                  onTap: () {
                    unawaited(HapticFeedback.selectionClick());
                    onTap(i);
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class LiquidBarItem {
  const LiquidBarItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.badgeCount = 0,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int badgeCount;
}

class _NavBarTab extends StatelessWidget {
  const _NavBarTab({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  final LiquidBarItem item;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Semantics(
      button: true,
      selected: isSelected,
      label: item.badgeCount > 0
          ? '${item.label}, ${item.badgeCount} upcoming'
          : item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: isSelected
                ? (dark
                    ? RaunakColors.coral.withValues(alpha: 0.18)
                    : RaunakColors.coral.withValues(alpha: 0.14))
                : Colors.transparent,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Icon(
                    isSelected ? item.selectedIcon : item.icon,
                    size: 22,
                    color: isSelected
                        ? RaunakColors.coral
                        : (dark
                            ? const Color(0xFFB5AF9F)
                            : const Color(0xFF6E685D)),
                  ),
                  if (item.badgeCount > 0)
                    Positioned(
                      top: -4,
                      right: -10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1.5,
                        ),
                        decoration: BoxDecoration(
                          color: RaunakColors.coral,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: dark
                                ? RaunakColors.darkPaper
                                : RaunakColors.paper,
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: RaunakColors.coral.withValues(alpha: 0.4),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(minWidth: 16),
                        child: Text(
                          '${item.badgeCount}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: 'Geist',
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                item.label,
                maxLines: 1,
                style: TextStyle(
                  fontFamily: 'Geist',
                  fontSize: 10.5,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? (dark ? Colors.white : RaunakColors.ink)
                      : (dark
                          ? const Color(0xFF9E988A)
                          : const Color(0xFF7E776B)),
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shimmering iOS 26 Liquid Glass Skeleton Loader with zero layout shift
class LiquidGlassSkeleton extends StatefulWidget {
  const LiquidGlassSkeleton({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 14,
  });

  final double width;
  final double height;
  final double borderRadius;

  @override
  State<LiquidGlassSkeleton> createState() => _LiquidGlassSkeletonState();
}

class _LiquidGlassSkeletonState extends State<LiquidGlassSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = dark
        ? const Color(0xFF26241F).withValues(alpha: 0.6)
        : const Color(0xFFE5DDD0).withValues(alpha: 0.5);
    final highlightColor = dark
        ? const Color(0xFF38352D).withValues(alpha: 0.8)
        : const Color(0xFFF7F3EB).withValues(alpha: 0.9);

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              begin: Alignment(-1.5 + _controller.value * 3, -0.3),
              end: Alignment(-0.5 + _controller.value * 3, 0.3),
              colors: [baseColor, highlightColor, baseColor],
            ),
            border: Border.all(
              color: dark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.white.withValues(alpha: 0.45),
              width: 1,
            ),
          ),
        );
      },
    );
  }
}
