# RLVO — SEO Requirements

## Objetivo

Optimizar el sitio público para buscadores sin generar contenido artificial.

---

## Idioma

es-MX

---

## Dominio canónico

https://www.rlvo.com.mx

---

## Requisitos por página

Cada página indexable debe definir:

- title
- meta description
- canonical
- Open Graph title
- Open Graph description
- Open Graph image cuando exista

### Estado de la primera implementación

La configuración por ruta vive en `src/config/site.ts`. `/`, `/contacto` y
`/soporte` son indexables en el build de producción. `/privacidad`, `/terminos`
y `/eliminar-cuenta` conservan `noindex, follow` mientras sean borradores con
datos pendientes. `/404` también lleva `noindex, follow`.

Solo las rutas indexables se incluyen en el sitemap. Los canonical usan el
dominio principal y rutas sin slash final, salvo `/`. Open Graph incluye tipo,
marca, locale, título, descripción y URL. La imagen de marca se genera en
`/og/rlvo-paleta-06.png` a 1200 × 630 desde el logo oficial y el verde principal.
Su URL, descripción y dimensiones viven en `site.seo`. `theme-color` coincide
con la superficie principal; la auditoría de branding comprueba esa relación.

La aprobación de `www` como host canónico no modifica redirects. La consulta
HTTP del 27 de octubre de 2026 devolvió 200 en ambos hosts; su conciliación
en infraestructura requiere verificación y autorización independientes.

`SITE_ENV=preview` fuerza `noindex` en todas las páginas y robots bloqueado.
El build normal restaura la política de producción. Cuando los documentos
legales estén aprobados, se actualizará su metadata de indexación.

---

## Sitemap

Generar sitemap del contenido público indexable.

---

## robots.txt

Debe existir `/robots.txt`.

No bloquear accidentalmente producción.

---

## Contenido

No crear páginas SEO programáticas.

No generar:

- páginas por universidad
- páginas por ciudad
- páginas por categoría

hasta que exista contenido real y una decisión explícita.

---

## Structured data

Solo utilizar datos estructurados cuando los datos representados sean reales y
verificables.

No inventar:

- ratings
- reviews
- organization details
- social profiles

---

## Performance

Core Web Vitals y performance forman parte de los objetivos SEO.

Minimizar:

- JS
- CLS
- imágenes pesadas
- fuentes innecesarias
