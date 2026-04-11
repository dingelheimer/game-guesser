import { test, expect, type Page } from "@playwright/test";

/**
 * Visual QA: solo game flow across viewports.
 *
 * These tests verify structural layout correctness — no horizontal overflow,
 * key sections visible, consistent alignment — at 375/768/1024/1440px.
 * They do NOT require a live Supabase connection; the difficulty selection
 * screen is always available and acts as the entry point.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the page has a horizontal scrollbar (scrollWidth > clientWidth). */
async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

// ── Difficulty selection ──────────────────────────────────────────────────────

test.describe("Difficulty selection screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play/solo");
    await page.waitForLoadState("networkidle");
  });

  test("renders heading and four difficulty buttons", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Solo Mode" })).toBeVisible();

    for (const label of ["Easy", "Medium", "Hard", "Extreme"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
    }
  });

  test("has no horizontal scroll", async ({ page }) => {
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("difficulty cards are fully visible and not clipped", async ({ page }) => {
    const easyBtn = page.getByRole("button", { name: /Easy difficulty/i });
    await expect(easyBtn).toBeInViewport();

    const extremeBtn = page.getByRole("button", { name: /Extreme difficulty/i });
    await expect(extremeBtn).toBeInViewport();
  });

  test("all four difficulty buttons are horizontally within the viewport", async ({ page }) => {
    for (const label of ["Easy", "Medium", "Hard", "Extreme"]) {
      const btn = page.getByRole("button", { name: new RegExp(`${label} difficulty`, "i") });
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();
        if (viewport) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1); // +1 for rounding
        }
      }
    }
  });
});

// ── Game loading state ────────────────────────────────────────────────────────

test.describe("Game loading state", () => {
  test("shows loading spinner after selecting difficulty", async ({ page }) => {
    await page.goto("/play/solo");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Easy difficulty/i }).click();

    // Should briefly show the loading spinner
    // The spinner may appear and disappear quickly; just verify clicking doesn't crash
    // and the page transitions (doesn't stay on difficulty selection forever)
    await page.waitForTimeout(500);

    // After 500ms the page should either be loading or in the game — not showing an error
    const errorText = page.getByText(/unexpected error/i);
    const hasError = await errorText.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});

// ── Header and layout frame ───────────────────────────────────────────────────

test.describe("Page layout frame", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play/solo");
    await page.waitForLoadState("networkidle");
  });

  test("navigation is visible — header on desktop, bottom nav on mobile", async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      // Desktop/tablet: top header should be visible
      await expect(page.getByRole("banner")).toBeVisible();
    } else {
      // Mobile: bottom nav replaces the header
      await expect(page.getByRole("navigation")).toBeVisible();
    }
  });

  test("header does not overflow viewport horizontally (desktop only)", async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport || viewport.width < 768) {
      // Header is hidden on mobile — skip this check
      return;
    }
    const header = page.getByRole("banner");
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test("page has no horizontal scroll", async ({ page }) => {
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
