# Share Links W2 — STAGING aislado: implementación y validación alojada

## Alcance
Base histórica de implementación W2: 77c60d349c1c81919a857783c7f942a57f808390 (árbol W1 24df02119dd459b7da7ade900022450f449cc816).
Worker STAGING: rlvo-share-links-staging. Origen aprobado:
https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev.
La implementación local histórica no creó recursos. El estado alojado observado
posteriormente y los cierres W2-S1 y W2-Q1C/D se registran a continuación, con
fecha y procedencia de la evidencia. No constituyen un inventario en tiempo real.
Esta consolidación no modifica rlvo-public-web, sus dominios, wrangler.jsonc ni wrangler.share-links.jsonc.

## Estado alojado y validación W2-Q1 — evidencia del 15 de noviembre de 2026

**PL-085 permanece ABIERTO.** W2-S1, W2-Q1A/B/C y W2-Q1D-A/B están completados
en sus alcances respectivos. W2-Q1 no está cerrado en su totalidad: W2-Q1E
(prueba de perfil y limpieza) sigue pendiente. W2-Q2 (WhatsApp real) es una fase
separada también pendiente.
La integración móvil, PROD y los pendientes jurídicos no se cierran con estas pruebas.

### W2-S1 — conexión privada acreditada

Última versión observada por Codex en la API, activa al 100%:
`a6a3f660-6ed8-45f7-adad-13f6d89729c2`.
Deployment observado: `88f86933-9e27-44c7-a67d-d7f6e0048c80`.
La activación terminó a las 06:51:22 UTC del 15 de noviembre; lecturas posteriores
del mismo día confirmaron esa versión y deployment. No se realizó una nueva
consulta alojada para esta consolidación documental.

Estado efectivo observado: SHARE_LINKS_ENABLED=true, SHARE_LINKS_ENV=staging,
origen aprobado exacto, endpoint coincidente con el pin compilado y
SHARE_PREVIEW_KEY_CURRENT presente por metadata, sin NEXT. workers.dev habilitado
bajo Cloudflare Access, preview URLs y Observability deshabilitados; ASSETS mínimo,
Worker-first, sin routes ni custom domains. La configuración cerrada versionada
sigue apagada por diseño; no describe la versión privada activada mediante la
configuración materializada. No se modifican aquí configuraciones ni Secrets.

Cloudflare Access permanece como protección de este STAGING según la evidencia
aportada: All traffic, política Cloudflare account members — Allow, sesión de 24 h.
No es una allowlist individual de correo. La API observó un único miembro aceptado;
el propietario confirmó la política. La evidencia anterior de Codex incluye los
302 anónimos hacia la organización Access prevista, sin servir contenido protegido.
Las limitaciones administrativas de la API Access se conservan; no se amplió OAuth.

La conexión Worker → Supabase STAGING se acreditó por correlación funcional entre
configuración activa, ruta/token válidos, credencial por metadata, código integrado
y navegaciones autenticadas del propietario. No se observaron directamente JSON ni
logs de la Edge Function. Un 404 aislado no se consideró evidencia suficiente.

### Procedencia y alcance de la evidencia

- **Codex, observación directa en etapas anteriores:** configuración/versiones del
  Worker por API, comprobaciones HTTP anónimas 302 y primer GET autenticado 200 de
  Mochila mediante la sesión legítima del propietario. Inspección del código integrado.
- **Claude Code, evidencia backend reportada:** W2-Q1A/B, inventarios y asociaciones,
  idempotencia, estados de publicaciones y enlaces y verificaciones SQL de D-A/B.
  En D-A/B consultó public.share_preview como postgres; no observó directamente la EF.
- **Propietario, evidencia manual reportada como revisada por ChatGPT:** navegaciones
  autenticadas en Arc, snippets de solo lectura del documento y del status mediante
  PerformanceNavigationTiming.responseStatus, capturas y Response Headers indicadas
  en cada etapa. Codex no ejecutó estas comprobaciones manuales ni afirma haber
  inspeccionado directamente esas capturas durante esta consolidación.
