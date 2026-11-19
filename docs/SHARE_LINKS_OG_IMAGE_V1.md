# PL-085 — OG-06A: Worker OG Image V1 (local)

Estado: **LIMITED**. Implementación y pruebas locales; fotografías públicas no activadas.
Base verificada: `fb7c06a8e89cb46445b9347a4b977dc16c769f0e`, Share Links V1 y harness W2-Q2.
Rama: `feature/share-links-og-image-v1`. Consolidación local OG-06B, sin despliegue.
Validación STAGING sintética posterior (PASS, OG de vuelta en OFF) y configuración privada
de STAGING: ver `docs/SHARE_LINKS_OG_STAGING_INTEGRATION.md`. Sigue sin aprobación para PROD.

## Contrato consumido

Informes aportados por el propietario: OG-03C y OG-05/F2B (backend `2d0c712`,
precedido por `9645744` y `e822a81`). No se consultó ni modificó ese repositorio.

- Endpoint fijo: `POST /functions/v1/share-og-source`.
- Header: `X-RLVO-Og-Key`, independiente de la clave V1. El backend acepta CURRENT/NEXT;
  el Worker envía únicamente su clave de salida configurada. No intenta claves alternativas.
- JSON exacto, máximo 512 B: `{v:1,op:"rev",token}` o `{v:1,op:"bytes",token,rev}`.
- Token: 22 base64url; revisión: 32 hex minúsculas.
- `rev`: 200 `{v:1,disponible:true,imagen:true,rev}` o sin imagen
  `{v:1,disponible:true,imagen:false}`; 404 `{v:1,disponible:false}`.
- `bytes`: 200 JPEG/PNG/WebP, Content-Length exacto y X-RLVO-Og-Rev idéntico;
  también admite el JSON sin imagen. 409 exacto `{error:"rev_distinta"}`.
- 400/401/405/413/503, redirects, red, esquemas desconocidos y respuestas inválidas
  se convierten en fallo temporal público. Ningún header privado se reenvía.

El backend sigue siendo la única autoridad de disponibilidad, selección de portada,
moderación y SHA-256. No se reciben rutas, hashes de moderación ni ids internos.
`worker/share-preview.ts` no cambia. No hay Supabase SDK, URLs firmadas ni service_role.

## Activación cerrada

Las entradas normales `worker/index.ts` y `worker/staging.ts` mantienen OG siempre OFF,
incluso con todas las variables OG y cabeceras de loopback falsificadas. Una variable de
entorno o una petición no puede suministrar `SharePolicy.ogLocalTesting`.
Solo la entrada separada `worker/og-local.ts` fija esa capacidad desde código confiable.
La URL loopback es una validación de destino, **no** prueba del origen de red del cliente.
El servidor de pruebas debe escucharse exclusivamente en 127.0.0.1.

`SHARE_OG_ENABLED` ausente o `false` conserva el comportamiento anterior, sin llamadas OG.
Para ON en esa entrada local se exige simultáneamente:

- valor literal `true`, Share Links activo y ambiente `local`;
- origen confiable HTTP 127.0.0.1 con puerto y petición de ese mismo origen;
- endpoint OG exactamente en el mismo origen del endpoint preview local, con ruta fija;
- `SHARE_OG_KEY_CURRENT` válida, sin CR/LF y distinta de la clave de preview.

Un ambiente remoto o configuración incompleta queda inactivo (503 si se intenta usar el
opt-in local inválido). En las entradas normales se conserva el comportamiento V1.
No existe política de
activación OG para STAGING/PROD. `wrangler.jsonc`, el opt-in W1 y la configuración
STAGING no cambian. El nuevo `wrangler.share-links.og.local.jsonc` contiene solo
valores apagados, Images `remote:false`, sin claves ni endpoint real. **No desplegarlo.**

Esta autorización local implementa D-OG-5 como política provisional detrás de la bandera;
no aprueba formalmente D-OG-5 ni las decisiones de exposición pública D-OG-1 a D-OG-7.

## Rutas, HTML y errores

