import { test, expect } from "@playwright/test"

test.describe("Dashboard", () => {
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL("/login")
  })

  test("login page has all expected elements", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
    await expect(page.locator('a[href="/register"]')).toBeVisible()
  })
})
