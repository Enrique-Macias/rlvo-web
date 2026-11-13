# Share Links W1 — implementación local

Estado: implementación local; sin publicación, secretos reales ni conexión a STAGING/PROD.

## Arquitectura
Astro conserva output static. La landing sigue usando wrangler.jsonc intacto, sin main ni binding W1.
El Worker se selecciona exclusivamente con wrangler.share-links.jsonc, en el mismo recurso previsto
rlvo-public-web. ASSETS conserva 404-page y drop-trailing-slash. Worker-first cubre /p, /p/*, /u, /u/*.
También cubre sus alias codificados /%70 y /%75 para rechazarlos con 404 antes de que Static Assets
los normalice mediante 307. Ninguna otra ruta consulta el backend.

La plantilla estática /compartir/plantilla es genérica, noindex y sin datos; no usa BaseLayout.
HTMLRewriter modifica atributos y texto con html:false; nunca inserta HTML del backend.
CSP bloquea scripts, conexiones, frames, base y formularios. Autoriza recursos locales y, si Astro
inserta CSS estático inline, únicamente sus hashes SHA-256 calculados sobre la plantilla confiable.
HEAD consulta la misma disponibilidad y plantilla para conservar status y headers, sin cuerpo.

## Configuración y activación
Nombres: SHARE_LINKS_ENABLED, SHARE_LINKS_ENV, SHARE_LINKS_PUBLIC_ORIGIN,
SHARE_PREVIEW_URL, SHARE_PREVIEW_KEY_CURRENT y ASSETS.
SHARE_LINKS_ENABLED está apagado por defecto. Apagado: 404 genérico y cero fetch upstream.
Configuración incompleta/incorrecta: 503 genérico y cero fetch upstream.
Ninguna URL ni clave procede de la petición pública.

Esta fase solo admite SHARE_LINKS_ENV=local, origen HTTP 127.0.0.1 con puerto explícito y endpoint
simulado en 127.0.0.1 con ruta exacta /functions/v1/share-preview, sin credenciales/query/fragment.
No acepta localhost, hosts externos ni activación preview/production. La futura autorización de
STAGING debe incluir revisión de una allowlist de endpoints y configuración por ambiente; no basta
con añadir un secreto o cambiar una bandera. No hay endpoint real ni fallback configurado.

El origen previsto de producción es https://www.rlvo.com.mx, consumiendo site.url sin modificar
src/config/site.ts. La reconciliación con el canonical apex observado públicamente sigue pendiente.
El deploy habitual no selecciona la configuración W1 ni contiene su entrada. Tampoco un deploy
accidental del opt-in puede consultar un backend con la configuración versionada apagada.
workers_dev y preview_urls están desactivados en la configuración opt-in; no se desplegó nada.

## Contrato
POST JSON, X-RLVO-Preview-Key y cuerpo exacto {v:1,tipo:"p"|"u",token:<22 base64url>}.
Sin Authorization, apikey, service_role ni headers del visitante.
Acepta únicamente v1 con disponible:false, publicación (titulo 1–80 puntos de código,
precio_mxn entero 0–100000) o perfil (nombre_publico 1–200), del tipo solicitado y sin extras.
Límite 4096 bytes, JSON UTF-8, Content-Type application/json. Redirects rechazados.
Deadline total 6000 ms incluyendo lectura; aborta fetch/cancela cuerpo, sin reintentos.
Errores internos/configuración/timeout -> 503; disponible:false/token inválido -> 404 uniforme.
No se implementa ni afirma expiración temporal. GET y HEAD; otros métodos 405, Allow: GET, HEAD.

## Privacidad
Solo título/precio o nombre público R1 del backend. Imagen de marca oficial, sin fotos ni avatares.
No universidad, campus, descripción de publicación, correo, teléfono, ids, ratings ni reseñas.
No cookies, scripts, analytics, almacenamiento local, redirección automática o Deep Links.
No se interpreta el resultado como autenticación ni garantía de identidad/transacción.
Los bloqueos bilaterales no se evalúan en la vista anónima: decisión previa del contrato B3.
Headers públicos se construyen desde cero, descartando cookies, sb-error-code y todo header upstream.
Logs propios contienen exclusivamente resultado, status y duración. Los logs automáticos de
Cloudflare, gateway y herramientas locales pueden conservar URLs/tokens: revisión pendiente.
no-store no elimina copias ni cachés ya guardados por WhatsApp u otros terceros.

## Herramientas y comandos
Node 22.21.1, npm 10.9.4. Wrangler 4.160.1 exacto (engines >=22.12.0), devDependency.
No adaptador SSR ni SDK Supabase. El resto del lockfile conserva las versiones previas.
Wrangler incluye el runtime workerd y el bundler. La API de tests unstable_dev está fijada por ese pin.

- npm run build: genera assets y plantilla; requiere LEGAL_BASELINE_REF aprobado.
- npm run check / npm run check:worker.
- npm run test:share-links: node:test, núcleo y HTTP real workerd con mock Node en loopback.
- npm run test:share-links:visual: Chromium/axe, 360/390/768/1280, teclado, DOM XSS y recursos.
- npm run ci:share-links: pipeline integral existente, tipos y suite W1. Sin deploy.
- npm run dev:share-links: solo runtime local, configuración apagada; sin credenciales reales.

Las pruebas usan una clave ficticia en memoria y tokens sintéticos; capturan llamadas y verifican
cero conexiones con activación apagada o configuración inválida. No copiar .env/.dev.vars/credenciales
a este worktree. Los fixtures cierran todos sus servidores en finally. La revisión visual necesita
binarios de Playwright compatibles; no descarga ni publica recursos por sí misma.

## Archivos y controles críticos
worker/{index,config,share-preview,render,format}.ts, superficie runtime mínima y tsconfig;
plantilla Astro; configuración Wrangler opt-in; tests/share-links y este documento.
package.json/package-lock.json y scripts/audit-static.mjs son críticos según ci/control-policy.json:
el futuro PR requiere autorización CI externa exacta. La excepción del auditor solo permite
compartir/plantilla.html, con marcador v1, noindex y cero scripts; las otras páginas conservan la regla
de analytics existente. public/_headers añade noindex/no-store solo a la plantilla.
No se cambian workflows, rulesets, Environment, checker, política ni inputs jurídicos congelados.
Las 73 fuentes protegidas deben permanecer iguales a HEAD. De las 13 entradas vigiladas, los dos
manifests cambian intencionalmente para herramientas/comandos; durante validación no deben reescribirse
ninguna de las 13. Los otros 11 inputs siguen idénticos al baseline.

## Validación
Validación final local: ci:share-links PASS (434.327 s), incluyendo CI 216/216, legales
44/44, tipos del Worker, builds preview/producción, auditorías y suite W1 119/119.
Regresión test:qa 93/93 (4.260 s). Astro check 92 archivos, cero errores/warnings/hints.
472 pruebas distintas, sin fallos, omisiones, cancelaciones ni pendientes; repeticiones no sumadas.
HTTP estático en ambos builds: seis páginas 200, descargas exactas, manifest coherente y 18
versiones inexistentes 404. Runtime workerd: 200/404/503/405, GET/HEAD, 404 uniforme, rechazos
codificados, timeout de cabeceras/cuerpo a seis segundos con conexión cancelada y cero reintentos.
Los seis casos de activación/configuración prueban cero llamadas al mock upstream.
Controles negativos de auditoría PASS: script en plantilla y landing sin beacon rechazados.

Chromium local: ocho casos p/u a 360/390/768/1280, sin overflow, foco de teclado y targets >=44px;
axe WCAG 2.2 AA sin infracciones ni incomplete, DOM XSS seguro, cero requests externos,
cero errores CSP y cero cookies. Se inspeccionaron capturas mobile/desktop.
No son una certificación WCAG completa ni una prueba de tarjetas WhatsApp.
73 fuentes protegidas idénticas a HEAD. Las 13 entradas vigiladas conservaron bytes, modo,
inode/dispositivo, mtime y ctime durante la validación. 23 marcadores, cero releases, lock/registro
vacíos y punteros null. El PNG OG se regenera con los mismos bytes y timestamps nuevos.
Warnings esperados: preview sin sitemap indexable y marcadores jurídicos.
Wrangler añade 28 entradas al lock; ninguna entrada preexistente cambia.
Los logs .wrangler-share-*.log y qa/share-links/ se conservan como artefactos ignorados.
No contar repeticiones del pipeline como cobertura adicional ni presentarlas como GitHub Actions.

## Pendientes antes de publicación
Revisión de configuración real Cloudflare y logs; reconciliación www/apex; aprobación jurídica y
23 marcadores pendientes; analytics existente; secretos reales; allowlist y conexión STAGING;
WhatsApp real y comportamiento de su caché; fase D/asociaciones iOS-Android; PROD.
Cierre técnico no equivale a aprobación jurídica. Esta fase no autoriza ninguno de esos pasos.
