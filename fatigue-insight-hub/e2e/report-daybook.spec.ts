import { test, expect } from '@playwright/test';

test('manual recent days produce a reviewable SMS export without a roster', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/report');
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.getByLabel('Home base (IATA)').fill('LGW');
  await expect(page.getByText(/^Europe\/London · UTC\+\d$/)).toBeVisible();
  await page.getByRole('button', { name: 'UTC (Z)', exact: true }).click();
  await page.getByLabel('What happened?').selectOption('fatigue_after_duty');
  await page.getByLabel(/^When did you call or feel fatigued\? \(/).fill('2026-09-09');
  await page.getByLabel('When did you call or feel fatigued?, time (24-hour)').fill('08:00');
  await page.getByText('Days included').click();
  await page.getByRole('button', { name: '3 days before', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Review Mon, 7 Sept' }).click();
  await page.getByRole('button', { name: 'Add duty', exact: true }).click();
  await expect(page.getByLabel('Report (UTC (Z))', { exact: true })).toHaveValue('2026-09-07');
  await expect(page.getByLabel('Report, time (24-hour)')).toHaveValue('08:00');
  await page.getByLabel('Activity').selectOption('ground');
  await page.getByLabel('Status', { exact: true }).selectOption('operated');
  await page.getByRole('button', { name: 'Review Tue, 8 Sept' }).click();
  await page.getByRole('button', { name: 'Add duty', exact: true }).click();
  await page.getByLabel('Report (UTC (Z))', { exact: true }).fill('2026-09-08');
  await page.getByLabel('Report, time (24-hour)').fill('22:00');
  // A release before the report blocks the step: Next stays on it and names the problem.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('[data-report-error]').first()).toBeVisible();
  await page.getByLabel('Release (off duty) (UTC (Z))', { exact: true }).fill('2026-09-09');
  await page.getByLabel('Release (off duty), time (24-hour)').fill('06:00');
  await page.getByLabel('Activity').selectOption('ground');
  await page.getByLabel('Status', { exact: true }).selectOption('operated');
  await page.getByRole('radio', { name: 'Duty affected by fatigue' }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('daybook-duties.png'), fullPage: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // No roster, so nothing is estimated: each night's sleep (23:00-07:00) and a 14:00 nap are added.
  for (const day of ['Mon, 7 Sept', 'Tue, 8 Sept']) {
    await page.getByRole('button', { name: `Review ${day}` }).click();
    await page.getByRole('button', { name: 'Sleep', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Review Tue, 8 Sept' }).click();
  await page.getByRole('button', { name: 'Nap', exact: true }).click();
  await expect(page.getByLabel('Sleep before the event')).toContainText('1h 00m');
  await expect(page.getByLabel('Sleep before the event')).toContainText('9h 00m');
  await page.getByLabel(/This diary includes every sleep and nap in the period/).check();
  // A correction invalidates the completeness acknowledgement until reviewed again.
  await page.getByLabel('Quality').first().selectOption('2');
  await expect(page.getByLabel(/This diary includes every sleep and nap in the period/)).not.toBeChecked();
  await page.getByLabel(/This diary includes every sleep and nap in the period/).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('daybook-sleep.png'), fullPage: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('textbox', { name: /^Your account/ }).fill('After the overnight duty I struggled to concentrate. I took a short nap before the duty, but my recovery felt insufficient. I informed the duty manager.');
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/fatigue-report') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Generate report', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  const report = await response.json();
  expect(report.duties).toHaveLength(2);
  expect(report.duties.every((duty: { status: string }) => duty.status === 'operated')).toBe(true);
  expect(report.data_quality.reported_sleeps).toBe(3);
  expect(report.data_quality.estimated_sleeps).toBe(0);
  await expect(page.getByRole('region', { name: 'Send to your operator' })).toBeVisible();
  await page.getByRole('button', { name: /^Preview summary/ }).click();
  await page.getByRole('button', { name: 'Hide summary' }).click();
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Blocked for test'); } } }); });
  await page.getByRole('button', { name: 'Copy full text' }).click();
  await expect(page.getByRole('alert')).toContainText('This browser blocked copying.');
  const fullText = await page.getByLabel('Report text', { exact: true }).inputValue();
  for (const part of ['I informed the duty manager.', 'PILOT STATEMENT', 'DUTIES', 'SLEEP BEFORE THE EVENT', 'DATA QUALITY AND LIMITATIONS']) {
    expect(fullText).toContain(part);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Text file', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('fatigue-report-LGW-2026-09-09.txt');
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sms-report.png'), fullPage: true });
  if (testInfo.project.name === 'desktop') await page.pdf({ path: testInfo.outputPath('sms-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  expect(errors).toEqual([]);
});

test('daylight landing stays readable with a saved dark workspace preference', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fatigue-theme', 'dark'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Know your roster/ })).toBeVisible();
  await expect(page.locator('.landing-daylight')).toHaveCSS('background-color', 'rgb(245, 245, 239)');
  // Scroll reveals are captured in their visible state, including reduced motion.
  await page.getByRole('link', { name: 'Explore a sample roster' }).click();
  await page.getByRole('heading', { name: 'Record how it went.' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('landing-daylight.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Log how a duty went', exact: true }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.locator('html')).toHaveClass(/dark/);
});
