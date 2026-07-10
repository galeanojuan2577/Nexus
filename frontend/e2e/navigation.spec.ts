import { test, expect } from "@playwright/test"

test.describe("Navigation and routing", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/devices")
    await expect(page).toHaveURL("/login")
  })

  test("redirects unauthenticated from dashboard", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL("/login")
  })

  test("redirects unauthenticated from scans", async ({ page }) => {
    await page.goto("/scans")
    await expect(page).toHaveURL("/login")
  })

  test("redirects unauthenticated from alerts", async ({ page }) => {
    await page.goto("/alerts")
    await expect(page).toHaveURL("/login")
  })

  test("redirects unauthenticated from AI chat", async ({ page }) => {
    await page.goto("/ai")
    await expect(page).toHaveURL("/login")
  })

  test("redirects unauthenticated from webhooks", async ({ page }) => {
    await page.goto("/webhooks")
    await expect(page).toHaveURL("/login")
  })

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator('a[href="/register"]')).toBeVisible()
  })

  test("register page has link to login", async ({ page }) => {
    await page.goto("/register")
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
})