`/p/{token}/og/{rev}`, GET/HEAD, sin extensión, query (incluido `?` vacío), fragmento,
encoding `%`, barra final ni segmentos adicionales. El parser no decodifica ni normaliza.
La normalización efectuada antes de recibir Request.url queda fuera de su garantía.
Métodos distintos: 405. Rutas inválidas: 404, cero consultas OG.

HTML de publicaciones: primero preview V1 y luego `op:rev`, dentro del presupuesto
compartido de seis segundos de consultas. Solo después se renderiza. Un 404 de OG
descarta título/precio previos; un fallo técnico produce HTML 503 genérico sin metadata
social. Las cabeceras HTML existentes no cambian. Canonical y og:url siguen sin revisión.
og:image y twitter:image usan el origen confiable y la ruta revisionada. Perfiles intactos.
No hay snapshot atómico entre preview, rev y bytes: no se promete consistencia atómica.

Imagen pública, siempre `no-store`, noindex/nofollow/noarchive, no-referrer y nosniff:

- autorizada: 200 JPEG compuesto;
- disponible sin foto: 200 PNG de marca, byte a byte;
- no disponible: 404 vacío;
- revisión obsoleta: 409 vacío;
- error técnico, corrupción, saturación o composición fallida: 503 vacío, Retry-After: 5.

No se transforma un error temporal en fallback exitoso; no hay redirects ni retries.
HEAD ejecuta la misma validación/composición y omite el cuerpo. No hay Cache API, KV,
reutilización de autorizaciones ni caché interna de fuentes o derivados.

Cada imagen consulta `op:bytes`. Una revocación entre HTML e imagen se comprueba ahí.
Permanece la ventana backend G4 tras RPC#2, extendida por transporte/composición/entrega;
no se puede retirar una respuesta ya autorizada en curso ni copias de terceros.

## Cotas y composición

Cliente JSON: UTF-8 y esquema cerrado, máximo 512 B de respuesta. Fuente: máximo
5 242 880 B, lectura real acotada y cancelación al exceder o vencer plazo; Content-Length
obligatorio y exacto. Se validan MIME, revisión, contenedor y lados máximos de 4096 px.
No se inventa otra dimensión mínima: la autoridad de elegibilidad sigue en backend.
La validación estructural no sustituye decodificar píxeles; Images debe decodificar y
recodificar, nunca se sirve el original como alternativa.

La imagen dispone de un plazo total provisional de 15 s; la consulta fuente, 13 s.
Una composición en curso por handler/isolate, no límite global. El slot se libera al
terminar realmente el trabajo, incluso si el plazo público ya venció. Images no expone
cancelación de la operación: se descarta todo resultado tardío y se retiene el slot hasta
que termine. Las lecturas sí se cancelan. Salida acotada a 2 MiB (cota defensiva, no
objetivo de peso). No son límites de latencia/memoria certificados en infraestructura.

Images: `fit:pad`, 1200×630, fondo #F5FAF8, `metadata:none`, draw con PNG oficial a
32 px derecha/inferior y opacidad 1, composición over, JPEG calidad 85 y anim:false.
La foto permanece proporcional y sin recorte; el distintivo puede cubrir su esquina.

El SVG oficial `11_logo_horizontal_menta_sobre_verde.svg` permanece intacto. El generador
local rasteriza a 240×90 e incluye el PNG en `worker/og-badge.ts`, sin asset público nuevo.
No cambia el fallback `/og/rlvo-paleta-06.png` (15781 B, SHA-256
`43046d631a9a94648220ac8edceae8d4ef4f13baabc8cc9e3e8d838346f34093`).

Además de metadata:none, se eliminan todos los segmentos APP y COM del JPEG generado,
incluidos EXIF/XMP/GPS, comentarios y metadatos heredados. Solo se admite salida JPEG
estructuralmente válida 1200×630. Las pruebas inspeccionan bytes, segmentos y metadata.

## Validación reproducible, sin servicios remotos

Usar dependencias instaladas desde el lock o una copia local materializada. No reutilizar
enlaces de caché/dependencias que escriban en otros worktrees. No ejecutar npm ci ni
el pipeline ci:web si no está autorizado acceder al registro.

