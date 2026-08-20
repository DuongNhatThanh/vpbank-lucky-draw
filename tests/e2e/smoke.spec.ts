import { expect, test } from "@playwright/test";

test("operator setup flow boots and prepares the live draw", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /operator setup/i })).toBeVisible();

  await page.getByRole("button", { name: /load default roster/i }).click();
  await expect(page.getByText(/80 valid ready/i)).toBeVisible();

  await page.getByRole("button", { name: /apply participants/i }).click();
  await expect(page.getByRole("button", { name: /continue to live draw/i })).toBeVisible();

  await page.getByRole("button", { name: /continue to live draw/i }).click();
  await expect(page.getByText(/ready to begin the live draw/i)).toBeVisible();
});
