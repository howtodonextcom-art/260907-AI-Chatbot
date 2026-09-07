import { test, expect } from "@playwright/test";

test("smoke: home and workspaces flow with dev auth", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Decision Lab" })).toBeVisible();
  await page.getByRole("link", { name: "Mở Workspace" }).click();
  await page.goto("/login");
  await page.getByRole("button", { name: /Dev Auth Bypass|Google/i }).click();
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible({
    timeout: 15000,
  });
});
