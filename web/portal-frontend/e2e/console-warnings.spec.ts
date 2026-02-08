import { expect, test } from '@playwright/test';

test('does not log table alignment deprecation warnings', async ({ page }) => {
  const warnings: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      warnings.push(message.text());
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  const deprecatedWarnings = warnings.filter((text) =>
    text.includes('column.align') || text.includes('Physical values'),
  );

  expect(deprecatedWarnings).toEqual([]);
});
