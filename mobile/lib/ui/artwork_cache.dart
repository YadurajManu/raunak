import 'package:flutter/material.dart';
import 'artwork.dart';
import 'liquid_glass.dart';

/// In-memory and session photo caching system for Raunak (Priority 1).
///
/// Stores public event photos on the device/memory, reuses them between screens
/// (Discover -> Details -> Checkout -> Wallet), and skips repeat fade/spinners.
class RaunakArtworkCache {
  RaunakArtworkCache._();
  static final RaunakArtworkCache instance = RaunakArtworkCache._();

  final Set<String> _cachedUrls = <String>{};
  final Map<String, ImageProvider> _providers = <String, ImageProvider>{};

  bool isCached(String? url) {
    if (url == null || url.isEmpty) return false;
    return _cachedUrls.contains(url);
  }

  ImageProvider getProvider(String url) {
    return _providers.putIfAbsent(url, () => NetworkImage(url));
  }

  void markCached(String url) {
    _cachedUrls.add(url);
  }

  void evict(String url) {
    _cachedUrls.remove(url);
    _providers.remove(url)?.evict();
  }

  void clear() {
    _cachedUrls.clear();
    for (final provider in _providers.values) {
      provider.evict();
    }
    _providers.clear();
  }
}

/// High-performance cached artwork image widget.
///
/// Features:
/// - Instant display without fade or spinner if already cached.
/// - Fixed aspect ratio to avoid layout shift.
/// - Liquid glass shimmer placeholder while downloading.
/// - Graceful fallback to Raunak sunburst on network failure.
class CachedArtworkImage extends StatefulWidget {
  const CachedArtworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.aspectRatio = 1.0,
    this.borderRadius = 16,
    this.semanticLabel,
  });

  final String? imageUrl;
  final BoxFit fit;
  final double aspectRatio;
  final double borderRadius;
  final String? semanticLabel;

  @override
  State<CachedArtworkImage> createState() => _CachedArtworkImageState();
}

class _CachedArtworkImageState extends State<CachedArtworkImage> {
  ImageStream? _imageStream;
  ImageInfo? _imageInfo;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  @override
  void didUpdateWidget(CachedArtworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.imageUrl != oldWidget.imageUrl) {
      _stopListening();
      _loadImage();
    }
  }

  @override
  void dispose() {
    _stopListening();
    super.dispose();
  }

  void _stopListening() {
    _imageStream?.removeListener(_listener);
    _imageStream = null;
  }

  late final ImageStreamListener _listener = ImageStreamListener(
    (info, synchronousCall) {
      if (!mounted) return;
      if (widget.imageUrl != null) {
        RaunakArtworkCache.instance.markCached(widget.imageUrl!);
      }
      setState(() {
        _imageInfo = info;
        _hasError = false;
      });
    },
    onError: (exception, stackTrace) {
      if (!mounted) return;
      setState(() {
        _hasError = true;
      });
    },
  );

  void _loadImage() {
    final url = widget.imageUrl;
    if (url == null || url.isEmpty) {
      setState(() {
        _hasError = false;
        _imageInfo = null;
      });
      return;
    }

    final provider = RaunakArtworkCache.instance.getProvider(url);
    _imageStream = provider.resolve(ImageConfiguration.empty);

    setState(() {
      _hasError = false;
    });

    _imageStream!.addListener(_listener);
  }

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(widget.borderRadius);
    final scheme = Theme.of(context).colorScheme;

    Widget content;
    if (widget.imageUrl == null || widget.imageUrl!.isEmpty) {
      content = _fallback(context);
    } else if (_hasError) {
      content = _fallback(context);
    } else if (_imageInfo != null) {
      content = RawImage(
        image: _imageInfo!.image,
        fit: widget.fit,
        width: double.infinity,
        height: double.infinity,
      );
    } else if (RaunakArtworkCache.instance.isCached(widget.imageUrl!)) {
      // Rapid fallback while stream re-resolves in frame
      content = Image(
        image: RaunakArtworkCache.instance.getProvider(widget.imageUrl!),
        fit: widget.fit,
        gaplessPlayback: true,
      );
    } else {
      content = LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth.isFinite ? constraints.maxWidth : 300.0;
          final height = constraints.maxHeight.isFinite ? constraints.maxHeight : width / widget.aspectRatio;
          return LiquidGlassSkeleton(
            width: width,
            height: height,
            borderRadius: widget.borderRadius,
          );
        },
      );
    }

    return ClipRRect(
      borderRadius: radius,
      child: Container(
        decoration: BoxDecoration(
          color: scheme.onSurface.withValues(alpha: .045),
          borderRadius: radius,
          border: Border.all(
            color: scheme.outline.withValues(alpha: .2),
          ),
        ),
        child: AspectRatio(
          aspectRatio: widget.aspectRatio,
          child: content,
        ),
      ),
    );
  }

  Widget _fallback(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Sunburst(
          size: 56,
          color: Theme.of(context).colorScheme.primary.withValues(alpha: .6),
        ),
        const SizedBox(height: 14),
        Text(
          'A good plan awaits.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}
