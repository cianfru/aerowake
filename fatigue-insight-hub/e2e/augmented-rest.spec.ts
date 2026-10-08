import { test, expect } from '@playwright/test';

// Synthetic date-line sector: 18 hours airborne, 19-hour FDP, 30 minutes post-flight.
// All duty clocks are home-base time; sector clocks use the airport's local zone.
const csv = 'Date,Flight,Departure,Arrival,STD,STA,Report,Release,DepartureDate,ArrivalDate\n'
  + '2026-10-05,TESTULR,DOH,AKL,08:00,12:00,07:00,02:30,2026-10-05,2026-10-06\n';

test('ULR assumptions render and a different rest facility updates the assessment', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/roster');
  await page.getByLabel('Choose roster file (PDF or CSV)').setInputFiles({ name: 'synthetic-ulr.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByLabel('Home base', { exact: true }).fill('DOH');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse roster', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your fatigue outlook' })).toBeVisible();
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Roster calendar', exact: true });
  if (testInfo.project.name === 'mobile') {
    await calendar.getByRole('button', { name: 'Inspect Mon 5 Oct: DOH → AKL', exact: true }).click();
  } else {
    await calendar.getByRole('button', { name: 'Open duty on Mon 5 Oct: TESTULR', exact: true }).focus();
    await page.keyboard.press('Enter');
  }
  const dialog = page.getByRole('dialog', { name: 'Duty details, Mon 5 Oct 2026', exact: true });
  await expect(dialog.getByText(/^Ultra-long range:/)).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'ULR assumptions and coverage' })).toBeVisible();
  const facility = dialog.getByLabel('Rest facility for this duty');
  await expect(facility).toHaveValue('class_1');
  await expect(dialog.getByRole('radio', { name: '4 pilots', exact: true })).toHaveAttribute('aria-checked', 'true');

  const updated = page.waitForResponse(response => response.url().endsWith('/api/analyze') && response.request().method() === 'POST');
  await facility.selectOption('class_3');
  const response = await updated;
  expect(response.status(), await response.text()).toBe(200);
  const analysis = await response.json();
  expect(analysis.duties[0].rest_facility_class).toBe('class_3');
  expect(analysis.duties[0].rest_facility_source).toBe('pilot');
  await expect(facility).toHaveValue('class_3');
  await expect(dialog.getByText(/You selected this facility/)).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Flight duty period · not assessed', exact: true })).toBeVisible();
  await expect(dialog.getByText(/^FDP not assessed ·/)).toBeVisible();
  await expect(dialog.getByRole('list', { name: 'ULR assumptions and coverage' })).toContainText('Class 1 bunk');
  await expect(page.locator('body')).not.toContainText('Qatar Airways');
  await page.screenshot({ path: testInfo.outputPath('ulr-rest-facility.png'), fullPage: true });
  expect(errors).toEqual([]);
});
