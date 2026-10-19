import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`theme reveal covers the viewport and persists at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({
      reducedMotion: "no-preference",
      colorScheme: "dark",
    });
    await page.goto("/login");
    await page.evaluate(() => document.fonts.ready);
    const toggle = page
      .getByRole("button", { name: "Switch to light mode" })
      .first();
    const rect = await toggle.boundingBox();
    expect(rect).not.toBeNull();
    await expect(toggle.locator(".theme-eclipse-shadow")).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 4, -4)",
    );
    await page.screenshot({
      path: `artifacts/theme-reveal/before-${width}.png`,
    });
    await toggle.click();
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .some(
          (a) =>
            (a.effect as KeyframeEffect)?.pseudoElement ===
            "::view-transition-new(root)",
        ),
    );
    const reveal = await page.evaluate(() => {
      const animation = document
        .getAnimations()
        .find(
          (a) =>
            (a.effect as KeyframeEffect)?.pseudoElement ===
            "::view-transition-new(root)",
        )!;
      animation.pause();
      animation.currentTime = 140;
      const effect = animation.effect as KeyframeEffect;
      const frames = effect.getKeyframes();
      // Programmatic clicks bypass the snapshot's pointer shield and test the lock.
      document.querySelector<HTMLButtonElement>(".gnav-theme")!.click();
      return {
        frames,
        timing: effect.getTiming(),
        theme: document.documentElement.dataset.marketingTheme,
        scrollY,
        crossfade: getComputedStyle(
          document.documentElement,
          "::view-transition-new(root)",
        ).animationName,
      };
    });
    expect(reveal.theme).toBe("light");
    expect(reveal.crossfade).toBe("none");
    expect(reveal.timing.duration).toBe(650);
    expect(reveal.timing.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    const x = rect!.x + rect!.width / 2,
      y = rect!.y + rect!.height / 2;
    const start = String(reveal.frames[0].clipPath)
      .match(/[\d.]+/g)!
      .map(Number);
    expect(start[0]).toBe(0);
    expect(start[1]).toBeCloseTo(x, 1);
    expect(start[2]).toBeCloseTo(y, 1);
    const radius = Math.ceil(
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, 900 - y),
        Math.hypot(width - x, 900 - y),
      ),
    );
    const end = String(reveal.frames[1].clipPath)
      .match(/[\d.]+/g)!
      .map(Number);
    expect(end[0]).toBe(radius);
    expect(end[1]).toBeCloseTo(x, 1);
    expect(end[2]).toBeCloseTo(y, 1);
    await page.screenshot({
      path: `artifacts/theme-reveal/during-${width}.png`,
    });
    await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (a) =>
            (a.effect as KeyframeEffect)?.pseudoElement ===
            "::view-transition-new(root)",
        )
        .forEach((a) => a.play()),
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme-revealing",
    );
    await expect(page.locator(".theme-eclipse-shadow").first()).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 16, -16)",
    );
    expect(await page.evaluate(() => scrollY)).toBe(reveal.scrollY);
    await page.screenshot({
      path: `artifacts/theme-reveal/after-${width}.png`,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Switch to dark mode" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Switch to dark mode" }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute(
      "data-marketing-theme",
      "dark",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme-revealing",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("raunak-theme")),
    ).toBe("dark");
  });
}

test("reveal preserves a scrolled page and navigation alignment", async ({
  page,
}) => {
  await page.emulateMedia({
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  await page.goto("/terms");
  const toggle = page.getByRole("button", { name: "Switch to light mode" }).first();
  await expect(toggle).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(400);
  const before = await toggle.boundingBox();
  expect(before).not.toBeNull();
  // Locator.click scrolls sticky controls into scroll-padding; use the visible
  // button's real pointer coordinates to measure user-initiated scrolling only.
  await page.mouse.click(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-marketing-theme",
    "light",
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-theme-revealing",
  );
  expect(await page.evaluate(() => scrollY)).toBe(400);
  expect(
    await page
      .getByRole("button", { name: "Switch to dark mode" })
      .first()
      .boundingBox(),
  ).toEqual(before);
});

for (const fallback of [
  "reduced-motion",
  "unsupported",
  "failed-transition",
] as const) {
  test(`theme switch falls back cleanly: ${fallback}`, async ({ page }) => {
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: fallback === "reduced-motion" ? "reduce" : "no-preference",
    });
    await page.addInitScript((mode) => {
      if (mode === "unsupported")
        Object.defineProperty(document, "startViewTransition", {
          value: undefined,
        });
      if (mode === "failed-transition")
        document.startViewTransition = () => {
          throw new Error("Transition unavailable");
        };
    }, fallback);
    await page.goto("/login");
    await page.getByRole("button", { name: "Switch to light mode" }).first().click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-marketing-theme",
      "light",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme-revealing",
    );
    await page.getByRole("button", { name: "Switch to dark mode" }).first().click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-marketing-theme",
      "dark",
    );
  });
}
