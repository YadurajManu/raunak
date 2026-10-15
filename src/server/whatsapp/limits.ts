export function warmupCap(
  start: Date | null,
  maximum = 400,
  override?: number | null,
  now = Date.now(),
) {
  const day = Math.max(
    1,
    Math.floor((now - (start?.getTime() || now)) / 86400000) + 1,
  );
  return {
    day,
    cap: Math.min(
      override || maximum,
      day <= 2
        ? 30
        : day <= 4
          ? 60
          : day <= 7
            ? 120
            : day <= 14
              ? 250
              : maximum,
    ),
  };
}
