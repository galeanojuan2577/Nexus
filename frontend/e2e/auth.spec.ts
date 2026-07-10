import { test, expect } from "@playwright/test"

test("login page works", async ({ page }) => {
  await page.goto("/login")
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
})

test("register page works", async ({ page }) => {
  await page.goto("/register")
  await expect(page.locator('input[placeholder="Your name"]')).toBeVisible()
  await expect(page.locator('button:has-text("Create account")')).toBeVisible()
})

test("redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/devices")
  await expect(page).toHaveURL("/login")
})
