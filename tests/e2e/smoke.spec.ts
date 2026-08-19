import { test, expect } from "@playwright/test";

test("application boots", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /application scaffold is running/i })).toBeVisible();
});
