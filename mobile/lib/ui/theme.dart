import 'package:flutter/material.dart';

abstract final class RaunakColors {
  static const paper = Color(0xFFF5F0E6);
  static const ink = Color(0xFF1C1A16);
  static const coral = Color(0xFFFF4F2B);
  static const darkPaper = Color(0xFF171612);
  static const darkSurface = Color(0xFF23221D);
  static const muted = Color(0xFF625E55);
}

ThemeData raunakTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final ink = dark ? RaunakColors.paper : RaunakColors.ink;
  final surface = dark ? RaunakColors.darkSurface : const Color(0xFFEEE7D9);
  final scheme = ColorScheme.fromSeed(
    seedColor: RaunakColors.coral,
    brightness: brightness,
    surface: dark ? RaunakColors.darkPaper : RaunakColors.paper,
    onSurface: ink,
    primary: dark ? const Color(0xFFFF9B80) : const Color(0xFFAB2B13),
    onPrimary: dark ? RaunakColors.ink : Colors.white,
    outline: dark ? const Color(0xFF8B877C) : const Color(0xFF79746A),
    error: dark ? const Color(0xFFFFAAA2) : const Color(0xFFA92519),
  );
  final text = ThemeData(
    brightness: brightness,
  ).textTheme.apply(fontFamily: 'Geist', bodyColor: ink, displayColor: ink);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'Geist',
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    textTheme: text.copyWith(
      displayLarge: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 62,
        height: .94,
        color: ink,
      ),
      displayMedium: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 49,
        height: 1.02,
        color: ink,
      ),
      headlineLarge: TextStyle(
        fontFamily: 'InstrumentSerif',
        fontSize: 44,
        height: 1.05,
        color: ink,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: ink,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.55, color: ink),
      bodyMedium: TextStyle(fontSize: 14, height: 1.5, color: ink),
      bodySmall: TextStyle(
        fontSize: 12,
        height: 1.5,
        color: dark ? const Color(0xFFBDB7AA) : RaunakColors.muted,
      ),
      labelLarge: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: ink,
      ),
    ),
    dividerTheme: DividerThemeData(color: ink.withValues(alpha: .18), space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface.withValues(alpha: .35),
      hintStyle: TextStyle(
        color: dark ? const Color(0xFFBDB7AA) : RaunakColors.muted,
        fontSize: 15,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 17, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outline.withValues(alpha: .65)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
      errorMaxLines: 3,
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: scheme.primary,
        textStyle: const TextStyle(
          fontFamily: 'Geist',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: ink,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? RaunakColors.coral
            : Colors.transparent,
      ),
      checkColor: const WidgetStatePropertyAll(RaunakColors.ink),
      side: BorderSide(color: scheme.outline, width: 1.3),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: ink,
      contentTextStyle: TextStyle(fontFamily: 'Geist', color: scheme.surface),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
