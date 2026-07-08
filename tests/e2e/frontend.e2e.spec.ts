import { test, expect } from "@playwright/test";

test.describe("Frontend", () => {
  test("can go on homepage", async ({ page }) => {
    await page.goto("http://localhost:3000");

    await expect(page).toHaveTitle(/PromiseTracker/i);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