```sh
npm run build
npm run check
npm run check:worker
node scripts/share-links/prepare-og-badge.mjs --check
node --experimental-strip-types --test tests/share-links/og-core.test.mjs
node --experimental-strip-types --test tests/share-links/og-runtime.test.mjs
node scripts/share-links/test-og-negative.mjs
node scripts/share-links/og-reference.mjs
```

Para las suites históricas completas, preparar primero los assets y la configuración
**LOCAL_ONLY** en el worktree nuevo:

```sh
node scripts/share-links/prepare-staging-assets.mjs
npm run test:share-links
npm run test:legal
npm run test:share-links:visual
```

Los tests OG usan claves sintéticas. El fixture workerd intercepta todo fetch y rechaza
cualquier destino distinto de los dos endpoints loopback simulados. No usa Supabase.
Los controles negativos mutan copias temporales, prueban baseline positivo y exigen
fallo de aserción específico: sin verificación de revisión, sin tope efectivo, fuga de
cabecera privada, 503→fallback y aceptación de rutas ambiguas. Nunca mutan los originales.

Resultados OG-06A:

- Suite Share Links: **854/854**, incluyendo 92 tests OG de núcleo y 10 workerd.
- Controles OG: **5/5 detectados** (no se suman como tests de integración adicionales).
- Build/auditorías estática, branding y legal PASS; Astro check y Worker typecheck PASS.
- Regresiones de perfiles, fallback, cabeceras, V1 y harness histórico PASS.
- Suite legal: 44/44. Revisión visual responsive: 8/8 (360, 390, 768, 1280 px,
  publicación/perfil), cero violaciones axe, cero requests externos, errores CSP o cookies.
  El Chromium 1248 esperado no estaba instalado; no se descargó. Se usó Chrome local
  `157.0.8103.79` mediante el wrapper explícito siguiente, sin alterar el harness histórico:

  ```sh
  node scripts/share-links/visual-installed-browser.mjs '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ```

- Se conservan los 23 marcadores legales previos; no se editaron documentos protegidos.
- La primera corrida completa sin configuración local histórica tuvo un fallo de fixture;
  se preparó el fixture y la corrida final terminó sin fallos. No hubo reparación remota.

## Límite real del emulador y próximo gate

**Overlay NO validado.** El test workerd demuestra que la salida de Images offline tiene
los mismos píxeles que la referencia sin badge, aunque .draw() responde 200. Ese test
acredita la limitación del emulador, no integración visual exitosa de Cloudflare.

`qa/og-image-v1/reference/` contiene retrato, paisaje y panorámica sintéticos compuestos
con Sharp, expresamente etiquetados como referencia local. No son fotos reales ni salida
del binding. La referencia horizontal fue inspeccionada visualmente.

Fuentes oficiales revisadas:
- https://developers.cloudflare.com/images/optimization/binding/
- https://developers.cloudflare.com/images/optimization/features/
- https://developers.cloudflare.com/images/optimization/draw-overlays/

Una fase futura necesita autorización independiente para probar el binding remoto con
fuentes sintéticas, sin crear un Worker sintético ni reutilizar el eliminado W2-Q2.
Comparar píxeles/regiones con y sin logo, dimensiones, márgenes y metadata; medir latencia,
memoria, cuota y errores. Después: integración autorizada STAGING y WhatsApp iOS/Android.
No habilitar fotografías públicas antes de resolver decisiones jurídicas/producto y cuota.

## Preservación

Preflights y resultados conservados localmente fuera de los archivos versionados.
Se cotejaron los archivos, estado Git y HEAD de los siete worktrees originales y los
38 hashes históricos W2-Q2: sin diferencias. Los cambios pendientes del principal y la
documentación no commiteada del experimento permanecen intactos. No se copiaron secretos.
OG-06A no hizo commit. OG-06B autoriza un único commit local de este trabajo y su
endurecimiento; no autoriza fetch/rebase/merge/push/PR, deploy ni consultas Supabase.

## Revisión OG-06B

