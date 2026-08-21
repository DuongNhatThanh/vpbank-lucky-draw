import { expect, test } from "@playwright/test";

test("presentation live flow reveals the first winner and advances", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /operator setup/i })).toBeVisible();

  await page.getByRole("button", { name: /load default roster/i }).click();
  await expect(page.getByText(/80 valid ready/i)).toBeVisible();

  await page.getByRole("button", { name: /apply participants/i }).click();
  await expect(page.getByRole("button", { name: /continue to live draw/i })).toBeVisible();

  await page.getByRole("button", { name: /continue to live draw/i }).click();
  await expect(page.getByText(/ready to begin the live draw/i)).toBeVisible();

  await page.getByRole("button", { name: /open presentation/i }).click();
  await expect(page.getByRole("button", { name: /return to operator/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sound on/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /start draw/i })).toBeVisible();

  // Phase 10B.1: one click drives countdown -> drawing -> selection -> reveal.
  // Reduced motion intentionally compresses the transient countdown/drawing phases,
  // so the E2E must not require "Countdown running..." to remain visible.
  await page.getByRole("button", { name: /start draw/i }).click();

  await expect(page.getByRole("button", { name: /complete countdown/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /select winner/i })).toHaveCount(0);

  const winnerReveal = page.locator(".winner-reveal__code");
  await expect(winnerReveal).toBeVisible();

  const presentationWinnerCode = await winnerReveal.textContent();
  expect(presentationWinnerCode).toMatch(/^\d{4}$/);

  await expect(page.locator('[data-testid="presentation-digit"]')).toHaveCount(4);
  await expect(page.locator('[data-testid="presentation-digit"]')).toHaveText(presentationWinnerCode!.split(""));
  await expect(page.getByText(/waiting for confirmation/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /confirm winner/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /mark absent/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /complete reveal/i })).toHaveCount(0);

  await page.getByRole("button", { name: /confirm winner/i }).click();
  await expect(page.getByText(/winner confirmed/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /next prize/i })).toBeVisible();

  const confirmedAttemptCount = await page.evaluate(() => {
    const raw = window.localStorage.getItem("vpbank-lucky-draw:event-state");
    if (!raw) {
      return 0;
    }

    const envelope = JSON.parse(raw) as { state?: { attempts?: Array<{ status?: string }> } };
    return envelope.state?.attempts?.filter((attempt) => attempt.status === "confirmed").length ?? 0;
  });
  expect(confirmedAttemptCount).toBe(1);

  await page.getByRole("button", { name: /next prize/i }).click();
  await expect(page.getByRole("heading", { name: /^Prize 2$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /start draw/i })).toBeVisible();
});