- **Código y contrato:** worker/handler.ts traduce disponible:true a 200 y
  disponible:false a 404; configuración inválida y errores del cliente producen 503.
  worker/render.ts fija datos mínimos, metadata, imagen oficial y headers. La matriz
  de disponibilidad backend prevé no disponible para pausadas y tokens inexistentes.
  Referencia: [contrato y disponibilidad B3/B4](https://github.com/Enrique-Macias/Relevo-Marketplace/blob/971a855a654a97359aac1d0030a66fa9418f15db/docs/architecture/database/share-links.md#matriz-de-disponibilidad).

Los intentos automatizados tuvieron limitaciones de navegador/Access y no sustituyen
esta evidencia manual: el fetch del snippet inicial quedó bloqueado por connect-src
'none'; la ejecución Playwright se detuvo en autenticación por un host no permitido.
No se relajaron CSP ni Access para completar Q1C. El material de sesión del incidente
anterior queda excluido: no se recupera, reproduce ni almacena aquí. No se certifica
la invalidación técnica de sesiones anteriores. No hay evidencia de filtración de
credenciales en el HTML del Worker.

### W2-Q1A/B — preflight y generación: completados

Según el handoff de Claude Code, Q1A completó el preflight. El propietario creó
tres publicaciones de prueba desde la app real de STAGING, activas, moderadas y con
una fotografía cada una. Generó sus enlaces con public.enlace_compartido mediante
una sesión legítima autenticada, sin service role para la generación.
Claude verificó tres filas originales (antes cero), correspondencia con los fixtures,
tokens de 22 caracteres base64url e idempotencia para cada recurso. No se generaron
enlaces de perfil ni de otras publicaciones. No hubo cambios de código, migraciones,
RLS o Edge Functions. Los tokens completos no son necesarios en este documento.

### W2-Q1C — validación positiva: PASS funcional, 3/3

| Fixture de referencia | Título exacto | Precio observado | GET autenticado | Resultado |
|---|---|---|---|---|
| 118 | Mochila Universitaria | $450 MXN | 200 | PASS_DOCUMENTO_HTTP |
| 119 | Calculadora científica Casio | $350 MXN | 200 | PASS_DOCUMENTO_HTTP |
| 120 | Libros de matemáticas para universidad | $250 MXN | 200 | PASS_DOCUMENTO_HTTP |

En las tres páginas, la evidencia manual confirmó título/h1, precio según priceMxn,
description, Open Graph, Twitter, canonical, robots, CTA y estructura esperados,
sin duplicados en los campos comprobados. Logo RLVO, «Una publicación compartida
en RLVO.», «La app de RLVO: Próximamente» y «Conoce RLVO» correctos, sin mezcla
de fixtures. Privacidad por patrones/estructura: pass true, cero hallazgos por página.

Desktop PASS y móvil 393 × 852 PASS, sin desbordamiento horizontal ni problemas
observados con títulos largos/acentuados. La revisión móvil fue emulación de iPhone 16
en Arc, no Safari en un dispositivo físico.

D-B3-4/M1 respetadas: og:image y twitter:image apuntan al recurso oficial
`/og/rlvo-paleta-06.png` del origen STAGING. El propietario lo abrió autenticado y
vio el logo blanco sobre fondo verde oscuro; no se muestran fotografías reales de
publicaciones ni del vendedor. 1200 × 630 son dimensiones declaradas en metadata:
no se midieron independientemente los píxeles del PNG ni se probó el crawler WhatsApp.
Las cabeceras de los tres documentos principales fueron confirmadas manualmente
(ver «Cabeceras confirmadas»).

### W2-Q1D-A — pausa de 119: PASS funcional completo

El propietario pausó Calculadora 119 desde la app STAGING. Claude Code reportó
119 pausada, token original intacto y share_preview disponible:false; 118/120
activas, tokens intactos y disponible:true. Inventario: los tres enlaces originales,
sin generación, eliminación ni rotación. El updated_at de 119 cambió a 22:58:11Z;
el PATCH /rest/v1/listings 204 a las 22:58:11.613Z es consistente con la pausa
manual según los logs reportados por Claude. 118/120 conservaron sus updated_at.

El propietario observó GET 200/404/200 para 118/119/120 y 404 para el control
inexistente. Los dos 404 mostraron la página genérica, contenido correcto y
datosProductoVisibles:false, con igual hash del texto visible normalizado.
Las cabeceras de ambos 404 quedaron confirmadas, aproximadamente a las 17:08
hora de Monterrey. Pausar no eliminó ni rotó el token. No se reactivó 119 ni se
probó aquí la reactivación.

### W2-Q1D-B — revocación exclusiva de 120: PASS funcional completo

Claude Code reportó la revocación administrativa autorizada en STAGING: un bloque
DO atómico como postgres eliminó exactamente la fila de enlaces_compartidos
identificada conjuntamente por listing_id=120, user_id IS NULL y el token original
del fixture 120. Guardas: una fila eliminada e inventario final de dos; una excepción
habría revertido la operación. No fue una escritura ejecutada por Codex.

La publicación 120 permaneció activa y conservó título, precio, vendedor, imagen,
moderación y updated_at. No hubo cambios de publicaciones, generación de tokens ni
escrituras adicionales, según Claude. Inventario final: solo los enlaces originales
de 118 (activa) y 119 (pausada). Claude consultó share_preview por SQL como postgres:
118 disponible:true con título y 450 MXN; 119, token revocado de 120 y control
inexistente disponible:false, con el mismo resultado no disponible. No son respuestas
observadas directamente de la Edge Function.

Entre aproximadamente las 17:16 y 17:17 de Monterrey, el propietario observó los
cuatro GET de la matriz consolidada. ChatGPT revisó las cinco capturas aportadas.
Los tres 404 dieron paginaGenerica:true, contenidoCorrecto:true,
datosProductoVisibles:false y resultado:PASS. El nuevo 404 de 120 conservó las
cabeceras requeridas, incluida la CSP, con CF-Cache-Status ausente. No quedan
pendientes de cabeceras en D-B. Revocar este token no impide generar posteriormente
otro para una publicación activa; esa regeneración no se probó ni se realizó.

### Matriz consolidada y respuesta genérica

Todos los status web siguientes proceden de la evidencia manual del propietario:

| Fixture | Q1C positiva | Q1D-A pausa | Q1D-B revocación | Estado final reportado por Claude |
|---|---|---|---|---|
| 118 Mochila | 200 | 200 | 200 | Activa, enlace original intacto |
| 119 Calculadora | 200 | 404 | 404 | Pausada, enlace original intacto |
| 120 Libros | 200 | 200 | 404 | Activa, enlace eliminado |
| Control inexistente | No incluido en la prueba positiva | 404 | 404 | No disponible según SQL en D-B |

Q1C: 3/3 positivas PASS. Q1D-A: 4/4 navegaciones PASS. Q1D-B: 4/4 navegaciones
PASS. Las solicitudes no se suman a los conteos de pruebas automatizadas locales.
Los negativos muestran «Este enlace no está disponible» y el texto genérico
«Puedes conocer más de RLVO en nuestro sitio». Hash SHA-256 compartido del texto
visible normalizado en D-A y en los tres 404 de D-B:
`486a15f96b1e9b8d33994bf7188d8868870efe5170f1e77859943ccad462e6b0`.
Esto acredita igualdad del texto visible normalizado, no identidad byte a byte del
HTML completo, de todas las cabeceras o de toda la metadata.

### Cabeceras confirmadas y límites del cierre

El propietario comprobó manualmente las Response Headers del documento principal:
los tres 200 de C, ambos 404 de D-A y el nuevo 404 de 120 en D-B. Valores requeridos:

- Content-Type: text/html; charset=utf-8.
- Cache-Control: no-store.
- X-Robots-Tag: noindex, nofollow, noarchive.
- Referrer-Policy: no-referrer.
- X-Content-Type-Options: nosniff.
- CSP: default-src 'none'; script-src 'none'; img-src 'self'; font-src 'self';
  connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';
  style-src 'self' con hash SHA-256 autorizado del CSS estático.

CF-Cache-Status estuvo ausente en los tres 200 de C y en el 404 de 120 de D-B;
no se extiende esa observación a respuestas donde no se reportó su valor. En D-B
las cabeceras del nuevo 404 coincidieron con los controles confirmados en D-A;
no se atribuye una nueva inspección completa de headers a los otros casos de D-B.

El PASS cierra únicamente C, D-A y D-B en su alcance. No se midió un tiempo exacto
de propagación ni efectos sobre cachés de terceros: nuevas navegaciones observaron
el estado esperado. Privacidad: patrones y estructura del HTML, no auditoría de
seguridad completa. No hubo correlación directa de logs o JSON de la EF, ni prueba
positiva alojada de perfiles. HEAD y métodos/variantes autenticados no completados
en las etapas previas no se presentan como probados; la cobertura local es distinta.
Se conservan las limitaciones de Miniflare y los pendientes jurídicos ya documentados.

La consolidación documental no repitió pruebas ni ejecutó escrituras de infraestructura
o datos. La eliminación de 120 es la acción previa de Claude autorizada por el propietario.
Las siguientes fases requieren autorización separada; ninguna queda iniciada aquí.

## Entradas y política
worker/index.ts conserva exclusivamente la política local de W1, aunque un binding diga staging.
worker/handler.ts comparte routing, contrato, render y logs saneados. Es la única ampliación
de módulos respecto al inventario inicial. worker/staging.ts es la entrada dedicada y
worker/staging-policy.ts fija el ambiente y los destinos. No existe activación PROD.
El único pin aceptado por la entrada desplegable está compilado en código:
SHA-256 del endpoint canónico HTTPS completo =
0a62d2a6775b0fb0b902127154b55adeae913273597a6af5047aa13c4dfdb1ab.
Procedencia documental: backend main 40f2b46647cd5ad787f9d8e0ff4b861780f0b5d5,
docs/architecture/database/share-links.md y testing.md. No es un secreto ni sustituye autenticación.
HTTPS, host Supabase canónico, ruta exacta /functions/v1/share-preview; sin credenciales,
puerto explícito (incluido 443), query, fragment, alias o normalización de la cadena.
Web Crypto valida SHA-256 antes de enviar cualquier header de autenticación.
El pin no se lee de bindings, Host, headers ni query. El factory puro admite una política
de código sintética en tests; la configuración desplegable selecciona siempre el default sellado.
No hay flag runtime para seleccionar el factory de tests ni pins alternativos.

Nombres: SHARE_LINKS_ENABLED, SHARE_LINKS_ENV, SHARE_LINKS_PUBLIC_ORIGIN,
SHARE_PREVIEW_URL, SHARE_PREVIEW_KEY_CURRENT, ASSETS.
Ausente/false => 404 uniforme sin backend; true requiere configuración válida completa.
Inválida => 503 genérico sin backend. Solo la entrada STAGING admite staging.
Origen STAGING exactamente igual al aprobado; no deriva de Request URL ni Host/Forwarded.
Origen ausente/incorrecto => metadata absoluta omitida; no hay fallback a site.url.
Conoce RLVO conserva el enlace oficial desde site.ts; no hay redirección automática.
Contrato, token, datos mínimos, imagen oficial, 4096 bytes, timeout HTTP total de seis segundos,
cancelación, no reintentos y no redirects conservados. Ningún header del visitante se reenvía.
Headers nuevos desde cero; se descartan Set-Cookie, sb-error-code y headers internos.
HTMLRewriter usa texto/atributos seguros. Sin scripts, analytics, cookies propias o localStorage.

## Configuración inicialmente apagada
wrangler.share-links.staging.jsonc: nombre exclusivo, worker/staging.ts, sin routes ni envs,
workers_dev=false, preview_urls=false, observability.enabled=false, activación false y endpoint vacío.
ASSETS apunta exclusivamente a .wrangler/share-links-staging-assets, ignorado por Git.
run_worker_first=true en este recurso aislado: cada petición atraviesa la entrada antes
de normalizaciones de Static Assets. La plantilla solo es accesible por ASSETS internamente.
No se conecta Git integration ni Deploy Hooks. El archivo local no crea ni cambia esos recursos.

## Assets y guard
prepare-staging-assets.mjs recorre referencias reales de plantilla/CSS y copia solo plantilla,
fuentes/CSS necesarios, logo, favicon y OG; genera robots bloqueante y 404 genérico.
Rechaza symlinks, recursos externos, scripts, analytics, imports CSS, sourcemaps y extras.
Audita igualdad del inventario y dependencias, y hashes reproducibles.
check-staging-target.mjs exige estructura exacta de la configuración apagada/cerrada,
nombre, entrada, assets, Worker-first y ausencia de overrides. Nunca ejecuta deploy.
Es una protección operativa: no impide que un operador ejecute manualmente otro comando.
No se modifica el auditor estático ni se añade una excepción de analytics.

## Comandos locales
Node 22.21.1, npm 10.9.4 y Wrangler 4.160.1 del lockfile, sin nuevas dependencias.
- LEGAL_BASELINE_REF=bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 npm run build
- node scripts/share-links/prepare-staging-assets.mjs
- node scripts/share-links/check-staging-target.mjs
- npm run check:worker
- npm run test:share-links
- npm run test:share-links:visual
- node tests/share-links/staging-visual.mjs
- npm run test:qa
- LEGAL_BASELINE_REF=bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 npm run ci:share-links
Antes de la suite W2 debe existir el paquete mínimo. El pipeline integral reinstala npm ci
por diseño propio y no se modificó para evitarlo. No son comandos de deployment.

## Aislamiento de las pruebas
node:test y workerd real mediante Miniflare/esbuild incluidos en las dependencias fijadas
de Wrangler; no se añadió un SDK ni otra dependencia directa.
Miniflare usa convertV4MiniflareOptions de la versión instalada. cf=false evita obtener
datos de Cloudflare. Cada fetch global del Worker pasa por un handler Node en memoria;
el handler no llama a fetch/DNS/sockets y rechaza todo destino no esperado. Sin fallback de red.
Las peticiones HTTP de prueba y el navegador apuntan exclusivamente a 127.0.0.1.
Los tests generales usan endpoint/pin sintéticos mediante un módulo de prueba compilado.
La entrada sellada también se prueba contra intentos de override runtime.
Claves ficticias y tokens sintéticos; ningún token histórico S3-D.
Comprobación adicional de entrada sellada: endpoint aprobado obtenido de la referencia documental
solo en memoria y fetch interceptado antes de red; no se publicó el hostname ni se usó una clave real.
El fetcher Node de Miniflare no propaga a sus contadores la cancelación del peer. No se afirma
medirla allí: el deadline runtime se verifica por HTTP; abort/cancel se comprueban en el cliente
compartido con configuración STAGING y en la regresión W1 de conexiones HTTP reales en loopback.
Los recursos y temporizadores se cierran en finally. Los artefactos son ignorados.
No equivalen a validación TLS, gateway, credenciales o contrato desplegado en Supabase,
ni a validación Cloudflare alojada, Access o crawler WhatsApp.

## Política por ambiente y operación alojada
La política operativa vigente es **LEG-DEV-01**, integrada en backend mediante
[PR #25](https://github.com/Enrique-Macias/Relevo-Marketplace/pull/25), merge
`971a855a654a97359aac1d0030a66fa9418f15db` (commit documental
`5ec64ece0833a25a003b50b44d82576937a5b8c2`). Fuentes de esa versión integrada:
[política central en PRE_LAUNCH_DEBT](https://github.com/Enrique-Macias/Relevo-Marketplace/blob/971a855a654a97359aac1d0030a66fa9418f15db/docs/PRE_LAUNCH_DEBT.md#leg-dev-01--desarrollo-técnico-frente-a-pendientes-jurídicos--decidida-propietario-técnico),
[regla por ambiente de Share Links](https://github.com/Enrique-Macias/Relevo-Marketplace/blob/971a855a654a97359aac1d0030a66fa9418f15db/docs/architecture/database/share-links.md#dependencias) y
[LEGAL_FEATURE_REGISTER](https://github.com/Enrique-Macias/Relevo-Marketplace/blob/971a855a654a97359aac1d0030a66fa9418f15db/docs/LEGAL_FEATURE_REGISTER.md#enlaces-compartibles-share-links).
Esta política sustituye la exigencia anterior de completar la revisión jurídica de
lanzamiento antes de cualquier deployment STAGING privado:

- Desarrollo local, implementación y pruebas automatizadas no esperan los pendientes
  jurídicos de lanzamiento.
- W2-D1 puede crear y desplegar el Worker independiente con ingreso cerrado e integración
  apagada, endpoint vacío, sin credenciales Supabase ni datos de usuarios, con autorización
  de infraestructura para cada acción y sin modificar producción.
- STAGING privado y pruebas técnicas con datos sintéticos pueden avanzar con aislamiento
  de PROD, controles de seguridad vigentes y autorización técnica específica de cada fase.
- La exposición anónima temporal exclusivamente sintética, por ejemplo para WhatsApp,
  requiere autorización separada con alcance y retiro definidos; no es lanzamiento público.
- Los datos reales de testers o socios también son datos reales en STAGING: se deben evaluar
  y respetar las condiciones aplicables a esa prueba. Una build de fase D que genere enlaces
  de esas personas no constituye por sí sola una prueba sintética.
- PROD y lanzamiento o apertura de enlaces a usuarios reales requieren todas las entradas
  jurídicas aplicables en **VERIFIED**, con la evidencia correspondiente a su tipo.
  VERIFIED no es requisito previo de las pruebas técnicas autorizadas anteriores.
- LEG-DEV-01 no suspende obligaciones, controles ni condiciones de documentos protegidos.
  Si se incorporan formularios, analytics, waitlist o cookies no esenciales, sigue vigente
  la condición de revisión previa a deployment indicada en PRIVACY_SPEC.
- Aprobación técnica, merge, deployment STAGING y pruebas sintéticas no equivalen a
  aprobación jurídica ni cambian estados del registro. **LEG-SL-01 a LEG-SL-06 siguen
  en PENDING**; el registro central no se duplica ni se cierra desde este repositorio.

Las autorizaciones permanecen separadas: W2-D1 cerrado/apagado; W2-A1 Access e ingreso
privado; W2-S1 credenciales server-side y conexión STAGING; W2-Q1 fixtures sintéticos;
W2-Q2 exposición temporal y WhatsApp; fase D móvil y PROD. Esta sección conserva
las condiciones por ambiente, no una autorización permanente. La evidencia histórica
de W2-I1/F1 y la ejecución alojada fechada se registran por separado.
Nunca recuperar la clave desde Supabase ni copiar secretos al repositorio/build.
Access puede introducir autenticación/cookies de su capa; no son cookies del Worker.
WhatsApp necesita una exposición anónima temporal separada, expresamente autorizada,
incluyendo OG y assets, sin bypass por User-Agent. workers.dev puede bloquear crawlers.
Rollback: versión STAGING apagada y cierre de ingreso; limpieza exacta de fixtures, Secret
y recurso solo con autorización. No tocar producción ni rotar claves backend automáticamente.
no-store/noindex no borran cachés de terceros. Observability apagado no garantiza ausencia
de registros de infraestructura. Logs propios solo resultado, status y duración.

## Pendientes — PL-085 ABIERTO

- W2-Q1E: prueba positiva de perfil y limpieza autorizada de fixtures. W2-Q1 no
  está cerrado en su totalidad; no crear ni limpiar datos sin el alcance aprobado.
- W2-Q2: preview real de WhatsApp mediante un método aprobado y acotado que no
  abra STAGING indiscriminadamente, con controles y retiro definidos. Sin bypass
  por User-Agent ni eliminación automática de Access. No se ha probado el crawler.
- Integración móvil (fase D), asociaciones de enlaces y PROD: no iniciados aquí.
- Actualización jurídica de lanzamiento según LEG-DEV-01: LEG-SL-01 a LEG-SL-06
  siguen PENDING, con 23 marcadores jurídicos y sin modificar el registro central.
- Visibilidad anónima y bloqueos bilaterales, logs de URLs/tokens, cachés de
  terceros, www/apex y analytics existente siguen pendientes.

El cierre técnico parcial no constituye aprobación jurídica ni autorización PROD.

## Evidencia histórica W2-I1 (anterior a F1)
Estos resultados corresponden a los bytes anteriores a la corrección; no sustituyen la nueva
validación. Copia histórica ignorada: qa/share-links-w2-history/w2-i1/.
Pipeline ci:share-links PASS: CI 216/216, legales 44/44 y Share Links 269/269 (119 W1 + 150 W2).
QA 93/93 PASS por separado. Total 622 pruebas distintas; repeticiones no sumadas. Cero fallos,
omisiones, cancelaciones o pendientes en los resultados finales.
Astro check: 102 archivos, cero errores/warnings/hints. Typecheck Worker PASS.
Builds preview y producción, auditorías estática/branding/legal y HTTP de ambos PASS:
seis páginas 200, descargas exactas, manifest y 18 versiones inexistentes 404 en cada ambiente.
Las 73 fuentes protegidas y las 13 entradas vigiladas conservan su integridad. Cero releases,
23 marcadores, registro/lock vacíos y punteros null. Los marcadores y preview sin sitemap
indexable producen los warnings esperados de build, no aprobación jurídica.
Paquete mínimo: 8 archivos reproducibles por hashes, sin páginas legales/landing, JS, maps ni extras.
Guard positivo y negativos PASS, incluido Worker-first y overrides por argv/environment.
Visual: 8 casos W1 + 8 STAGING a 360/390/768/1280, sin overflow ni infracciones/incomplete axe,
foco visible, targets táctiles y DOM XSS verificados. Cero cookies, errores CSP y requests externos.
Se inspeccionaron capturas STAGING móvil y escritorio; no es certificación WCAG ni WhatsApp real.
Chromium headless shell 1248 compatible se copió de la instalación existente al qa/browsers de W2;
no se cambió el navegador original ni se descargaron nuevas herramientas.
Incidencias locales resueltas: formato Miniflare mediante su conversor oficial, import puro sin
acoplar site.ts/JSON, representación de bindings ausentes en el fixture y selección de caché browser.
Un reinicio interrumpió una corrección antes de ejecutarse; se verificó el estado y se retomó.
No hubo cambios en controles protegidos para resolver esos fallos.
Evidencia local ignorada: qa/share-links-w2/validation-summary.json, qa/share-links-w2/visual.json,
qa/share-links/visual.json y logs .wrangler/w2-*.log. No son resultados de GitHub Actions.
No se ejecutaron commits, push, PR, despliegues ni conexiones reales a STAGING/PROD.

## Corrección W2-F1 y revisión final
W2-R1 reprodujo un defecto de empaquetado: una URL HTTPS externa con espacio inicial
superaba el filtro negativo. URL eliminaba el espacio, y el preparador descartaba el origen
al conservar únicamente pathname. Un recurso externo cuyo pathname coincidía con el logo
se aceptaba tanto al preparar como al auditar, conservando la URL externa en el HTML.
Se reprodujo antes de corregirlo con un fixture local sintético: ocho archivos aceptados,
referencia externa conservada, cero solicitudes externas. El paquete legítimo no se modificó.
La CSP no corrige un paquete con referencias incorrectas.

Ahora se valida la cadena completa con una gramática positiva ASCII antes de usar URL:
segmentos locales con letras, dígitos, guion, guion bajo y punto interior; raíz absoluta local
o referencia relativa (incluido ./ inicial para CSS). Sin espacios ni controles en ninguna
posición, esquemas, //, backslashes, entidades, porcentajes, query, fragmento ni segmentos
`.` o `..`. No se aplica trim ni decoding para convertir una referencia inválida en válida.
Tras resolver contra un origen interno fijo se exige igualdad de origen y ausencia de
credenciales, puerto, query y fragmento, antes de extraer pathname y comprobar el inventario.
La lectura comprueba cada componente y rechaza symlinks; no se amplió la lista de assets.

El auditor vuelve a leer las referencias realmente conservadas: img src; link href para
icon, stylesheet y preload; url() en bloques style y CSS locales referenciados. Conserva
el argumento completo, incluso espacios dentro de comillas, y rechaza url() malformado.
El subconjunto HTML/CSS de la plantilla compilada es deliberadamente limitado: se rechazan
atributos duplicados o sin comillas con valor, srcset/imagesrcset, estilos en atributos,
otros elementos/atributos de carga, CSS escapes/comentarios/imports/image-set y sintaxis
no soportada. No es un parser general de HTML/CSS ni un sanitizador genérico de SVG.
Nuevas superficies de carga requieren revisión explícita; no se ignoran silenciosamente.
Los href de navegación voluntaria y canonical, y los valores de metadata, no se tratan
como cargas automáticas del navegador. El enlace oficial Conoce RLVO permanece intacto;
el renderer sigue construyendo la metadata dinámica con el origen STAGING aprobado.

Regresión F1: 31 referencias inválidas aplicadas a tres superficies, comprobadas tanto
antes de crear la salida como mediante mutación de un paquete ya generado de ocho archivos.
Incluye el caso original, controles iniciales/finales, protocolo relativo, host con pathname
idéntico, credenciales, puertos, otros esquemas, origen interno absoluto, traversal,
codificaciones simples/dobles, entidades, query y fragmento. Once casos adicionales
rechazan superficies no soportadas; otro audita contenido CSS local y otro comprueba
referencias positivas, reproducibilidad, robots, 404 y navegación. Son 106 pruebas nuevas.
El preparador no realiza fetch ni resuelve DNS; los hosts sintéticos solo aparecen como
contenido de archivos locales. Las pruebas no solicitan esas URLs.

Los ocho archivos legítimos conservan exactamente tamaño y SHA-256 de W2-I1, incluida
la plantilla, dos fuentes, logo, favicon, OG, robots y 404. No cambiaron sus bytes.
La corrección modifica solo prepare-staging-assets.mjs, staging-assets.test.mjs y este
documento respecto a W2-I1. Worker, pin, configuración, guard, contrato y headers permanecen
idénticos. No añade dependencias, excepciones de auditoría ni cambios críticos/jurídicos.

## Validación nueva W2-F1
Pipeline integral ci:share-links PASS sobre el preparador y pruebas corregidos: CI 216/216,
legales 44/44, Share Links 375/375 (119 W1 + 150 W2-I1 + 106 F1). QA 93/93 por separado.
Total 728 pruebas distintas, sin sumar repeticiones: cero fallos, omisiones, cancelaciones
o pendientes. La suite focalizada assets/guard 145/145 es un subconjunto de Share Links.
Astro check: 102 archivos, cero errores/warnings/hints; typecheck Worker PASS.
Builds producción/preview, auditorías estáticas/branding/legales y HTTP PASS. En cada build:
seis páginas 200, descargas exactas, manifest correcto y 18 versiones inexistentes 404.
Visuales nuevos: 8 W1 y 8 STAGING, publicación/perfil a 360/390/768/1280; sin overflow,
infracciones/incomplete de axe, cookies, errores CSP ni requests externos. DOM XSS y foco PASS.
Se inspeccionaron capturas nuevas STAGING móvil/escritorio. No es certificación WCAG.
73 fuentes protegidas y 13 entradas vigiladas intactas, incluidos bytes y metadata vigilada;
cero releases, 23 marcadores y punteros null. Los warnings legales y sitemap vacío de
preview siguen siendo los esperados. Cero cambios críticos o jurídicos según la política base.
Revisión W2-R1 completada: entradas/políticas independientes, pin/origen estrictos,
Worker-first, plantilla bloqueada, guard, contrato, límites, headers y configuración cerrada
sin regresiones. No se requiere autorización CI externa para estos 15 archivos.
Se conserva la limitación de cancelación del peer en Miniflare descrita arriba; ninguna
prueba alojada ni conexión real a STAGING/PROD fue realizada para resolverla.
Evidencia nueva: qa/share-links-w2/validation-summary.json, visuales en sus directorios
y logs .wrangler/w2-f1-*. La evidencia W2-I1 permanece como histórica y no se contó de nuevo.

## Inventario final
Modificados: worker/config.ts, worker/index.ts, worker/render.ts.
Nuevos: worker/handler.ts, worker/staging-policy.ts, worker/staging.ts,
wrangler.share-links.staging.jsonc, scripts/share-links/prepare-staging-assets.mjs,
scripts/share-links/check-staging-target.mjs, tests/share-links/staging-config.test.mjs,
tests/share-links/staging-assets.test.mjs, tests/share-links/staging-fixture.mjs,
tests/share-links/staging-runtime.test.mjs, tests/share-links/staging-visual.mjs y este documento.
15 archivos en total: 3 modificados y 12 nuevos. Ninguna dependencia ni control crítico cambió.
Clasificación aplicada al diff de trabajo y nuevos archivos desde ci/control-policy.json de la base;
no se crearon commits sintéticos para invocar inspectControls sobre cambios sin commit.


## W2-A1 y controles locales de activación privada — estado histórico
W2-D1 creó manualmente rlvo-share-links-staging: versión
7dea9d51-1fcf-47c2-b342-95935d030ea5, deployment
65d6f98f-d442-467c-8368-533bb23f3d13. El propietario habilitó después workers.dev
bajo Access; en ese momento previews estaban apagadas, sin routes ni custom domains.
Al cierre de esa fase la integración estaba false, con endpoint vacío y sin Secrets
de aplicación; todavía no se había demostrado conexión Worker → Supabase. El estado
posterior se registra en W2-S1 al inicio de este documento. Estas son evidencias
históricas, no un inventario en tiempo real.

W2-A1 quedó verificado con tres fuentes diferenciadas:
- Propietario: capturas/confirmación de Zero Trust Free, All traffic sobre este Worker,
  política Cloudflare account members — Allow, sesión de 24 horas y acceso autenticado
  que devuelve la vista deshabilitada. No es una allowlist individual de correo.
- HTTP anónimo: 16 solicitudes GET/HEAD de raíz, p/u sintéticos, OG, logo, plantilla y
  paths codificados respondieron 302 hacia yellow-mountain-069e.cloudflareaccess.com,
  sin seguir redirects, enviar credenciales ni recibir contenido protegido.
- API: cuenta con huella 36da4df1ff8cc468, subdominio esperado, un único miembro aceptado
  correspondiente al propietario, ingreso principal habilitado y previews deshabilitadas.
  La lista clásica de aplicaciones Access devolvió vacía: no demuestra ausencia de la
  protección Workers ni constituye inventario exhaustivo de políticas. Antes hubo 403;
  no se ampliaron permisos. La confirmación de política procede del propietario.

Añadir miembros a esa cuenta puede ampliar quién accede. Cualquier miembro adicional,
política más específica, bypass o alcance distinto exige detenerse antes de conectar
Supabase y revisar la autorización. Access introduce su propia autenticación/cookies;
no son cookies del Worker. No extraer cookies, JWT, OTP ni sesiones del navegador.

### Configuración separada, sin publicar el endpoint
wrangler.share-links.staging.private.template.jsonc conserva el destino STAGING y
contiene un marcador, nunca un endpoint o credencial real. No es un archivo desplegable
aprobado: el marcador no supera el pin del Worker. El preparador lee exclusivamente un
objeto JSON con la clave endpoint desde stdin (UTF-8, máximo 2048 bytes); no lee variables
de entorno, argumentos de endpoint, archivos de claves ni el backend por red.
Reutiliza endpointMatches y STAGING_ENDPOINT_SHA256 del módulo puro ya integrado.
Solo acepta la representación canónica HTTPS exacta fijada por ese pin, sin redirects
permitidos, credenciales, puertos explícitos, query, fragmento ni variantes ambiguas.
No hace fetch ni verifica redirects mediante llamadas reales; el cliente conserva redirect:manual.

La salida determinista .wrangler/share-links-staging-private/wrangler.jsonc está ignorada
por Git y se crea con permisos 600. El main y assets.directory se resuelven respecto de
ese archivo generado: ../../worker/staging.ts y ../share-links-staging-assets. No se
copia el endpoint a Git/documentación/logs. No hay account_id, claves ni configuración PROD.

Comandos locales, desde la raíz del worktree, Node 22.21.1:
```sh
node --experimental-strip-types scripts/share-links/prepare-staging-private-config.mjs
node --experimental-strip-types scripts/share-links/check-staging-private-target.mjs
node scripts/share-links/check-staging-target.mjs
```
El primer comando recibe por stdin JSON preparado de forma segura con el endpoint
previamente contrastado con la fuente STAGING autorizada; no pegarlo como argumento ni
incluir credenciales. Aquí no se prescribe una CLI emisora inexistente ni una variable
sin validar. La entrada se valida antes de crear la salida. El ejemplo no ejecuta deploy.

El guard privado relee plantilla y configuración canónica, rechaza symlinks, archivos
locales .env/.dev.vars y redirecciones de configuración Wrangler, argumentos/overrides y
selectores CF_/CLOUDFLARE_/WRANGLER_/SHARE_LINKS_/SHARE_PREVIEW_. Solo permite las dos
opciones de desactivar telemetría en false. Exige la estructura exacta del modo privado,
ASSETS con inventario y ocho SHA-256 W2-F1, Worker-first y ausencia de bindings extra,
routes, custom domains, triggers, entornos, Secrets literales y cambios de runtime.
La configuración cerrada original y su guard permanecen intactos y los modos se rechazan
mutuamente. Los factories puros con pin sintético solo sirven a tests de módulo; ningún
argumento, binding o variable del CLI puede seleccionar otro pin.

### Dos puertas diferentes antes de cualquier deployment futuro
**A — local:** preparar y auditar assets, materializar desde la plantilla, ejecutar el
guard privado y verificar integridad de la base/CI/árbol revisado. Su salida es LOCAL_ONLY,
REQUIRED_NOT_PERFORMED para la verificación alojada y deploymentAuthorized:false. No es
una aprobación de infraestructura ni prueba de Access, cuenta, membresía o credencial.
No se añade un wrapper de deployment, flag de bypass o autorización automática.

**B — alojada, obligatoria y reciente:** bajo una autorización posterior, confirmar con
Wrangler fijado y lecturas API la cuenta efectiva (huella indicada), nombre, versión,
variables iniciales, Secret por metadata, workers.dev, previews, rutas, dominios y el
estado inicial de producción. Verificar Access All traffic para este recurso, política
aprobada, membresía sin identidades adicionales y ausencia de bypass/políticas que amplíen
acceso. Cuando la API no exponga completamente la protección Workers o devuelva 403,
obtener evidencia actual del propietario sin ampliar OAuth ni crear tokens.
Repetir GET/HEAD anónimos de todas las superficies, sin redirects, y la prueba autenticada
oficial del propietario. Un PASS local o un documento de evidencia antiguo no satisface B.
Si no puede acreditarse B, no configurar Secret ni desplegar. El guard operativo no impide
que un operador ejecute por su cuenta comandos fuera de este procedimiento.

### Orden futuro de Secret y activación (requiere autorización alojada)
1. Completar A y B; integración todavía false y endpoint vacío. Reconfirmar producción.
2. Validar la copia STAGING de la clave (dueño, 600, formato como datos, nunca source shell).
   No recuperarla ni rotarla en Supabase. Transportar solo la CURRENT mediante memoria/stdin,
   con tracing apagado, al comando fijo, nunca en argumentos, archivos del repo o logs:
   `./node_modules/.bin/wrangler secret put SHARE_PREVIEW_KEY_CURRENT --config wrangler.share-links.staging.jsonc`
3. secret put de Wrangler 4.160.1 envía una escritura de Secret al recurso existente; crea
   una nueva versión y la despliega inmediatamente. Registrar sus IDs y comprobar en API
   el estado efectivo, integración apagada, endpoint vacío y Access/ingreso/previews, y repetir
   pruebas anónimas. No asumir que el archivo local describe lo que ocurrió en servidor.
4. Repetir A y B inmediatamente antes de la única activación autorizada. Solo entonces:
   `./node_modules/.bin/wrangler deploy --config .wrangler/share-links-staging-private/wrangler.jsonc`
   Sin name/env/var/route/keep-vars ni otros overrides. Nunca desplegar la plantilla ni PROD.
   Wrangler aplica workers.dev y preview URLs como parte de triggers, no de forma atómica
   con la carga. Registrar versión/deployment y comprobar Access otra vez por API/evidencia
   del propietario y HTTP anónimo. No asumir que un deploy conserva toda configuración Access.
5. El código fijado de Wrangler 4.160.1 usa keepSecrets:true al desplegar. Aun así, confirmar
   exclusivamente metadata del binding y no asumir que una configuración cerrada borra la
   clave o que esta existe por aparecer en un inventario previo. Nunca imprimir su valor.
6. Verificar endpoint/pin, true/staging, origen exacto, ASSETS, sin rutas/domains/previews,
   Observability apagado, cuenta y producción intactas. Pruebas autenticadas del propietario
   solo con p/u sintéticos inexistentes; no crear fixtures ni reutilizar enlaces S3-D.
   Un 404 puede proceder de integración apagada o del backend: por sí solo no demuestra
   conexión. Acreditar flujo activo y estado/contrato disponibles mediante evidencia segura;
   si es insuficiente, reportar límite sin inventar éxito ni habilitar logs/Observability.

### Mitigación y retorno explícito a apagado
Ante exposición, pérdida de Access o resultado ambiguo: detenerse y consultar estado.
**Primero cerrar ingreso:** deshabilitar únicamente workers.dev del Worker STAGING mediante
el mecanismo oficial autorizado y mantener previews false; comprobar configuración efectiva.
No tocar rutas/domains de producción ni borrar Worker, aplicaciones Access o claves backend.
**Después desactivar integración:** bajo el alcance de rollback aprobado, ejecutar el guard
cerrado y desplegar exclusivamente wrangler.share-links.staging.jsonc; verificar false,
endpoint vacío, workers.dev/previews false, rutas/domains vacíos, Access y producción.
No repetir un deploy ambiguo ni asumir atomicidad. Al ser dos pasos puede haber un estado
intermedio con integración activa pero ingreso cerrado; comprobarlo y reportarlo.
**Secret por separado:** el deploy cerrado no es una orden de borrado de Secret. Inventariar
su nombre sin valor; eliminación/rotación requiere autorización específica. Si otra operación
puede afectar recursos no previstos, detenerse tras cerrar ingreso. No modificar producción.

### Alcance histórico de la implementación S1-I1
Solo controles locales: no lee la clave real, no configura Secrets, no llama a Supabase,
no cambia Access/miembros/hostnames ni despliega. LEG-SL-01 a LEG-SL-06 siguen PENDING bajo
LEG-DEV-01; no se otorga aprobación jurídica de lanzamiento. W2-Q1, fixtures sintéticos,
WhatsApp público, fase D móvil y PROD permanecen pendientes de autorización separada.

### Validación local S1-I1 — anterior a la activación alojada
CI 216/216, integridad/contrato legal 44/44, QA 93/93 y Share Links final 498/498
(375 existentes + 123 nuevas): 851 pruebas distintas, sin sumar repeticiones; cero fallos,
omisiones, cancelaciones o pendientes. Se conservan las 106 regresiones F1. El pipeline
ci:share-links completó sus etapas base y una primera corrida Share Links de 493; después
de las últimas cinco regresiones se repitieron Share Links completo (498), Astro check y
typecheck sobre los bytes finales. Astro: 105 archivos, cero errores, warnings o hints.
El primer check detectó un import de prueba sin uso; se utilizó en la comprobación positiva
y el check final quedó limpio. No se modificaron reglas ni auditorías para resolverlo.

Builds producción/preview, auditorías estática/marca/legal y HTTP local de ambos PASS.
Visuales: ocho W1 + ocho STAGING a 360/390/768/1280, teclado/foco/axe/DOM XSS, sin cookies,
errores CSP o solicitudes externas inesperadas. No son pruebas de WhatsApp ni certificación
WCAG. El deadline/cancelación conserva el límite de Miniflare documentado anteriormente.

Las pruebas nuevas usan destinos/pins sintéticos en el factory puro; verifican el CLI
sellado, stdin acotado, normalización real de Wrangler con red bloqueada, rechazo cruzado
de modos, inventario y hashes, selectors/overrides, dotenv, JSON ambiguo, symlinks incluso
colgantes y hardlinks de salida. La escritura no sigue symlinks y restaura permisos 600.
La configuración sellada también se materializó con el endpoint documental validado solo
en memoria/stdin, sin red ni credenciales: guard privado LOCAL_ONLY PASS y guard cerrado PASS.
Ocho assets, 107948 bytes y todos los SHA-256 W2-F1 intactos.

El inspector confiable de la base se ejecutó en un repositorio temporal de validación
sobre el árbol proyectado, con contexto de PR sintético para diagnóstico, sin crear un PR
ni una autorización: cero cambios críticos y jurídicos. Los archivos base ajenos a este
documento, incluida la colección protegida, permanecen iguales. Las 13 entradas vigiladas
conservan bytes y metadata; cero releases, 23 marcadores y punteros null. No cambian runtime,
dependencias, workflows, política CI ni configuraciones cerrada, W1 o producción.

Son resultados locales, no nuevas ejecuciones GitHub Actions. La lectura API final de esta
fase confirmó la versión/deployment D1 de STAGING y su estado apagado con endpoint vacío,
sin binding Secret; workers.dev habilitado por el propietario y previews false. Producción
conserva su versión/deployment. No se realizaron escrituras alojadas ni lecturas de la clave.
La evidencia detallada, logs/capturas y configuración generada quedan ignorados fuera del commit.
