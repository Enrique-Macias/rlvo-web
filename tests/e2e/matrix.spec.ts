import AxeBuilder from '@axe-core/playwright';
import { test, expect, ready } from './fixtures';
const routes = [
  ['inicio', '/', 200], ['terminos', '/terminos', 200], ['privacidad', '/privacidad', 200],
  ['soporte', '/soporte', 200], ['contacto', '/contacto', 200], ['eliminar-cuenta', '/eliminar-cuenta', 200], ['404', '/qa-no-existe', 404],
] as const;
for (const [name, path, status] of routes) test(`matrix: ${name}`, async ({ page }, info) => {
  const response = await page.goto(path, { waitUntil: 'load' });
  expect(response?.status()).toBe(status); await ready(page);
  // Recorrer imágenes lazy como un visitante antes de la captura completa.
  // fullPage por sí solo no dispara su carga y produciría evidencia con huecos.
  for (const frame of await page.locator('main figure, main .story-art').all()) {
    if (await frame.isVisible()) await frame.scrollIntoViewIfNeeded();
  }
  for (const image of await page.locator('main img').all()) {
    // La segunda captura del hero se oculta por diseño en móvil.
    if (!await image.isVisible()) continue;
    await expect.poll(() => image.evaluate(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const labels = page.locator('a[href], button, summary');
  for (const item of await labels.all()) if (await item.isVisible()) await expect(item).toHaveAccessibleName(/\S/);
  const layout = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    const actions = [...document.querySelectorAll<HTMLElement>('header nav a, footer a, .pill-link, .text-link, .legal-downloads a, .contents-nav a, summary, .email-link')]
      .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      smallTargets: actions.filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(e => ({ text: e.textContent?.trim(), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })),
      clippedActions: actions.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.textContent?.trim()),
      markers: (document.body.innerText.match(/\[\[POR CONFIRMAR:/g) ?? []).length };
  });
  await info.attach('layout', { body: JSON.stringify(layout, null, 2), contentType: 'application/json' });
  expect.soft(layout.overflow).toBe(false); expect.soft(layout.duplicateIds).toEqual([]);
  expect.soft(layout.smallTargets).toEqual([]); expect.soft(layout.clippedActions).toEqual([]);
  expect.soft(layout.markers).toBe(name === 'terminos' ? 5 : name === 'privacidad' ? 13 : name === 'eliminar-cuenta' ? 5 : 0);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  // Sumar 2.5.8 de WCAG 2.2 sin desactivar las reglas predeterminadas.
  const results = await new AxeBuilder({ page }).options({ rules: { 'target-size': { enabled: true } } }).analyze();
  await info.attach('axe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
});
