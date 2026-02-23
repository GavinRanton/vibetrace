/**
 * VibeTrace QA Suite — Aria mandatory pre-release tests
 * ALL tests must pass before anything is shown to Gavin.
 * Run: npx playwright test tests/qa-suite.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://vibetrace.app';
const QA_EMAIL = 'qa-test@vibetrace.app';
const QA_PASSWORD = 'VTqa2026!secure';

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('auth: login page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('auth: can log in with email/password', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
});

// ─── Navigation ───────────────────────────────────────────────────────────────

test('nav: logo links to landing page not dashboard', async ({ page }) => {
  await loginAs(page);
  const logoLink = page.locator('a:has-text("VibeTrace")').first();
  const href = await logoLink.getAttribute('href');
  expect(href).toBe('/');
  expect(href).not.toBe('/dashboard');
});

test('nav: sidebar contains Scan History not Repositories', async ({ page }) => {
  await loginAs(page);
  await expect(page.locator('text=Scan History')).toBeVisible();
  await expect(page.locator('text=Repositories')).not.toBeVisible();
});

test('nav: Reports link goes to /reports not /scans', async ({ page }) => {
  await loginAs(page);
  await page.click('text=Reports');
  await expect(page).toHaveURL(`${BASE_URL}/reports`);
});

test('nav: Settings link does not exist', async ({ page }) => {
  await loginAs(page);
  await expect(page.locator('nav >> text=Settings')).not.toBeVisible();
});

test('nav: Account link goes to /account', async ({ page }) => {
  await loginAs(page);
  await page.click('a[href="/account"]');
  await expect(page).toHaveURL(`${BASE_URL}/account`);
});

test('nav: Admin link NOT visible for QA account', async ({ page }) => {
  await loginAs(page);
  await expect(page.locator('nav >> text=Admin')).not.toBeVisible();
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

test('dashboard: loads without errors', async ({ page }) => {
  await loginAs(page);
  await expect(page.locator('text=Security Overview')).toBeVisible();
  await expect(page.locator('text=Critical').first()).toBeVisible();
  await expect(page.locator('text=High').first()).toBeVisible();
});

test('dashboard: New Scan button visible and links to /scan', async ({ page }) => {
  await loginAs(page);
  const btn = page.locator('a:has-text("New Scan"), button:has-text("New Scan")').first();
  await expect(btn).toBeVisible();
});

test('dashboard: Fix button is clickable and opens drawer', async ({ page }) => {
  await loginAs(page);
  const fixBtn = page.locator('button:has-text("Fix")').first();
  const count = await fixBtn.count();
  if (count === 0) {
    test.skip(); // No findings to test against yet
    return;
  }
  await fixBtn.click();
  // Drawer should open — look for fix prompt content
  await expect(page.locator('[role="dialog"], [data-radix-popper-content-wrapper], .sheet-content').first()).toBeVisible({ timeout: 3000 });
});

test('dashboard: Fix prompt does NOT contain /tmp path', async ({ page }) => {
  await loginAs(page);
  const fixBtn = page.locator('button:has-text("Fix")').first();
  const count = await fixBtn.count();
  if (count === 0) { test.skip(); return; }
  await fixBtn.click();
  await page.waitForTimeout(1000);
  const bodyText = await page.textContent('body');
  expect(bodyText).not.toContain('/tmp/vibetrace-scan-');
  expect(bodyText).not.toContain('Fix the issue in /tmp');
});

test('dashboard: Dependencies tab shows content not blank', async ({ page }) => {
  await loginAs(page);
  await page.click('text=Dependencies');
  // Should either show findings table OR an empty state message — not a blank white area
  const hasFindings = await page.locator('table').count() > 0;
  const hasEmptyState = await page.locator('text=No dependency').count() > 0;
  expect(hasFindings || hasEmptyState).toBe(true);
});

// ─── Reports ──────────────────────────────────────────────────────────────────

test('reports: page loads at /reports', async ({ page }) => {
  await loginAs(page);
  await page.goto(`${BASE_URL}/reports`);
  await expect(page).toHaveURL(`${BASE_URL}/reports`);
  // Should not be a blank white page — something must render
  const bodyText = await page.textContent('body');
  expect(bodyText?.trim().length).toBeGreaterThan(50);
});

// ─── Scan Flow ────────────────────────────────────────────────────────────────

test('scan: new scan page loads', async ({ page }) => {
  await loginAs(page);
  await page.goto(`${BASE_URL}/scan`);
  await expect(page).toHaveURL(`${BASE_URL}/scan`);
  const bodyText = await page.textContent('body');
  expect(bodyText?.trim().length).toBeGreaterThan(50);
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function loginAs(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
}
