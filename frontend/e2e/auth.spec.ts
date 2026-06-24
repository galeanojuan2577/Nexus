import { test, expect } from "@playwright/test"

test("can register, login, and create a device", async ({ page }) => {
  await page.goto("/register")

  // Register
  await page.fill('input[type="email"]', "demo@example.com")
  await page.fill('input[placeholder="Name"]', "Demo User")
  await page.fill('input[placeholder="Password"]', "password123")
  await page.fill('input[placeholder="Confirm Password"]', "password123")
  await page.click('button[type="submit"]')

  // Should redirect to dashboard
  await expect(page).toHaveURL("/")
  await expect(page.locator("text=Dashboard")).toBeVisible()

  // Navigate to devices
  await page.click("text=Devices")
  await expect(page).toHaveURL("/devices")

  // Create a device
  await page.click("text=Add Device")
  await page.fill('input[placeholder="Web Server"]', "Test Server")
  await page.fill('input[placeholder="example.com"]', "example.com")
  await page.click('button:has-text("Create")')

  // Device should appear
  await expect(page.locator("text=Test Server")).toBeVisible({ timeout: 5000 })
})

test("login page works", async ({ page }) => {
  await page.goto("/login")
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
})

test("redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/devices")
  await expect(page).toHaveURL("/login")
})
