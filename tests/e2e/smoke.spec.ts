import { expect, test } from "@playwright/test";

test("operator live flow confirms the first prize and advances", async ({ page }) => {
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
  await expect(page.locator(".winner-summary__code")).toHaveText(/^\d{4}$/);
  await expect(page.getByRole("button", { name: /complete reveal/i })).toBeVisible();

  await page.getByRole("button", { name: /complete reveal/i }).click();
  await expect(page.getByRole("button", { name: /confirm winner/i })).toBeVisible();

  await page.getByRole("button", { name: /confirm winner/i }).click();
  await expect(page.locator(".metric").filter({ hasText: "Confirmed" }).locator(".metric__value")).toHaveText("1");
  await expect(page.getByRole("button", { name: /next prize/i })).toBeVisible();

  await page.getByRole("button", { name: /next prize/i }).click();
  await expect(page.getByRole("heading", { name: /^Prize 2$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /start draw/i })).toBeVisible();
});
