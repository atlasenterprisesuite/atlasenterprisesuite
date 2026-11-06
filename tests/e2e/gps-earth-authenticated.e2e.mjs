import { test, expect } from '@playwright/test';

const expectedSha = process.env.ATLAS_E2E_EXPECTED_SHA;
const userEmail = process.env.ATLAS_E2E_EMAIL;
const userPassword = process.env.ATLAS_E2E_PASSWORD;

async function openVerifiedGps(page) {
  // Check deployment identity BEFORE filling credentials.
  const response = await page.goto('/gps', { waitUntil: 'domcontentloaded' });
  expect(response, 'P0: /gps did not return an HTTP response').not.toBeNull();
  expect(response.status(), 'P0: /gps must respond HTTP 200').toBe(200);
  const headers = await response.allHeaders();
  expect(headers['x-atlas-version-id'], 'P0: deployment version id mismatch').toBe(expectedSha);
  expect(headers['x-atlas-version-tag'], 'P0: deployment version tag mismatch').toBe(expectedSha);
}

const googleName = /Abrir punto seleccionado en Google Maps/;
const appleName = /Abrir punto seleccionado en Apple Maps/;

test('denies an unauthenticated shared GPS URL', async ({ page }) => {
  await openVerifiedGps(page);
  await expect(page).toHaveURL(/\/identity\?app=/);
  await expect(page.getByRole('heading', { name: 'ATLAS Identity' })).toBeVisible();
  await expect(page.getByRole('link', { name: googleName })).toHaveCount(0);
});

test('authenticates through ATLAS Identity and verifies actual GPS outbound navigation', async ({ page, context }) => {
  await openVerifiedGps(page);
  await expect(page.getByRole('heading', { name: 'ATLAS Identity' })).toBeVisible();

  // Use an authorized dedicated test identity. Never log credentials or enable traces.
  await page.getByLabel('Email').fill(userEmail);
  await page.getByLabel('Password').fill(userPassword);
  await page.getByRole('button', { name: 'Sign in to ATLAS' }).click();
  await expect(page.getByRole('heading', { name: 'Navigation & Spatial Intelligence' })).toBeVisible();

  await expect(page.getByRole('link', { name: googleName })).toHaveCount(0);
  await expect(page.getByRole('link', { name: appleName })).toHaveCount(0);

  // A shared destination is intentional user selection, unlike absent URL parameters.
  await page.goto('/gps?lat=48.8566&lon=2.3522');
  const google = page.getByRole('link', { name: googleName });
  const apple = page.getByRole('link', { name: appleName });
  await expect(google).toBeVisible();
  await expect(apple).toBeVisible();
  const googleUrl = new URL(await google.getAttribute('href'));
  const appleUrl = new URL(await apple.getAttribute('href'));
  expect(googleUrl.origin).toBe('https://www.google.com');
  expect(googleUrl.searchParams.get('query')).toBe('48.8566,2.3522');
  expect(appleUrl.origin).toBe('https://maps.apple.com');
  expect(appleUrl.searchParams.get('ll')).toBe('48.8566,2.3522');
  await expect(page.locator('#gps4d-external-provider-privacy')).toContainText('compartirás las coordenadas');
  for (const link of [google, apple]) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(link).toHaveAttribute('aria-describedby', 'gps4d-external-provider-privacy');
  }

  // Test popup navigation without transmitting fixture coordinates to providers.
  await context.route('https://www.google.com/**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<html><title>Provider test stub</title></html>'
  }));
  await context.route('https://maps.apple.com/**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<html><title>Provider test stub</title></html>'
  }));
  for (const [link, origin] of [[google, 'https://www.google.com'], [apple, 'https://maps.apple.com']]) {
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    await popup.waitForURL(url => url.origin === origin);
    await popup.close();
  }

  for (const bad of ['/gps', '/gps?lat=&lon=0', '/gps?lat=91&lon=0']) {
    await page.goto(bad);
    await expect(page.getByRole('link', { name: googleName })).toHaveCount(0);
    await expect(page.getByRole('link', { name: appleName })).toHaveCount(0);
  }

  await page.goto('/gps?lat=0&lon=0');
  await expect(page.getByRole('link', { name: googleName })).toBeVisible();
  const zero = new URL(await page.getByRole('link', { name: googleName }).getAttribute('href'));
  expect(zero.searchParams.get('query')).toBe('0,0');
});
