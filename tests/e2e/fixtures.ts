import { test as base, expect } from '@playwright/test';
export const test = base.extend<{ qaNetwork: string[]; pageErrors: string[] }>({
  qaNetwork: [async ({ context }, use) => {
    const requests: string[] = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || ['data:', 'blob:', 'about:'].includes(url.protocol)) await route.continue();
      else { requests.push(url.href); await route.abort('blockedbyclient'); }
    });
    await use(requests);
    // La telemetría existente se aísla solo en el navegador de QA; no se cambia el HTML.
    expect(requests.filter(url => !url.startsWith('https://static.cloudflareinsights.com/'))).toEqual([]);
  }, { auto: true }],
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors); expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };
export async function ready(page: import('@playwright/test').Page) {
  await page.evaluate(async () => { await document.fonts.ready; });
}
