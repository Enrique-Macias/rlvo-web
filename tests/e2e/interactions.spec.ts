import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, ready } from './fixtures';
const tabKey = (browserName: string, reverse = false) =>
  `${browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+' : ''}${reverse ? 'Shift+' : ''}Tab`;

test('teclado: skip link, navegación móvil, footer y retorno a inicio', async ({ page, browserName }) => {
  await page.goto('/'); await ready(page);
  await page.keyboard.press(tabKey(browserName));
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeInViewport();
  await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
  const links = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link');
  for (const link of await links.all()) { await expect(link).toBeVisible(); await link.focus(); await page.keyboard.press('Enter'); expect(new URL(page.url()).hash).not.toBe(''); }
  const privacy = page.getByRole('contentinfo').getByRole('link', { name: 'Privacidad', exact: true });
  await privacy.focus(); await expect(privacy).toBeInViewport(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/privacidad$/);
  await page.waitForLoadState('load'); await ready(page);
  const up = page.getByRole('link', { name: 'Volver arriba' });
  await up.focus(); await expect(up).toBeFocused(); await expect(up).toBeInViewport();
  await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/privacidad#inicio$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
});

test('teclado: orden, foco visible y ausencia de trampas', async ({ page, browserName }) => {
  await page.goto('/contacto'); await ready(page);
  const count = await page.locator('a[href],button,summary').count();
  const seen = new Set<string>();
  for (let i = 0; i < count + 2; i++) {
    await page.keyboard.press(tabKey(browserName));
    await expect.poll(() => page.evaluate(() => {
      const e = document.activeElement as HTMLElement, r = e.getBoundingClientRect();
      return e.tagName === 'BODY' || (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.left >= -1 && r.right <= innerWidth + 1);
    })).toBe(true);
    const focus = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement, r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { tag: e.tagName, href: e.getAttribute('href'), text: e.textContent?.trim(), outline: s.outlineStyle, width: s.outlineWidth,
        visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.left >= -1 && r.right <= innerWidth + 1 };
    });
    if (focus.tag === 'BODY') continue;
    expect(focus.visible).toBe(true); expect(focus.outline).not.toBe('none'); expect(parseFloat(focus.width)).toBeGreaterThan(0);
    seen.add(`${focus.href}:${focus.text}`);
  }
  expect(seen.size).toBeGreaterThan(8);
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Cómo funciona' }).focus();
  await page.keyboard.press(tabKey(browserName, true));
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'La app' })).toBeFocused();
});

test('soporte: details funciona por teclado y conserva semántica al expandir', async ({ page }, info) => {
  await page.goto('/soporte'); await ready(page);
  for (const summary of await page.locator('summary').all()) {
    await summary.focus(); await page.keyboard.press('Enter'); await expect(summary.locator('..')).toHaveAttribute('open', '');
  }
  const results = await new AxeBuilder({ page }).options({ rules: { 'target-size': { enabled: true } } }).analyze();
  await info.attach('axe-expanded', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results.violations).toEqual([]);
});

test('documentos: índice y descargas conservan los bytes y hashes canónicos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const document of ['terminos', 'privacidad']) {
    await page.goto(`/${document}`); await ready(page);
    const index = page.getByRole('navigation', { name: 'Índice del documento' });
    for (const link of await index.getByRole('link').all()) {
      const href = await link.getAttribute('href'); expect(href).toMatch(/^#[a-z]/);
      await link.click(); await expect(page.locator(href!)).toBeInViewport();
    }
    const download = page.getByRole('link', { name: 'Descargar borrador (Markdown)' });
    const event = page.waitForEvent('download'); await download.click(); const file = await event;
    const path = await file.path(); expect(path).not.toBeNull();
    const original = readFileSync(`src/content/legal/drafts/${document}.md`), actual = readFileSync(path!);
    expect(actual.equals(original)).toBe(true);
    const sha = createHash('sha256').update(actual).digest('hex');
    const checksum = await page.request.get(`/legal/borradores/${document}.sha256`);
    expect(await checksum.text()).toBe(`${sha}  ${document}.md\n`);
    expect((await page.request.get(`/${document}/v1.0`)).status()).toBe(404);
  }
});

test('reflow, texto al 200% y reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/', '/contacto', '/soporte', '/terminos', '/privacidad', '/eliminar-cuenta', '/qa-no-existe']) {
    await page.setViewportSize({ width: 320, height: 900 }); await page.goto(path); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Reflow 320: ${path}`).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    await page.setViewportSize({ width: 768, height: 900 });
    // Redimensionado de texto: no se presenta CSS zoom como zoom nativo del navegador.
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Texto 200%: ${path}`).toBe(true);
    const durations = await page.locator('a, summary').evaluateAll(elements => elements.map(e => getComputedStyle(e).transitionDuration));
    expect(durations.every(value => value.split(',').every(part => parseFloat(part) === 0))).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('reflow.png') });
});
