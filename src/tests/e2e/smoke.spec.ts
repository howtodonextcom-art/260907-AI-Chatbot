import { test, expect } from "@playwright/test";

test("smoke: home and workspaces flow with dev auth", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Decision Lab" })).toBeVisible();
  await page.getByRole("link", { name: "Mở Workspace" }).click();
  await page.goto("/login");
  const bypass = page.getByRole("button", { name: /Dev Auth Bypass/i });
  if (await bypass.count()) {
    await bypass.click();
  } else {
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
    test.skip(true, "Connected mode requires email/password credentials");
  }
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible({
    timeout: 15000,
  });
});
