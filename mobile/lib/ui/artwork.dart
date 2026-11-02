import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'theme.dart';

class Sunburst extends StatelessWidget {
  const Sunburst({
    super.key,
    this.color = RaunakColors.coral,
    this.size = 100,
    this.rotation = 0,
    this.hollow = false,
  });
  final Color color;
  final double size;
  final double rotation;
  final bool hollow;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Transform.rotate(
      angle: rotation,
      child: CustomPaint(
        size: Size.square(size),
        painter: _SunburstPainter(color, hollow),
      ),
    ),
  );
}

class _SunburstPainter extends CustomPainter {
  const _SunburstPainter(this.color, this.hollow);
  final Color color;
  final bool hollow;
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide / 2;
    final path = Path();
    for (var index = 0; index < 48; index++) {
      final angle = index * math.pi / 24 - math.pi / 2;
      final distance = index.isEven ? radius : radius * .72;
      final point =
          center +
          Offset(math.cos(angle) * distance, math.sin(angle) * distance);
      if (index == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    path.close();
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = hollow ? PaintingStyle.stroke : PaintingStyle.fill
        ..strokeWidth = 1.2,
    );
  }

  @override
  bool shouldRepaint(_SunburstPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.hollow != hollow;
}

class WelcomeArtwork extends StatelessWidget {
  const WelcomeArtwork({super.key});
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // This is decorative printed artwork, so scale its entire canvas together.
    return ExcludeSemantics(
      child: MediaQuery.withNoTextScaling(
        child: AspectRatio(
          aspectRatio: 360 / 310,
          child: FittedBox(
            fit: BoxFit.contain,
            child: SizedBox(
              width: 360,
              height: 310,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Positioned(
                    top: 12,
                    right: 2,
                    child: Sunburst(
                      size: 184,
                      color: RaunakColors.coral.withValues(
                        alpha: dark ? .22 : .15,
                      ),
                      rotation: .1,
                      hollow: true,
                    ),
                  ),
                  Positioned(
                    bottom: 7,
                    left: 0,
                    child: Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Theme.of(
                            context,
                          ).colorScheme.onSurface.withValues(alpha: .12),
                        ),
                      ),
                    ),
                  ),
                  Transform.rotate(
                    angle: -.075,
                    child: Container(
                      width: 310,
                      decoration: BoxDecoration(
                        color: RaunakColors.ink,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: dark
                                ? Colors.black.withValues(alpha: .4)
                                : const Color(
                                    0xFF786C50,
                                  ).withValues(alpha: .15),
                            blurRadius: 0,
                            offset: const Offset(7, 9),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(24, 21, 24, 19),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Expanded(
                                      child: FittedBox(
                                        fit: BoxFit.scaleDown,
                                        alignment: Alignment.centerLeft,
                                        child: Text(
                                          'RAUNAK / THE GOOD PLAN CLUB',
                                          maxLines: 1,
                                          style: TextStyle(
                                            color: Color(0xFFC8C1B3),
                                            fontSize: 8,
                                            letterSpacing: 1.35,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                    SizedBox(width: 12),
                                    Icon(
                                      Icons.north_east_rounded,
                                      size: 16,
                                      color: RaunakColors.paper,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 22),
                                const Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Expanded(
                                      child: FittedBox(
                                        fit: BoxFit.scaleDown,
                                        alignment: Alignment.centerLeft,
                                        child: Text(
                                          'Good people.\nGreat plans.',
                                          softWrap: false,
                                          style: TextStyle(
                                            fontFamily: 'InstrumentSerif',
                                            fontSize: 39,
                                            height: .98,
                                            color: RaunakColors.paper,
                                          ),
                                        ),
                                      ),
                                    ),
                                    SizedBox(width: 10),
                                    Sunburst(size: 58, rotation: .16),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                Row(
                                  children: [
                                    const _TicketIcon(
                                      icon: Icons.music_note_rounded,
                                    ),
                                    const SizedBox(width: 8),
                                    const _TicketIcon(
                                      icon: Icons.people_outline_rounded,
                                    ),
                                    const SizedBox(width: 8),
                                    const _TicketIcon(
                                      icon: Icons.auto_awesome_outlined,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: FittedBox(
                                        fit: BoxFit.scaleDown,
                                        alignment: Alignment.centerRight,
                                        child: Text(
                                          'A LITTLE MORE LIFE.',
                                          maxLines: 1,
                                          style: TextStyle(
                                            color: RaunakColors.paper
                                                .withValues(alpha: .75),
                                            fontSize: 8,
                                            letterSpacing: 1.4,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          SizedBox(
                            height: 12,
                            width: double.infinity,
                            child: CustomPaint(
                              painter: _PerforationPainter(
                                dark
                                    ? RaunakColors.darkPaper
                                    : RaunakColors.paper,
                              ),
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.fromLTRB(24, 10, 24, 17),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.confirmation_number_outlined,
                                  color: RaunakColors.coral,
                                  size: 19,
                                ),
                                SizedBox(width: 10),
                                Expanded(
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      'YOUR NEXT GOOD PLAN',
                                      maxLines: 1,
                                      style: TextStyle(
                                        fontSize: 9,
                                        letterSpacing: 1.8,
                                        fontWeight: FontWeight.w600,
                                        color: RaunakColors.paper,
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 8),
                                Text(
                                  '→',
                                  style: TextStyle(
                                    color: RaunakColors.coral,
                                    fontSize: 23,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 5,
                    left: 11,
                    child: Transform.rotate(
                      angle: -.2,
                      child: Container(
                        width: 71,
                        height: 71,
                        decoration: BoxDecoration(
                          color: RaunakColors.coral,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: RaunakColors.ink,
                            width: 1.2,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: RaunakColors.ink,
                              offset: Offset(2, 3),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Padding(
                          padding: EdgeInsets.all(9),
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'GO OUT.\nFEEL MORE.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: RaunakColors.ink,
                                height: 1.25,
                                fontSize: 9,
                                letterSpacing: .65,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TicketIcon extends StatelessWidget {
  const _TicketIcon({required this.icon});
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    width: 29,
    height: 29,
    decoration: BoxDecoration(
      border: Border.all(color: RaunakColors.paper.withValues(alpha: .28)),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Icon(icon, color: RaunakColors.paper, size: 15),
  );
}

class _PerforationPainter extends CustomPainter {
  const _PerforationPainter(this.background);
  final Color background;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = RaunakColors.paper.withValues(alpha: .28)
      ..strokeWidth = 1;
    for (double x = 12; x < size.width - 12; x += 8) {
      canvas.drawLine(Offset(x, 6), Offset(x + 3, 6), paint);
    }
    canvas.drawCircle(Offset(0, 6), 6, Paint()..color = background);
    canvas.drawCircle(Offset(size.width, 6), 6, Paint()..color = background);
  }

  @override
  bool shouldRepaint(_PerforationPainter oldDelegate) =>
      oldDelegate.background != background;
}