El preflight encontró exactamente los 18 archivos y el HEAD esperados de OG-06A, con
índice vacío. No hubo diferencias materiales previas. Se añadieron solo dos archivos:
la entrada local explícita y dos controles de bundle en `og-bundle.test.mjs`.

La corrección se limita al mecanismo de activación: no se confía en Host, Forwarded,
X-Forwarded-For, X-Forwarded-Host, X-Forwarded-Proto, X-Real-IP, queries o variables para
habilitar capacidad de módulo. Las pruebas cubren configuración ausente, parcial,
STAGING/production, URL pública con headers falsos y entrada normal con todo el opt-in.
Los controles negativos ahora son siete: los cinco originales, omisión de la compuerta
de módulo y omisión de la comprobación de URL local. Se ejecutan en copias desechables.

Los bundles normales se inspeccionan con esbuild/metafile: no incluyen la entrada de
pruebas, fixtures, scripts, Sharp, rutas absolutas del equipo ni claves sintéticas.
No se añadieron dependencias ni se modificaron package.json/package-lock.json.
Módulos: configuración/ruta; transporte acotado; contenedores/limpieza de metadata;
composición; respuesta y concurrencia. No hay refactor estético ni contrato nuevo.

Validación final OG-06B: **860/860 Share Links**, **7/7 controles negativos detectados**,
**44/44 legales**, build/auditorías, Worker typecheck y Astro check PASS (0 errores,
warnings o hints). Son 95 pruebas OG de núcleo, 11 workerd y 2 de bundles dentro de las
860; las restantes conservan la cobertura previa. Revisión responsive/accesibilidad 8/8,
sin requests externos, errores CSP ni cookies. `git diff --check` limpio. Los 23 marcadores
legales previos siguen intactos. No hubo escrituras remotas ni proveedores externos.
El commit local autorizado agrupa los 18 archivos OG-06A y los dos archivos del
endurecimiento; excluye qa, logs, dependencias, secretos y cualquier archivo W2-Q2.

La salida sigue siendo 1200×630 JPEG, pad, #F5FAF8, badge oficial 240×90 y 32 px de margen.
La referencia Sharp, el resultado del simulador Images y la transformación real remota
son tres evidencias distintas. La tercera sigue **NO VALIDADA**.

## Siguiente prueba real: comparación de mecanismos (diseño; NO ejecutar)

**A. Preferida: Worker local y solo Images remoto.** La documentación actual admite
`images.remote:true` para usar el servicio de alta fidelidad manteniendo el código de
composición local. No equivale a `wrangler dev --remote`.

Plantilla exacta a materializar solo bajo una autorización nueva (no es configuración activa):

```jsonc
{
  "name": "<nombre-unico-aprobado-no-existente>",
  "account_id": "<cuenta-verificada>",
  "main": "<probe-sintetico-local-a-revisar>.ts",
  "compatibility_date": "2026-09-29",
  "workers_dev": false,
  "preview_urls": false,
  "observability": { "enabled": false },
  "images": { "binding": "IMAGES", "remote": true },
  "dev": { "ip": "127.0.0.1", "port": 8789, "local_protocol": "http" }
}
```

Comando futuro: `wrangler dev --config <config-probe-aprobada> --ip 127.0.0.1 --port 8789`.
Sin --remote y sin forzar todos los bindings a local. No reutilizar los nombres de
producción, STAGING ni W2-Q2. El probe solo recibe fixtures sintéticos locales y usa el
compositor revisado; no usa los clientes backend, ASSETS remotos, claves OG ni Supabase.

Requisitos: cuenta seleccionada y autenticada con permiso de sesiones preview/scripts e
Images. Verificar en el preflight futuro la habilitación, límites y facturación sin cambiar
plan. Images documenta que el uso del binding durante desarrollo no genera cargos; no es
una comprobación del plan de esta cuenta ni promesa para un despliegue persistente.

