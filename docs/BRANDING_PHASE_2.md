# RLVO — Fase 2: Branding

Alcance autorizado: identidad visual del sitio público. No incluye versionado
legal, publicación, cambios remotos ni modificaciones al repositorio móvil.

## Decisiones de arquitectura

- Se conserva `wrangler.jsonc` y su configuración de Workers Static Assets.
  No se migra a Pages. La configuración local no acredita por sí sola el
  producto de Cloudflare utilizado por la cuenta remota.
- El canonical público aprobado es `https://www.rlvo.com.mx`. Los correos y
  el dominio mencionado en los documentos legales conservan `rlvo.com.mx`.
- La consulta HTTP del 27 de octubre de 2026 devolvió 200 tanto para el host
  con `www` como para el dominio raíz; no se observó una redirección entre
  ellos en esas respuestas. No se modificaron redirects, DNS o Cloudflare.
- Cloudflare Web Analytics permanece intacto por instrucción expresa.

## Discrepancia pendiente antes de PROD

`BaseLayout.astro` incluye `CloudflareWebAnalytics.astro` en todas las páginas,
y `audit-static.mjs` exige ese beacon. AGENTS.md, LEGAL_FACTS.md, otras notas
de implementación y el aviso de privacidad describen un sitio sin analítica.

Esta fase no concilia el contenido jurídico ni declara correcta esa afirmación.
Antes de PROD deben confirmarse la política de analítica, la autorización y
la revisión correspondiente del aviso y de la documentación.

## Límites legales

Se conserva el contenido de términos, privacidad y eliminación de cuenta, así
como todos los marcadores pendientes. Los ajustes son de presentación.

La futura arquitectura aprobada contempla Markdown canónico, SHA-256 y URLs
inmutables. No se implementa en esta fase. Las versiones `staging-prueba`
de PL-016 son históricas: no deben alterarse ni reutilizarse.

## Assets oficiales

`brand-reference/` es material preexistente y se conserva intacto. Los 18 SVG
se copian a `public/brand/` sin reescribir bytes. Sus hashes se registran en
`src/config/brand-assets.json`; son hashes de assets de marca, no versiones
ni hashes de documentos legales.

Header y footer claro utilizan el SVG 07. El favicon utiliza una copia exacta
del SVG 06. Las variantes transparentes mantienen sus proporciones y colores;
no se usan filtros, recortes ni reconstrucciones del wordmark.

Las capturas históricas y sus aclaraciones se conservan. Una identidad uniforme
dentro de las capturas requiere nuevos screenshots reales de la aplicación.

## Decisiones visuales

- Se aplica la Paleta 06 definida en la solicitud original y el kit: #183D39,
  #23635C, #78CDB5, #DDF5ED, #F5FAF8 y #FFFFFF. El valor `#7F5FAF8` del
  mensaje de autorización no es un hexadecimal CSS válido y se interpreta
  como una errata; se comunicó esa interpretación durante la implementación.
- Se conservan la composición editorial, las secciones y sus textos. Las
  superficies principales son F5FAF8, blanco y menta claro; las secciones
  inversas utilizan verde principal y acentos menta.
- Los enlaces, acciones, estados, bordes, marcos y sombras consumen tokens
  semánticos. La menta como texto se reserva para superficies inversas.
- Fraunces e Inter conservan sus archivos locales. Se eleva la legibilidad
  de navegación, notas y texto documental, y se contiene la escala de sus h1.
- El favicon dinámico anterior se sustituye por el SVG original 06 estático.
  Open Graph es una composición PNG de 1200 × 630, aproximadamente 15 KB,
  generada con Sharp y el SVG 09 blanco sin modificar el original.
- No se añaden dependencias ni JavaScript de interfaz.

## Archivos de implementación

- `src/styles/tokens.css`, `global.css`: paleta, roles, foco y estilos comunes.
- `src/components/BrandName.astro`, `SiteHeader.astro`, `SiteFooter.astro`:
  logos oficiales y navegación.
