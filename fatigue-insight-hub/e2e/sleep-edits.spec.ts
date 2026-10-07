import { test, expect } from '@playwright/test';

// Synthetic roster: a 22:00 night departure, so the model assumes a pre-duty nap.
const csv = 'Date,Flight,Departure,Arrival,STD,STA,Report,Release\n2026-09-05,TEST1,DOH,DMM,23:00,00:15,22:00,03:00\n2026-09-08,TEST2,DOH,FCO,08:00,13:00,07:00,15:00\n';

test('the pilot sees why a nap is assumed and can remove it, then undo', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/roster');
  await page.getByLabel('Choose roster file (PDF or CSV)').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByLabel('Home base', { exact: true }).fill('DOH');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse roster', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your fatigue outlook' })).toBeVisible();
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Roster calendar', exact: true });
  await calendar.getByRole('button', { name: 'Open duty on Sat 5 Sep: TEST1', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Duty details, Sat 5 Sep 2026' });
  const sleep = dialog.getByRole('list', { name: 'Estimated sleep before this duty' });
  await expect(sleep).toContainText('Nap · assumed');

  // Why the nap is there, with its published basis and assumption rating.
  await sleep.getByRole('button', { name: /^Why this nap/ }).click();
  const why = page.getByRole('dialog').filter({ hasText: 'Why this nap' });
  await expect(why).toContainText('54 % of 52 long-haul pilots');
  await expect(why).toContainText('Signal et al. 2014');
  await expect(why).toContainText('Assumption rating');
  await expect(why).toContainText('not a calibrated probability');
  await page.screenshot({ path: testInfo.outputPath('why-nap.png'), fullPage: false });

  // "I don't nap here" removes it and recalculates; Undo restores it.
  await why.getByRole('button', { name: 'I don’t nap here' }).click();
  await expect(sleep).toContainText('Assumed nap removed');
  await expect(sleep).not.toContainText('Nap · assumed');
  await expect(dialog).toContainText('You removed the assumed nap');
  await page.screenshot({ path: testInfo.outputPath('nap-removed.png'), fullPage: false });
  await sleep.getByRole('button', { name: 'Undo' }).click();
  await expect(sleep).toContainText('Nap · assumed');
  expect(errors).toEqual([]);
});

test('the pilot states a usual night and the roster is recalculated with it', async ({ page }) => {
  await page.goto('/roster');
  await page.getByLabel('Choose roster file (PDF or CSV)').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByLabel('Home base', { exact: true }).fill('DOH');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse roster', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your fatigue outlook' })).toBeVisible();
  await expect(page.getByText('23:00–07:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByLabel('Bedtime (24-hour)').fill('00:00');
  await page.getByLabel('Wake-up (24-hour)').fill('06:00');
  await page.getByRole('radio', { name: 'Rarely' }).click();
  await page.getByRole('button', { name: 'Save and recalculate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  // The analysis now states the pilot's night, and no assumed nap appears.
  await expect(page.getByText('00:00–06:00', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  await page.getByRole('region', { name: 'Roster calendar', exact: true })
    .getByRole('button', { name: 'Open duty on Sat 5 Sep: TEST1', exact: true }).click();
  const sleep = page.getByRole('dialog', { name: 'Duty details, Sat 5 Sep 2026' }).getByRole('list', { name: 'Estimated sleep before this duty' });
  await expect(sleep).toContainText('00:00–06:00');
  await expect(sleep).not.toContainText('Nap · assumed');
});
