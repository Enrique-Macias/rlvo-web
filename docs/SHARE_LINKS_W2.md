# Share Links W2 — STAGING aislado, implementación local

## Alcance
Base web 77c60d349c1c81919a857783c7f942a57f808390 (árbol W1 24df02119dd459b7da7ade900022450f449cc816).
Worker previsto: rlvo-share-links-staging. Origen previsto aprobado:
https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev.
No se afirma que exista, esté asignado ni sea accesible. No se ha creado ni desplegado.
Producción rlvo-public-web, sus dominios, wrangler.jsonc y wrangler.share-links.jsonc permanecen intactos.

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

## Procedimiento alojado pendiente
Revisión jurídica antes de deployment según el contrato backend, incluida su aplicación
a STAGING privado. Después: recurso aislado con ingreso cerrado e integración apagada,
Access privado autorizado, comprobación del hostname y endpoint, Secret server-side
aportado por el propietario mediante canal seguro y pruebas negativas/sintéticas autorizadas.
Nunca recuperar la clave desde Supabase ni copiar secretos al repositorio/build.
Access puede introducir autenticación/cookies de su capa; no son cookies del Worker.
WhatsApp necesita una exposición anónima temporal separada, expresamente autorizada,
incluyendo OG y assets, sin bypass por User-Agent. workers.dev puede bloquear crawlers.
Rollback: versión STAGING apagada y cierre de ingreso; limpieza exacta de fixtures, Secret
y recurso solo con autorización. No tocar producción ni rotar claves backend automáticamente.
no-store/noindex no borran cachés de terceros. Observability apagado no garantiza ausencia
de registros de infraestructura. Logs propios solo resultado, status y duración.

## Pendientes
Revisión jurídica; visibilidad anónima y bloqueos bilaterales; 23 marcadores jurídicos;
logs automáticos de URLs/tokens; cachés WhatsApp; www/apex; analytics existente;
fase D móvil y PROD. Aprobación técnica no constituye aprobación jurídica.

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
