# PL-085 OG Image V1 — Fase 6E: Worker, compatibilidad y CI/CD (local)

Estado: **local**. OG sigue OFF en todas las entradas y configuraciones. Sin despliegues,
sin cambios en Cloudflare/Access/Supabase y sin llamadas a proveedores. Base:
`c98bd235567144d8a2c26e52ae7673129f5121fa` (merge del PR #18).

## 1. Compatibilidad con el backend (migración 505)

Se contrastó, en solo lectura, `share-og-source` entre el commit consumido por el Worker
(`2d0c712`) y la integración backend con la migración 505. La Edge Function solo amplía sus
conjuntos internos de causas:

- las nuevas causas de inelegibilidad, falta de autorización y **revocación** se emiten como
  la respuesta existente `200 {"v":1,"disponible":true,"imagen":false}`;
- el nuevo error de evidencia de privacidad mal formada se emite como `503` temporal.

El contrato de cable no cambia: mismos estados (200/404/409/400/401/405/413/503), mismos
cuerpos exactos, `Content-Type: application/json; charset=utf-8`, `Retry-After: 5` en 503,
bytes con `Content-Length` exacto y `X-RLVO-Og-Rev`, `rev` de 32 hex en minúsculas y la misma
cota de 5 242 880 B. La revisión se deriva solo de la identidad del objeto, no de las
decisiones administrativas: revocar y reautorizar conserva la misma `rev`.

**Veredicto: sin incompatibilidad material. El contrato público del Worker no se modificó.**
El Worker no necesita causas, ids, rutas ni hashes; un backend que los añadiera sería
rechazado como fallo temporal (esquema cerrado).

Efecto de la revocación en el Worker:

| Momento | Respuesta del backend | Respuesta pública |
| --- | --- | --- |
| HTML después de revocar | `op:rev` → `imagen:false` | HTML 200 con imagen de marca, sin ruta revisionada |
| URL revisionada ya difundida | `op:bytes` → `imagen:false` | 200 PNG de marca byte a byte, nunca la foto |
| Reautorizada (misma identidad) | `op:bytes` → bytes, misma `rev` | 200 JPEG compuesto |
| Nueva portada | `op:bytes` → 409 | 409 vacío |
| Publicación retirada | 404 | 404 vacío |

Todas las respuestas son `no-store` y cada petición consulta `op:bytes`; no hay caché interna.
No se pueden retirar copias ya descargadas por terceros (WhatsApp/Meta) ni respuestas en curso.

Observación sin cambio: el `op:rev` del HTML comparte el presupuesto de 6 s con la consulta
preview; un `op:rev` lento produce HTML 503, como se diseñó. Los plazos encadenados son
coherentes: fuente 13 s > plazo total del backend 12 s; imagen pública 15 s.

## 2. Pruebas añadidas

Todo con fixtures sintéticos generados en memoria. El egress está interceptado; no hay red.

- `tests/share-links/og-contract.test.mjs` (24): forma de cable exacta de la Edge Function,
  matriz de errores técnicos (GET/HEAD → 503 vacío, `Retry-After: 5`, sin `Allow`),
  `imagen:false` → marca, 404/409, esquema cerrado, variantes de `Content-Type`, cabeceras
  públicas en lista cerrada, ciclo autorizar → revocar → reautorizar → nueva portada →
  retirada, cota de fuente e integridad del distintivo independiente de la plataforma.
- `tests/share-links/og-runtime.test.mjs` (+4, workerd): bandera ausente = OFF, separación de
  claves por endpoint (sin Authorization/apikey/cookies), revocación entre HTML e imagen, y
  matriz de 10 clases de respuesta con `no-store`, cabeceras de seguridad, paridad HEAD/GET y
  cero datos privados.
- `tests/share-links/config-integrity.test.mjs` (15): inventario cerrado de configuraciones
  Wrangler, claves admitidas (sin `routes`, `account_id`, `env`, bindings remotos), OG y
  Share Links apagados, Images `remote:false`, sin endpoints ni credenciales versionados,
  manifiesto STAGING vacío, `.gitignore`, y separación cruzada local/STAGING/PROD.
- `tests/share-links/public-material.test.mjs` (5): archivos versionados o nuevos no
  ignorados sin JWT, claves Supabase, PEM, tokens, cuentas Cloudflare, rutas de equipo,
  proyectos Supabase no sintéticos, sesiones OG, artefactos Wrangler ni fotografías.
- `tests/ci-worker-gates.test.mjs` (4, protegido por la política de control): orden de
  `ci:worker` en CI, cadena completa sin atajos, pin exacto de Wrangler alineado con el lock
  y ausencia de rutas de despliegue o autenticación en scripts y workflows.
- `scripts/share-links/test-og-negative.mjs`: 9 controles (7 previos + `Retry-After`
  eliminado y esquema `imagen:false` abierto).

## 3. CI/CD

Deuda cerrada: `web-quality` no ejecutaba el Worker. Los workflows **no cambian** (los tests
existentes fijan tres pasos y `node scripts/ci/verify-web.mjs`). `verify-web.mjs` ejecuta
`npm run ci:worker` tras el build de producción y su comprobación HTTP, dentro del mismo
vigilante de inputs legales:

```sh
node scripts/share-links/prepare-staging-assets.mjs
npm run check:worker
npm run test:share-links
node scripts/share-links/test-og-negative.mjs
node scripts/share-links/test-og-staging-negative.mjs
```

`ci:share-links` pasa a ser alias de `ci:web` (antes repetía typecheck y suite).
`prepare-og-badge.mjs --check` queda como verificación local: depende de la rasterización de
Sharp y no está comprobada byte a byte en Linux; en CI se valida el hash del SVG y el PNG
240×90. Las pruebas de WhatsApp no se integran en esta suite.

Los cambios en `package.json`, `scripts/ci/` y `tests/ci-*` son críticos según
`ci/control-policy.json`: el PR requerirá la autorización externa de `legal-integrity`.

## 4. Wrangler

`wrangler` ya está fijado a **4.160.1** (devDependency exacta; lock con `resolved` e
`integrity`). Miniflare 5.20261110.1-beta, workerd 1.20261110.1 y esbuild 0.28.2 coinciden con
las dependencias de Wrangler, sin copias anidadas; el lock incluye los binarios Linux del
runner. Ningún script usa `npx wrangler`, `wrangler@latest`, `deploy`, `secret` ni `--remote`.
No se cambió la versión ni el lock: `npm ci --offline` reprodujo el árbol sin red.

`wrangler@latest` solo aparece en la configuración remota de Workers Builds de
`rlvo-public-web`, desactivada; no se tocó. Si se reactivara, debe usar el Wrangler del lock.

Dependencias transitivas (6E-R1). Los tests importan `miniflare` (solo vía Wrangler, versión
exacta) y `esbuild` (compartido por Astro `^0.28.0`, Vite como peer y Wrangler `0.28.2` exacto;
una única copia). Con `npm ci` el lock es autoritativo: **no hay riesgo real de
reproducibilidad**. El riesgo es de mantenimiento: una actualización de Astro o Wrangler
podría anidar otra copia y dejar a los tests con una versión distinta de la que usa Wrangler,
o cambiar la API beta de Miniflare. `tests/ci-worker-gates.test.mjs` lo detecta (versión
de nivel superior = dependencia de Wrangler, sin copias anidadas) y `package-lock.json` es
crítico. Declararlas como devDependencies duplicaría pins y podría introducir la divergencia
que se quiere evitar; no se añadieron.

## 5. Configuración por entorno

- Local: `wrangler.share-links.og.local.jsonc`, OG `false`, Images `remote:false`, solo loopback.
- STAGING: origen fijo `workers.dev`, endpoints vacíos (derivados de la sesión privada fuera
  de Git), manifiesto vacío, OG `false`.
- PROD: `wrangler.jsonc` solo assets; `wrangler.share-links.jsonc` con Share Links `false`, sin
  OG, Images, orígenes STAGING ni loopback. No existe política OG para PROD.

Esto describe la configuración **versionada**. La configuración remota efectiva no se
verificó; su diferencia y el checklist previo a cualquier despliegue están en
`docs/SHARE_LINKS_PREDEPLOY_CHECKLIST.md`.

## 5b. Protección de CI (6E-R1)

`ci/control-policy.json` añade como críticos `worker/`, `scripts/share-links/`,
`tests/share-links/`, `src/pages/compartir/` y el prefijo `wrangler`; CODEOWNERS añade esas
rutas y `/ci/` con el único propietario existente. Nada se retira y el piso jurídico no
cambia. La cobertura rige desde que la política esté en `main` (se lee de la base), por lo
que este PR se evalúa con la política anterior y requiere autorización externa por sus
cambios en rutas ya críticas. CODEOWNERS sigue sin revisión obligatoria (un solo propietario).

## 6. Verificación local

```sh
LEGAL_BASELINE_REF=bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 npm run ci:web
node scripts/share-links/prepare-og-badge.mjs --check
git diff --check
```

## 7. Límites y dependencias para Fase 7

- Sin ensayo en un runner Linux real: la primera ejecución de `web-quality` en el PR es la
  prueba; el tiempo local de la suite completa cabe en el límite de 20 min del job.
- Rutas del Worker incorporadas a la política (5b); efectivas solo tras fusionar con
  autorización. Hasta entonces, un PR puede cambiar Worker, tests y configuración sin ella.
- Pendientes externos: revalidación independiente de 6C-R1 (LIMITED), autorización de los
  cambios críticos de CI en el PR, decisiones D-OG-1 a D-OG-7, overlay real de Images,
  WhatsApp iOS/Android y cualquier despliegue o activación, cada uno con autorización propia.
