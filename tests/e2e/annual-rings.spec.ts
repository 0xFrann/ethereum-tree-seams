import { expect, test, type Page } from '@playwright/test';

const marketData = {
  schemaVersion: 1,
  refreshedAt: '2026-08-24T17:00:00.000Z',
  chronology: { origin: '2015-07-30', marketDataFrom: '2024-01-01' },
  source: {
    provider: 'Test provider',
    market: 'Bitstamp ETH/USD',
    cutoff: '2024-02-29',
    observedRows: 60,
    gaps: [],
  },
  years: [
    {
      year: 2024,
      firstDate: '2024-01-01',
      lastDate: '2024-02-29',
      startProgress: 0,
      progress: 0.16,
      annual: { open: 2200, close: 3400, high: 3500, low: 2100, volumeUsd: 2_000_000 },
      months: [
        {
          month: 0,
          open: 2200,
          close: 2300,
          high: 2400,
          low: 2100,
          volumeUsd: 900_000,
          priceShape: -1,
          volumeWeight: 0.4,
        },
        {
          month: 1,
          open: 2300,
          close: 3400,
          high: 3500,
          low: 2200,
          volumeUsd: 1_100_000,
          priceShape: 1,
          volumeWeight: 0.8,
        },
      ],
    },
  ],
  milestones: [
    {
      id: 'dencun',
      date: '2024-03-13',
      name: 'Dencun',
      summary: 'Blob transactions changed rollup data availability.',
      category: 'scaling',
      activation: 'epoch 269,568',
      sourceUrl: 'https://ethereum.org/',
    },
  ],
  scars: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/market-data', (route) => route.fulfill({ json: marketData }));
  await page.goto('/');
});

test('offers keyboard periods and a semantic event detail', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Enter the rings' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  const canvas = page.getByLabel(/Annual rings graph/);
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Selected market period')).toContainText('Jan 2024');

  await page.getByRole('button', { name: 'Dencun' }).click();
  await expect(page.getByRole('complementary')).toContainText(
    'Blob transactions changed rollup data availability.',
  );
  await expect(page.getByRole('link', { name: 'Read the source' })).toHaveAttribute(
    'href',
    'https://ethereum.org/',
  );
  await assertMacVisualBaseline(page, 'annual-rings-desktop.png');
});

test.describe('on a compact viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the graph and semantic controls available', async ({ page }) => {
    await page.getByRole('button', { name: 'Enter the rings' }).click();
    await expect(page.getByLabel(/Annual rings graph/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jan' })).toBeVisible();
    await assertMacVisualBaseline(page, 'annual-rings-mobile.png');
  });
});

async function assertMacVisualBaseline(page: Page, name: string): Promise<void> {
  if (process.platform !== 'darwin') return;
  await expect(page).toHaveScreenshot(name, { animations: 'disabled', fullPage: true });
}
