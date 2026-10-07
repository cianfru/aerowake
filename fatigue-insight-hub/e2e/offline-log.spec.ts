import { test, expect } from '@playwright/test';

/** A synthetic roster with a DOH duty that reported an hour ago (DOH is UTC+3, no DST). */
function rosterAroundNow(): string {
  const doh = new Date(Date.now() + 3 * 3600_000);
  const at = (minutes: number) => {
    const d = new Date(doh.getTime() + minutes * 60_000);
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
  };
  const report = at(-60), std = at(0), sta = at(150), release = at(180);
  return 'Date,Flight,Departure,Arrival,STD,STA,Report,Release\n'
    + `${report.date},TEST9,DOH,DXB,${std.time},${sta.time},${report.time},${release.time}\n`;
}

test('a rating logged offline is kept on the device and the roster reopens from it', async ({ page, context }) => {
  await page.goto('/roster');
  await page.getByLabel('Choose roster file (PDF or CSV)').setInputFiles({ name: 'now.csv', mimeType: 'text/csv', buffer: Buffer.from(rosterAroundNow()) });
  await page.getByLabel('Home base', { exact: true }).fill('DOH');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse roster', exact: true }).click();
  const card = page.getByRole('region', { name: /^On duty now: DOH/ });
  await expect(card).toBeVisible();

  await context.setOffline(true);
  await expect(card.getByText('Offline')).toBeVisible();
  await card.getByRole('radio', { name: /^6, / }).click();
  await card.getByRole('button', { name: 'Log rating' }).click();
  await expect(card.getByRole('status')).toContainText('Saved on this device as a guest.');
  await expect(card.getByRole('status')).toContainText('Sign in before logging future ratings');
  await expect(card.getByRole('list', { name: 'Your ratings on this duty' })).toContainText('KSS 6');
  await expect(page.getByRole('status').filter({ hasText: 'Offline. Showing the roster saved on this device' })).toBeVisible();

  // Back online, a reload reopens the roster and the rating from this device.
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('Reopened from this device', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: /^On duty now: DOH/ }).getByRole('list', { name: 'Your ratings on this duty' }))
    .toContainText('On this device');
  await page.getByRole('button', { name: 'Remove from this device' }).click();
  await expect(page.getByText('Reopened from this device', { exact: false })).toBeHidden();
});
