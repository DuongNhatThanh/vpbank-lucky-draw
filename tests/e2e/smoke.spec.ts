import { expect, test } from "@playwright/test";

test("operator live flow reveals the first winner in presentation and advances", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /operator setup/i })).toBeVisible();

  await page.getByRole("button", { name: /load default roster/i }).click();
  await expect(page.getByText(/80 valid ready/i)).toBeVisible();

  await page.getByRole("button", { name: /apply participants/i }).click();
  await expect(page.getByRole("button", { name: /continue to live draw/i })).toBeVisible();

  await page.getByRole("button", { name: /continue to live draw/i }).click();
  await expect(page.getByText(/ready to begin the live draw/i)).toBeVisible();

  await page.getByRole("button", { name: /start draw/i }).click();
  await expect(page.getByRole("button", { name: /complete countdown/i })).toBeVisible();

  await page.getByRole("button", { name: /complete countdown/i }).click();
  await expect(page.getByRole("button", { name: /select winner/i })).toBeVisible();

  await page.getByRole("button", { name: /select winner/i }).click();
  const operatorWinnerCode = await page.locator(".winner-summary__code").textContent();
  expect(operatorWinnerCode).toMatch(/^\d{4}$/);

  await page.getByRole("button", { name: /open presentation/i }).click();
  await expect(page.getByRole("button", { name: /return to operator/i })).toBeVisible();
  await expect(page.locator('[data-testid="presentation-digit"]')).toHaveCount(4);
  await expect(page.locator('[data-testid="presentation-digit"]')).toHaveText(operatorWinnerCode!.split(""));
  await expect(page.getByText(/awaiting winner confirmation/i)).toBeVisible();

  await page.getByRole("button", { name: /return to operator/i }).click();
  await expect(page.getByRole("button", { name: /confirm winner/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /complete reveal/i })).toHaveCount(0);

  await page.getByRole("button", { name: /confirm winner/i }).click();
  await expect(page.locator(".metric").filter({ hasText: "Confirmed" }).locator(".metric__value")).toHaveText("1");
  await expect(page.getByRole("button", { name: /next prize/i })).toBeVisible();

  await page.getByRole("button", { name: /next prize/i }).click();
  await expect(page.getByRole("heading", { name: /^Prize 2$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /start draw/i })).toBeVisible();
});
