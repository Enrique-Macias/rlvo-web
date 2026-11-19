# OG Image V1 — integración privada de STAGING

Estado: **validación STAGING sintética PASS; OG OFF; no apto para PROD.**
D-OG-1 a D-OG-7 siguen PENDING_APPROVAL. D-OG-5 se implementa solo como política
provisional detrás de la bandera. No cambia contenido jurídico.

Backend: `relevo-marketplace` PR #36 "feat(share): OG Image V1 backend", fusionado en
`a47f7a84d8fae85128e29b083fdbc1303e21e24b` (moderación con evidencia, `share_og_fuente`,
Edge Function `share-og-source`). Este repositorio solo consume su contrato HTTP.

## Activación y alcance

`worker/index.ts` y `worker/staging.ts` mantienen OG siempre OFF. El handler acepta un
callback OG opcional suministrado solo por código confiable; esas entradas no lo
suministran. `og-local.ts` conserva su validación loopback.

La entrada `worker/og-staging.ts` reutiliza la política V1 STAGING, sus assets y sus
headers, y añade un control independiente al de Cloudflare Access:

1. Access protege el ingreso al Worker STAGING (verificado en el dashboard antes de escribir).
2. El Worker autoriza solo tokens compilados de un manifiesto sintético revisado.

El manifiesto versionado está vacío y la entrada por defecto falla cerrada. Para que OG
se active deben cumplirse a la vez:
- una ventana vigente de máximo dos horas;
- de 1 a 4 tokens exactos sin repetir;
- un project ref válido;
- el origen STAGING fijo;
- los flags ON;
- una clave OG válida y distinta de la de preview.

Las variables de entorno por sí solas no habilitan OG. La autorización del backend se
mantiene en cada petición.

- Imagen fuera de lista o vencida: 404 sin consultar al backend.
- Página no incluida y perfiles: comportamiento V1, sin operación OG.
- Fixture permitido y autorizado: JPEG del compositor original. Respuesta `imagen:false`: PNG de marca.
- Indisponibilidad: 404. Revisión obsoleta: 409.
- Clave ausente o incorrecta, configuración inválida, respuesta inválida, timeout, 503 o
  codec fallido: 503 `no-store`, nunca una marca exitosa.
- Sin Cache API ni KV.

## Configuración privada de STAGING (sin referencias en Git)

El repositorio no contiene el project ref ni las URLs del backend STAGING:
- `og-staging-fixtures.json` lleva el `projectRef` vacío;
- `wrangler.share-links.og.staging.jsonc` deja vacías `SHARE_PREVIEW_URL` y `SHARE_OG_SOURCE_URL`;
- los tests usan un proyecto ficticio.

El vínculo con STAGING es el pin existente de V1, `STAGING_ENDPOINT_SHA256`: el SHA-256
de la URL de preview autorizada. Ese hash no permite recuperar la URL.

Mecanismo:

1. El operador del backend entrega un handoff local **fuera de Git** con permisos 0600:

   ```json
   {
     "syntheticOnly": true,
     "fixtureVerified": true,
     "manifest": {
       "v": 1,
       "projectRef": "REF_PRIVADO_20_CARACTERES",
       "tokens": ["TOKEN_SINTETICO_22_BASE64URL"],
       "startsAt": "ISO_UTC_INICIO",
       "expiresAt": "ISO_UTC_FIN_MAXIMO_DOS_HORAS"
     }
   }
   ```

   Los valores son descriptivos y el generador los rechaza. El operador debe acreditar
   que el usuario, la universidad, la publicación, el objeto y la evidencia son
   sintéticos y aislados. No se aceptan tokens pegados de publicaciones reales.

2. `prepare-og-staging.mjs` valida el handoff y aplica estas reglas:
   - deriva `https://<ref>.supabase.co/functions/v1/share-preview` y `.../share-og-source`
     con un host y rutas fijos;
   - exige que el SHA-256 de la URL de preview coincida con el pin de V1;
   - exige una ventana vigente;
   - escribe `entry.ts` (manifiesto compilado), `active.json` y `off.json`, con las URLs
     derivadas, únicamente en `.wrangler/og-staging-session/`, que Git ignora;
   - no sobrescribe una sesión previa.

   Un handoff con otro proyecto, vacío o inválido no genera sesión.

3. En tiempo de ejecución:
   - el endpoint OG que se usa es el derivado del manifiesto compilado;
   - `SHARE_OG_SOURCE_URL` solo se compara con él;
   - el endpoint de preview, ya fijado por V1, debe pertenecer a ese mismo proyecto;
   - Host, headers, query, tokens y peticiones no eligen el destino.

   Si falta la configuración o no coincide, OG queda inválido (503) o deshabilitado.

El mecanismo está **validado localmente** (pruebas workerd y del generador). **No se ha
probado en remoto**: el E2E STAGING de 2026-11-18 se hizo con la versión anterior, que tenía
los valores fijados en código no publicado. El compositor, los límites y las garantías HTTP
no cambian.