**A no tiene cero escrituras remotas.** La lectura del Wrangler instalado 4.160.1
(`wrangler-dist/cli.js`, funciones `startRemoteProxySession`, `createPreviewSession`,
`createWorkerPreview`) muestra una sesión edge-preview y un POST de código proxy a
`/accounts/{account}/workers/scripts/{name}/edge-preview`. La aplicación permanece local,
pero el proxy se sube al servicio. No es un despliegue productivo persistente; no se debe
prometer ausencia de recursos temporales, logs o tokens remotos.
El código también intenta obtener/registrar un subdominio workers.dev: exigir que ya esté
configurado; si no, detenerse sin registro implícito. Con nombre no existente y único se
evita usar el espacio de preview de otros Workers. Nunca ejecutar con su configuración.

Limpieza A: cerrar Wrangler/llamar `dispose()` de la sesión, detener sockets locales,
conservar resultados sanitizados y verificar inventario antes/después bajo autorización.
No hay Worker persistente previsto que borrar. No prometer borrado inmediato de tokens,
proxies o logs: su expiración/retención depende del proveedor. Si aparece un recurso
persistente inesperado, detenerse y reportar; no borrarlo por suposición.

**B. Solo si A falla: código de probe ejecutado remotamente.** Primera variante a evaluar:
`wrangler dev --remote --config <config-probe-aprobada> --ip 127.0.0.1 --port 8789` con
la misma plantilla aislada y solo Images. Sube el código completo a una preview temporal;
todos los bindings pasan a ser remotos. Por ello el probe debe llevar la foto sintética y
el PNG oficial en su bundle, sin bindings/backend/secretos adicionales. El Worker normal
OG de la web no se modifica ni se utiliza como probe.

Requisitos B: cuenta, autenticación y permisos preview/Images como A; inventario previo,
nombre sin colisión y workers.dev ya registrado. Usa recursos remotos temporales y puede
producir logs/tokens de preview. Limpieza: detener la sesión y comprobar que no aparecieron
deployments persistentes ni cambios en Workers existentes. No se usa `versions upload`,
`wrangler preview` de un Worker existente ni `deploy`. Si fuera imprescindible un Worker
persistente, requerirá otro plan autorizado de creación, acceso, facturación y borrado;
no está preparado ni autorizado aquí. El código local no demuestra aislamiento remoto.

Comparación: A expone al servicio solo proxy/binding y bytes sintéticos, conservando el
handler local; B sube y ejecuta todo el probe. A es preferible si entrega la composición
real. Ninguna alternativa se ha ejecutado ni se ha inspeccionado la cuenta en OG-06B.
Para un Worker persistente rigen los precios normales de Workers/Images: Images Free
publica 5000 transformaciones únicas al mes y Paid USD 0.50/1000 adicionales. No inferir
la habilitación, consumo, unidad facturada o gratuidad de esta cuenta.

**PASS/FAIL objetivo para ambas:** obtener una salida sin badge y otra con badge usando
la misma fuente y parámetros. Ambas deben decodificar a 1200×630 JPEG opaco y conservar
el encuadre completo. El área del distintivo es x=928..1167, y=508..597. Debe contener
su patrón oficial, y diferir de la salida sin badge. Comparar píxeles con tolerancia JPEG
y regiones internas, no hashes globales únicamente. Verificar márgenes de 32 px y que las
regiones fuera del badge coincidan dentro de tolerancia de compresión; incluir retrato,
paisaje, panorámica y transparencia. Inspección visual y metadatos con decoder independiente:
sin EXIF/XMP/GPS/COM heredados. Registrar bytes, hashes de referencia/regiones, versión,
parámetros, tiempos y cuenta sanitizada. Forzar fuente corrupta: 503 sin passthrough ni
fallback exitoso. Cualquier badge ausente, recorte, distorsión, metadata privada, destino
inesperado, falta de aislamiento o respuesta exitosa a error da FAIL y detiene la prueba.

Fuentes oficiales adicionales (consulta documental, sin llamadas a la cuenta):
- https://developers.cloudflare.com/workers/local-development/#remote-bindings
- https://developers.cloudflare.com/workers/local-development/bindings-per-env/
- https://developers.cloudflare.com/workers/local-development/#wrangler-dev---remote-legacy
- https://developers.cloudflare.com/images/pricing/
