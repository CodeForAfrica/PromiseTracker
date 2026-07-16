import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Security headers", () => {
  test("responses carry the CSP and baseline security headers", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    expect(response).not.toBeNull();
    const headers = response!.headers();

    const csp = headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-src 'self' https://airtable.com");
    expect(csp).toContain("form-action 'self' https://*.list-manage.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });
});

test.describe("Promise update dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dev/update-dialog`);
  });

  test("renders as a labelled modal with a sandboxed allowlisted iframe", async ({
    page,
  }) => {
    await page.getByTestId("open-update-dialog").click();

    const dialog = page.getByRole("dialog", {
      name: "Submit a promise update",
    });
    await expect(dialog).toBeVisible();

    const iframe = dialog.locator("iframe");
    await expect(iframe).toHaveAttribute("src", /^https:\/\/airtable\.com\//);
    await expect(iframe).toHaveAttribute("sandbox", /allow-scripts/);
    await expect(iframe).toHaveAttribute("sandbox", /allow-forms/);
    // No capability beyond the documented minimum.
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).not.toContain("allow-top-navigation");
    expect(sandbox).not.toContain("allow-downloads");
    await expect(iframe).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
  });

  test("traps focus, closes on Escape, and restores focus to the trigger", async ({
    page,
  }) => {
    const trigger = page.getByTestId("open-update-dialog");
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Focus moves into the dialog when it opens.
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);

    // Tabbing repeatedly must not leak focus out of the modal.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }

    // Escape closes the dialog and focus returns to the trigger.
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("close button is reachable and labelled for screen readers", async ({
    page,
  }) => {
    await page.getByTestId("open-update-dialog").click();
    const dialog = page.getByRole("dialog");
    const closeButton = dialog.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test("refuses to render an embed that is not on the allowlist", async ({
    page,
  }) => {
    await page.getByTestId("open-blocked-dialog").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