Comandos, cada uno sujeto a autorización expresa:

```sh
node --experimental-strip-types scripts/share-links/prepare-og-staging.mjs /RUTA/PRIVADA/handoff.json ACCOUNT_ID_VERIFICADA true
node scripts/share-links/prepare-staging-assets.mjs
./node_modules/.bin/wrangler deploy --dry-run --config .wrangler/og-staging-session/off.json --outdir .wrangler/og-staging-session/bundle
./node_modules/.bin/wrangler deploy --config .wrangler/og-staging-session/off.json
python3 scripts/share-links/set-og-staging-secret.py --owner-authorized-existing-worker   # solo el propietario
./node_modules/.bin/wrangler deploy --config .wrangler/og-staging-session/active.json
./node_modules/.bin/wrangler deploy --config .wrangler/og-staging-session/off.json
```

`true` indica el workers.dev ya existente; no es permiso para habilitar uno nuevo. Antes
de cualquier escritura hay que verificar:
- inventario de Workers, cuenta, Access, ingreso, secretos (por nombre) y versión;
- que el Worker existe, porque `wrangler deploy` no pasa por el transporte guardado del
  helper de secreto.

No usar `wrangler dev` con la configuración de sesión. Tras desactivar, borrar los artefactos
de la sesión que contienen tokens.

El helper de secreto lee un archivo propio sin permisos de grupo ni otros, pasa el valor por
stdin y sus salidas se suprimen. Su transporte solo permite un PUT de secretos al Worker
STAGING existente en la cuenta fijada.

## Resultado STAGING — 2026-11-18

Bloque autorizado por el propietario sobre el Worker STAGING existente, protegido por
Access, con un único token sintético:
- secuencia OFF → ACTIVE → OFF, con OG activo unos 7 minutos;
- 3 de 8 transformaciones Images (GET autorizado, HEAD y GET tras reactivar);
- pausa, reactivación y limpieza del fixture las ejecutó el propietario.

| Caso | Resultado remoto |
| --- | --- |
| HTML del fixture | 200 `no-store`, og:image y twitter:image revisionados 1200×630, canonical y og:url sin revisión |
| GET / HEAD de imagen | 200 `image/jpeg` `no-store`; HEAD sin cuerpo con Content-Length |
| Composición | 1200×630, logo oficial 240×90 a 32 px de los bordes, foto proporcional centrada, fondo #F5FAF8; revisión visual aprobada |
| Metadatos | Sin EXIF, XMP, IPTC, ICC, COM ni APPn, aunque la fuente sintética tenía EXIF |
| Fuera de lista / revisión obsoleta / rutas inválidas | 404 sin backend / 409 / 404, y POST 405 |
| Pausa, reactivación, OFF, limpieza | 404 sin caché interna / 200 idéntico / 404 / 404 V1 sin datos del fixture |
| Preservación | Access, ingreso, routes, dominios y los demás Workers sin cambios |

Validados solo localmente o no ejecutados en remoto:
- clave ausente o incorrecta;
- backend 503, timeout, codec fallido, saturación y HTML 503;
- `imagen:false`;
- vencimiento de la ventana con ACTIVE;
- perfiles reales;
- "cero consultas" observadas en logs del backend;
- inspección de BD y Storage tras la limpieza;
- WhatsApp/Meta externo, latencia, memoria y concurrencia.

Cambios que permanecen en STAGING por decisión del propietario:
- entrada OG con `SHARE_OG_ENABLED=false`;
- binding `IMAGES`;
- `SHARE_OG_SOURCE_URL`;
- secreto `SHARE_OG_KEY_CURRENT`;
- `SHARE_PREVIEW_KEY_CURRENT` sin cambios.

El bundle desplegado conserva compilado un manifiesto vencido. No se redespliega para
limpiarlo.

No hay revocación retroactiva de un JPEG ya descargado por terceros, y `no-store` no obliga
a sus cachés. Tampoco existe un snapshot atómico entre preview, rev y bytes.

## Verificación local

```sh
npm run build
npm run check
npm run check:worker
npm run test:share-links
npm run test:legal
node scripts/share-links/test-og-negative.mjs
node scripts/share-links/test-og-staging-negative.mjs
node scripts/share-links/prepare-og-badge.mjs --check
git diff --check
```

Ninguno invoca el backend: los tests STAGING interceptan todo egress y usan un proyecto
ficticio. Los controles negativos STAGING mutan la allowlist, la expiración, el pin del
origen OG y el vínculo de proyecto, y los cuatro deben detectarse.

## CI/CD y deuda

- GitHub CI (`web-quality`, `legal-integrity`) no ejecuta `test:share-links` ni
  `check:worker`. Hay que correrlos localmente antes de fusionar.
- Workers Builds de `rlvo-public-web` está desactivado. Su configuración usa
  `wrangler@latest` sin versión fija y publicaría solo `dist/` mediante `wrangler.jsonc`.
- Los despliegues manuales de sesión no pasan por el transporte guardado.
- Nada en este repositorio activa OG en producción.
