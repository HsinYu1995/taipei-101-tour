import { test, expect } from '@playwright/test';
import { en } from '../src/content/en';
import { CHAPTERS } from '../src/tour/chapters';
import { getTour, openTour, scrollToProgress, stopCenter, travelCenter } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

test('each stop has a clickable hotspot', async ({ page }) => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const { id } = CHAPTERS[i].hotspot;
    await scrollToProgress(page, stopCenter(i));
    await page.getByTestId(`hotspot-${id}`).click();
    await expect(page.getByTestId('hotspot-panel')).toContainText(en.hotspots[id].title);
    expect((await getTour(page)).activeHotspot).toBe(id);
    await page.getByTestId('hotspot-close').click();
    await expect(page.getByTestId('hotspot-panel')).toBeHidden();
  }
});

test('hotspot hidden during travel', async ({ page }) => {
  await scrollToProgress(page, travelCenter(2));
  await expect(page.locator('[data-testid^="hotspot-"]')).toHaveCount(0);
});

test('escape closes panel', async ({ page }) => {
  await scrollToProgress(page, stopCenter(1));
  await page.getByTestId(`hotspot-${CHAPTERS[1].hotspot.id}`).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hotspot-panel')).toBeHidden();
  expect((await getTour(page)).activeHotspot).toBeNull();
});

test('escape closes the panel before leaving explore', async ({ page }) => {
  await scrollToProgress(page, stopCenter(1));
  await page.getByTestId('explore-button').click();
  await page.getByTestId(`hotspot-${CHAPTERS[1].hotspot.id}`).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hotspot-panel')).toBeHidden();
  expect((await getTour(page)).mode).toBe('explore');
});

test('scrolling away closes panel', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  await page.getByTestId(`hotspot-${CHAPTERS[0].hotspot.id}`).click();
  await scrollToProgress(page, stopCenter(1));
  await expect(page.getByTestId('hotspot-panel')).toBeHidden();
});

test('hotspots are keyboard focusable buttons', async ({ page }) => {
  await scrollToProgress(page, stopCenter(2));
  const hotspot = page.getByTestId(`hotspot-${CHAPTERS[2].hotspot.id}`);
  await expect(hotspot).toHaveRole('button');
  await hotspot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hotspot-panel')).toBeVisible();
});