- `src/components/ContactLink.astro`, `LaunchStatus.astro`, `ProductScreen.astro`
  y los seis componentes de `landing/`: aplicación de los nuevos roles.
- `src/layouts/ContentLayout.astro`, `BaseLayout.astro`: presentación común
  de las siete páginas y referencia centralizada del favicon.
- `src/config/site.ts`, `brand-assets.json`, `SeoHead.astro`: canonical,
  assets, metadata e integridad de SVG.
- `public/brand/`, `public/favicon.svg`, `public/og/`: assets servidos.
- `src/pages/favicon.svg.ts`: eliminado al sustituirse por el archivo estático.
- `scripts/prepare-brand.mjs`, `audit-brand.mjs`, `package.json`: generación
  de Open Graph y auditoría de branding integrada al build.
- README y documentación de marca, diseño, SEO y deployment: decisiones
  actuales y discrepancias pendientes. No se modifica LEGAL_FACTS.md.

## Validación del 27 de octubre de 2026

- `npm run check`: 33 archivos, cero errores, warnings o hints.
- `npm run build`: siete páginas, auditoría estática y de branding aprobadas.
- `npm run build:preview`: aprobado; siete páginas noindex, robots bloqueado
  y sin sitemap. Se restauró después el build normal para la vista local.
- Branding: 18 SVG y favicon verificados por SHA-256; 12 pares de contraste
  de texto y foco sobre tres superficies claras; metadata y logos correctos.
- Chrome: siete páginas a 360, 390, 768 y 1280 px, sin overflow horizontal,
  imágenes rotas ni imágenes sin atributo alt.
- Contraste renderizado: 859 comprobaciones de texto en las siete páginas
  a 390 y 1280 px, sin fallos después de corregir la especificidad del enlace
  de acción en 404. Es una comprobación propia de colores calculados sobre
  superficies sólidas, no una certificación completa de WCAG.
- Teclado: el enlace de salto enfoca main; summary abre con Enter y muestra
  un foco sólido de 3 px. No se observaron errores o warnings en la consola
  consultada del navegador.
- Se verificaron 32 archivos protegidos contra el baseline anterior: kit
  original, capturas, páginas legales, pendientes, LEGAL_FACTS.md, beacon,
  configuración de Workers y lockfile. Ninguno cambió.
- El texto renderizado dentro de la prosa de términos, privacidad y
  eliminación coincide con el baseline. Se conservan 23 apariciones de
  POR CONFIRMAR. Canonical, sitemap y robots utilizan el host www aprobado.
- La revisión de recursos declarados y la auditoría estática no encuentran
  recursos externos nuevos; se conserva únicamente el beacon existente.

No se ejecutaron Lighthouse, axe, Safari, lector de pantalla, pruebas en
dispositivos físicos ni una captura completa de tráfico de red. Reduced motion
conserva las reglas CSS existentes, sin una nueva emulación en navegador.

Vista local de revisión: `http://127.0.0.1:4388/`. Para reiniciarla después de
un build: `npm run preview -- --host 127.0.0.1 --port 4388`.

No se realizaron commits, push, despliegues, modificaciones remotas ni cambios
en DNS, Cloudflare, Supabase o el repositorio móvil. No se implementaron
rutas legales versionadas ni se publicaron versiones definitivas.

## Cierre aprobado

El usuario aprobó visualmente Paleta 06 y autorizó un commit local exclusivo
de esta fase. Se revisó el diff completo y los assets nuevos: no se encontraron
indicios de secretos ni modificaciones jurídicas accidentales. Las páginas
legales, sus pendientes, el beacon, Workers y el lockfile coinciden con el
baseline anterior. El kit fuente se incorpora conservando exactamente sus
bytes, junto con las copias servidas. No se autoriza push ni deployment.
