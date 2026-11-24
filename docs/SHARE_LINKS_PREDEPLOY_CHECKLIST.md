# Share Links / OG — configuración por entorno y checklist de predeployment

Documento operativo (PL-085 6E-R1). No autoriza ningún despliegue, consulta remota ni
cambio en Cloudflare, Access o Supabase. Cada paso remoto exige autorización propia.

## A. Configuración versionada (este repositorio)

Comprobada por `tests/share-links/config-integrity.test.mjs` en cada CI:

| Archivo | Worker | Entrada | Share Links | OG | workers.dev | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| `wrangler.jsonc` | `rlvo-public-web` | ninguna (solo assets) | — | — | — | Sitio PROD estático |
| `wrangler.share-links.jsonc` | `rlvo-public-web` | `worker/index.ts` | `false` | sin variables | `false` | Opt-in W1 local; nunca desplegado |
| `wrangler.share-links.og.local.jsonc` | `rlvo-og-local-only` | `worker/og-local.ts` | `false` | `false`, Images `remote:false` | `false` | Solo local; no desplegar |
| `wrangler.share-links.staging.jsonc` | `rlvo-share-links-staging` | `worker/staging.ts` | `false` | sin variables | `false` | Base cerrada STAGING |
| `wrangler.share-links.og.staging.jsonc` | `rlvo-share-links-staging` | `worker/og-staging.ts` | `false` | `false`, endpoints vacíos | `false` | Base de sesión OG |
| `wrangler.share-links.staging.private.template.jsonc` | `rlvo-share-links-staging` | `worker/staging.ts` | `true` | sin variables | `true` | Plantilla; se materializa fuera de Git |

Ningún archivo versionado contiene cuenta, rutas, dominios, endpoints Supabase ni secretos.
`worker/og-staging-fixtures.json` está vacío. No existe política OG para PROD.

## B. Configuración remota efectiva (Cloudflare)

**No verificada en este bloque.** Último estado conocido documentado
(`SHARE_LINKS_W2.md`, `SHARE_LINKS_OG_STAGING_INTEGRATION.md`, 2026-11-18):

- STAGING `rlvo-share-links-staging`: Share Links V1 activado, OG Image V1 desactivado
  (`SHARE_OG_ENABLED=false`) con binding `IMAGES`, `SHARE_OG_SOURCE_URL` y secretos
  `SHARE_PREVIEW_KEY_CURRENT`/`SHARE_OG_KEY_CURRENT` conservados; Cloudflare Access activo.
- El bundle desplegado conserva compilado un manifiesto de sesión vencido.
- PROD `rlvo-public-web`: sitio estático; Workers Builds desactivado (usa `wrangler@latest`).

Ese estado se generó desde configuraciones **privadas** materializadas fuera de Git
(plantilla privada o `.wrangler/og-staging-session/off.json`), no desde los `.jsonc`
versionados. Puede haber cambiado desde entonces; volver a comprobarlo antes de actuar.

### Divergencias que un despliegue accidental produciría

- `wrangler deploy --config wrangler.share-links.staging.jsonc` (o `.og.staging.jsonc`)
  sobre STAGING: Share Links pasa a `false` (404 en `/p` y `/u`), `workers_dev:false` retira
  la entrada workers.dev y las `vars` versionadas sustituyen las remotas (`SHARE_PREVIEW_URL`
  vacío). Las sesiones privadas fijan `account_id`, endpoints y `workers_dev`.
- `--config wrangler.share-links.jsonc` sobre PROD: añade un Worker delante de `/p` y `/u`
  del sitio público. Nunca está autorizado sin un plan PROD.
- `--config wrangler.share-links.og.local.jsonc`: crearía el Worker `rlvo-og-local-only`.
- `active.json` de una sesión: activa OG. Solo dentro de una ventana sintética autorizada.

## C. Checklist de predeployment (Share Links / OG)

Marcar cada punto con evidencia sanitizada. Ante cualquier discrepancia: **detenerse**.

### 1. Autorización y origen del código

- [ ] Autorización expresa vigente que nombra Worker, entorno, configuración y ventana.
- [ ] Commit fusionado en `main` con `web-quality` y `legal-integrity` en verde para ese SHA.
- [ ] Worktree limpio en ese SHA; `npm ci` desde el lock; Wrangler local `4.160.1`
      (`./node_modules/.bin/wrangler --version`). Nunca `npx wrangler` ni `@latest`.
- [ ] `LEGAL_BASELINE_REF=<baseline> npm run ci:web` en verde en ese worktree.

### 2. Inventario remoto antes de escribir (solo lectura, autorizado)

- [ ] Cuenta seleccionada = cuenta esperada (huella, nunca el ID completo en logs).
- [ ] El Worker destino existe y su nombre coincide con `name` de la configuración a usar.
- [ ] Versión activa registrada (ID) para rollback.
- [ ] `vars` remotas actuales registradas: `SHARE_LINKS_ENABLED`, `SHARE_LINKS_ENV`,
      `SHARE_LINKS_PUBLIC_ORIGIN`, `SHARE_OG_ENABLED` y presencia (sin valor) de URLs.
- [ ] Secretos listados **solo por nombre**; ninguno se crea ni se lee.
- [ ] Bindings (`ASSETS`, `IMAGES`), rutas, dominios, workers.dev y preview URLs registrados.
- [ ] Cloudflare Access: aplicación y política que cubren el hostname STAGING, activas.
- [ ] Workers Builds de `rlvo-public-web` sigue desactivado.

### 3. Configuración a desplegar

- [ ] Es la configuración privada materializada para esta operación (no un `.jsonc`
      versionado de STAGING) y se generó con el script revisado en este SHA.
- [ ] `name`, `account_id`, `main` y `workers_dev` coinciden con el inventario remoto.
- [ ] `SHARE_LINKS_ENABLED` conserva exactamente el valor remoto registrado, salvo que la
      autorización ordene cambiarlo.
- [ ] `SHARE_OG_ENABLED` es `"false"` (o ausente) salvo ventana OG sintética autorizada.
- [ ] Sin `routes`, dominios ni bindings nuevos; Images, si existe, ya estaba en remoto.
- [ ] `wrangler deploy --dry-run --outdir <tmp>`: el bundle no contiene claves, tokens de
      sesión vigentes, rutas del equipo ni `og-local`; la entrada es la esperada.
- [ ] Ningún secreto en `vars`; ningún archivo de sesión entra en Git.

### 4. Después del despliegue (autorizado, sin datos reales)

- [ ] Sin credencial de Access, el hostname STAGING sigue protegido (no responde el Worker).
- [ ] Con Access, `/p/<token sintético>` y `/u/<token sintético>` mantienen el comportamiento
      previo registrado (200 o 404 según `SHARE_LINKS_ENABLED`), `no-store` y `noindex`.
- [ ] `/p/<token>/og/<rev>` devuelve 404 sin consultar backend con OG OFF.
- [ ] HTML de publicaciones usa la imagen de marca, sin ruta revisionada.
- [ ] Versión activa nueva registrada; `vars`, secretos (por nombre), bindings y rutas
      idénticos al inventario salvo lo autorizado.
- [ ] Ante desviación: rollback a la versión registrada y reporte; no corregir por suposición.

### 5. Cierre

- [ ] Artefactos privados de sesión eliminados (`.wrangler/og-staging-session`, configuración
      privada materializada); evidencia sanitizada conservada fuera de Git.
- [ ] Estado remoto final documentado como **verificado** con fecha, o como no verificado.
