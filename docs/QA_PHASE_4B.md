# Fase 4B — Accesibilidad y calidad multiplataforma

Implementación local autorizada. No autoriza publicación, releases legales,
activación en Supabase ni cambios de infraestructura. No incluye 4C.

## Entorno y reproducción

Node 22.21.1 y npm 10.9.4 (los mismos de 4A). El mínimo de Node del proyecto
sube a 22.19 por Lighthouse; CI conserva su versión fijada. Dependencias de
desarrollo exactas: `@playwright/test` 1.64.1,
`@axe-core/playwright` 4.14.0 y `lighthouse` 13.6.0. El lockfile conserva las
integridades de paquetes. No se añade JavaScript al sitio.

```sh
npm ci --ignore-scripts
npm run qa:browsers
npm run qa:smoke
# Solo al cerrar cambios de UI o preparar una revisión completa:
npm run qa:full
# Medición separada, sin otras pruebas o builds simultáneos:
npm run qa:lighthouse
npm run qa:report
```

Los navegadores se descargan de Playwright a `/qa/browsers/`, ignorado en Git.
Revisiones: Chromium 156.0.8078.4 (1248), Firefox 157.0 (1555), WebKit 27.2
(2370 en este Mac). Son builds de prueba, no las aplicaciones personales.
Cada perfil hace un build de producción con sus auditorías e inicia su propia
preview en `127.0.0.1`, con puerto efímero, y la cierra al terminar. No toca
previews existentes. No se permite apuntar estos comandos a producción.

Los perfiles no están enganchados a `dev`, `build` ni a los workflows de 4A.
El full es una acción explícita; no se ejecuta por cada cambio de desarrollo.
Integrarlos en CI requeriría una revisión separada del coste y la seguridad.

### Particularidades de macOS

En macOS 27.0.1/arm64, Firefox 157 no pudo arrancar por la búsqueda de datos
del Firefox personal. Se reprodujo el error antes de cargar cualquier URL.
La configuración le da un directorio de datos exclusivo `/qa/firefox-appdata/`
mediante `CFFIXED_USER_HOME`, sin cambiar `HOME`, perfiles personales, TCC,
firmas ni binarios. En otros sistemas no se aplica esta opción. Es una medida
de aislamiento local, no una exclusión de pruebas.
Referencia: [incidencia Playwright #42768](https://github.com/microsoft/playwright/issues/42768).
Revisar su retirada cuando se actualice a una versión con Firefox 158 o posterior.

WebKit/macOS recorre enlaces con Option+Tab con la preferencia de teclado
actual; las pruebas utilizan ese atajo y Option+Shift+Tab en ese entorno.
Chromium/Firefox y otros sistemas utilizan Tab/Shift+Tab. No se añaden
`tabindex` a enlaces nativos ni se cambian preferencias globales del Mac.
Referencia: [WebKit, navegación de enlaces](https://bugs.webkit.org/show_bug.cgi?id=161394).

## Perfiles y cobertura

Smoke: Chromium, 390 × 844 CSS px, siete vistas más cinco escenarios: 12 pruebas.
Full: tres motores × cuatro anchos (360, 390, 768 y 1280 CSS px) × siete
vistas: 84 combinaciones. Añade cinco escenarios por motor a 390 × 844:
15 pruebas adicionales, total 99. Dos workers, cero retries; un fallo no se
oculta con reintentos.

Vistas: `/`, `/terminos`, `/privacidad`, `/soporte`, `/contacto`,
`/eliminar-cuenta` y una ruta inexistente que debe responder HTTP 404 real.
No hay una página `/accesibilidad` inventada para completar la matriz.

Cada combinación comprueba idioma, landmarks, H1 único, nombres accesibles,
IDs únicos, overflow horizontal, controles fuera del viewport, targets de
44 × 44 CSS px en navegación/acciones, marcadores jurídicos y errores JS.
Los enlaces dentro de prosa conservan la excepción de objetivos en línea;
no se impone una caja de 44 px a cada palabra enlazada del texto jurídico.

Escenarios adicionales:

- Primer foco en skip link, activación hacia `main`, navegación principal,
  footer y retorno arriba mediante teclado.
- Recorrido hacia delante y atrás, foco visible y dentro del viewport,
  comprobación de que se alcanzan múltiples controles sin trampa.
- Apertura de todos los `details` de soporte mediante Enter y axe del estado expandido.
- Índices legales, descargas reales del navegador comparadas byte por byte
  con Markdown y checksums SHA-256; `/terminos/v1.0` y `/privacidad/v1.0` dan 404.
- Reflow a 320 CSS px en las siete vistas, texto al 200 % a 768 px y
  `prefers-reduced-motion: reduce` sin scroll suave ni transiciones.

El redimensionado de texto utiliza `html { font-size: 200% }`; no se presenta
como zoom nativo. La anchura de 320 px cubre la geometría de reflow equivalente
a 1280 px/400 %, pero no reproduce toda la interfaz ni el gesto de zoom de un
navegador real.

Además se comprobó zoom nativo mediante los controles de Chrome en este
Mac: siete vistas al 200 % y al 400 %, ventana de 1800 px, geometría efectiva
de 900 y 450 CSS px respectivamente, sin overflow horizontal y con los
marcadores intactos. Evidencia en `/qa/manual/native-zoom.json` y capturas
`zoom-200.png`/`zoom-400.png`. Se confirmó el porcentaje en la interfaz del
navegador y se restauró a 100 %. Esta comprobación no cubre todas las
combinaciones de sistemas, zoom, tamaños de ventana y ayudas técnicas.

## Axe y revisión WCAG 2.2 AA

Axe se ejecuta sin `exclude`, `disableRules` ni sustituciones de contenido.
Se habilita además `target-size` (WCAG 2.2 AA), conservando todas las reglas
predeterminadas; no se limita la ejecución a un subconjunto de tags.
Se conservan resultados completos, incluidos `incomplete`, que requieren
juicio humano. Los targets de RLVO se comprueban además de axe con geometría
DOM; el objetivo de 44 px supera el mínimo de 2.5.8 AA para controles aislados.

Cobertura automática parcial: 1.1.1 (presencia de alternativas), 1.3.1/1.3.2
(estructura y orden), 1.4.3 (contraste calculable), 1.4.4/1.4.10 (geometría de
ampliación y reflow), 2.1.1/2.1.2 (recorridos concretos), 2.4.1/2.4.2/2.4.3,
2.4.6/2.4.7/2.4.11 (skip, títulos, foco y visibilidad), 2.5.8 (geometría),
3.1.1 (idioma), 4.1.2 (nombres/roles). No equivale a certificar estos criterios
en todas sus condiciones ni a certificar conformidad AA del sitio.

Revisión manual pendiente antes de dar por cerrada la validación humana:

- VoiceOver + Safari/iOS y NVDA + Firefox/Chrome: lectura, nombres y jerarquía
  comprensibles, orden de lectura, anuncios de `details` y descargas.
- Calidad contextual de todos los textos alternativos, encabezados y enlaces;
  las capturas históricas no se recolorean ni se convierten en claims actuales.
- Contraste en píxeles reales, imágenes, estados hover/focus/active y modo de
  contraste forzado. Axe puede pedir revisión de contenido con fondos complejos.
- Repetir zoom nativo 200 % y 400 % en Firefox/Safari, texto aumentado por el sistema, espaciado de
  texto de 1.4.12, foco no oculto y ausencia de pérdidas visuales al desplazarse.
- Safari/iOS y Chrome/Android físicos: gestos, orientación, barras dinámicas,
  áreas seguras, descargas, targets y apertura de enlaces `mailto:`.
- Navegación consistente y comprensión de mensajes. No hay formularios de
  entrada, autenticación, arrastre, multimedia ni transacciones en esta web;
  revisar aplicabilidad al incorporar cualquiera de ellos.

Playwright/WebKit no es Safari/iOS real; el viewport estrecho no simula hardware,
teclado virtual, lector de pantalla, tacto ni red móvil. El full utiliza DPR 1
y motores desktop con viewport reducido. No se declara validación de dispositivos físicos.

## Lighthouse móvil

Nueve ejecuciones sobre producción local: tres por `/`, `/contacto` y `/soporte`.
Cada ejecución usa un perfil Chromium nuevo. Mobile 390 × 844, DPR 1;
throttling simulado RTT 150 ms, 1638.4 Kbps y CPU ×4. Se conservan JSON y HTML
individuales, métricas y warnings, más la mediana de cada categoría.

Performance, Accessibility, Best Practices y SEO: objetivo ≥95, no puerta
absoluta de aprobación. Un resultado inferior requiere análisis y registro;
el comando falla ante errores de ejecución, no por una puntuación arbitraria.
El beacon existente no se intercepta en Lighthouse. La medición sobre localhost
no representa latencia, CDN, headers, redirecciones ni CSP efectiva de Cloudflare.

Las nueve ejecuciones locales obtuvieron 100/100/96/100 en Performance,
Accessibility, Best Practices y SEO: tres resultados iguales y esas mismas
medianas en cada página. Ninguna categoría quedó por debajo del objetivo 95.
El 96 de Best Practices corresponde a `errors-in-console`: el beacon original
intenta enviar RUM a `cloudflareinsights.com/cdn-cgi/rum` y el origen localhost
con puerto obtiene un error CORS. Se conserva y registra, sin interceptar
la solicitud para elevar la puntuación ni modificar Analytics. No prueba que
ese error ocurra en el dominio de producción.

Los diagnósticos no puntuados de la landing también sugieren optimizar el
tamaño servido de una captura y la caché/JavaScript del beacon de terceros.
No se alteran originales ni política de caché por estas sugerencias: Performance
ya alcanza 100 y los headers efectivos corresponden a una revisión posterior
de infraestructura. Ver detalles individuales en `/qa/lighthouse/`.

En E2E, las solicitudes externas se bloquean en el navegador de prueba para
evitar telemetría de QA y dependencias de red; se permite únicamente el intento
del beacon existente y falla cualquier nuevo destino. Ese aislamiento no se
aplica a Lighthouse. El código y la política de Analytics siguen intactos.

## Correcciones y regresión

El smoke inicial halló overflow real de la landing al ampliar el texto al
200 % a 768 px: header y franja sin wrap, y mínimos implícitos de columnas.
Se permiten saltos en header/footer/franja, las secciones editoriales ajustan
sus columnas al espacio disponible y los títulos pueden partir palabras
cuando sea necesario. No se oculta overflow para esconder contenido ni se
modifican textos, logos, colores o capturas. Regresión: escenario de texto
200 % y reflow en los tres motores, más la matriz a los cuatro anchos.

La primera prueba de foco medía antes de terminar el scroll suave; ahora
espera la geometría final con polling, conservando las aserciones de visibilidad
y outline. Los fallos iniciales y sus capturas quedan en `/qa/smoke-initial/`
y `/qa/full-initial/`, separados de los assets históricos.

## Integridad y evidencias

Antes y después de cada perfil se comparan 70 archivos protegidos contra
`HEAD`: fuentes y configuración jurídica, contrato, Analytics, Workers,
logos/capturas y controles de integridad de 4A. También se verifican los
13 inputs de 4A, incluidos bytes y timestamps durante el build. Este guard
de QA es adicional; no sustituye el checker confiable ni cambia su baseline.
Registro y lock vacíos, punteros nulos y ningún release jurídico aprobado.

Resultados locales finales (2026-10-28):

- Smoke: 12/12, sin fallos, omisiones ni retries; ocho ejecuciones axe.
- Full: 99/99, sin fallos, omisiones ni retries; 87 ejecuciones axe.
- Chromium: 360 → 7/7, 390 → 7/7, 768 → 7/7, 1280 → 7/7; interacciones 5/5.
- Firefox: 360 → 7/7, 390 → 7/7, 768 → 7/7, 1280 → 7/7; interacciones 5/5.
- WebKit: 360 → 7/7, 390 → 7/7, 768 → 7/7, 1280 → 7/7; interacciones 5/5.
- Cero infracciones detectadas por axe; `target-size` incluido en todas las ejecuciones.
- Los `incomplete` del full corresponden a `color-contrast`: 25 registros por
  escenario/selector en el reporte consolidado, con ocurrencias repetidas por
  motor/ancho. No son infracciones confirmadas ni resultados aprobados; requieren
  revisión manual y no permiten afirmar cumplimiento WCAG completo.
  Los siete textos informativos de la landing cuyo contraste sigue por revisar
  son el título y el párrafo de `.discover-story .story-copy`, el título y el
  párrafo de `.publish-story .story-copy`, el caption de `.trust-visual`, el
  caption de `.detail-figure` y el párrafo `.direct-fact`.
  Los otros 18 registros corresponden a símbolos redundantes y un rótulo
  decorativo, pendientes de clasificación manual. El total incluye dos registros
  repetidos de las mismas flechas de soporte en su estado expandido. Ver
  selectores, razones y motores afectados en `/qa/summary.json`.
- `ci:web`: instalación reproducible de 387 paquetes, 28 pruebas CI y 44 legales
  (72/72), Astro check sin errores/warnings, builds producción y preview, auditorías
  estática/branding/legal y 18 versiones inexistentes 404 por build. Log íntegro
  local en `/qa/ci-web.log`. Los negativos de alteración histórica siguen intactos.
- Guard de QA: 70 fuentes idénticas a HEAD; las 13 entradas vigiladas por 4A
  no se reescriben durante los comandos. Cero releases, lock vacío, punteros
  `terminos`/`aviso_privacidad` nulos y 23 marcadores visibles (5/13/5).

Se inspeccionaron capturas de landing móvil y desktop y se realizó la
comprobación nativa de zoom descrita arriba. No se presenta esto como revisión
visual humana exhaustiva de cada una de las 84 capturas ni como auditoría
completa con tecnologías de asistencia.

Los reportes, capturas y trazas son artefactos locales bajo `/qa/`, ignorados
en Git; no se mezclan con `public/screenshots/`. Repetir un perfil sobrescribe
su directorio: archivar resultados relevantes antes de repetirlo. Los informes
HTML no se publican automáticamente. No contienen credenciales de servicios.
`qa:report` consolida cobertura, casos `incomplete` de axe, Lighthouse e
integridad en `/qa/summary.json`. Cada perfil registra su estado en `run.json`
y elimina el certificado de integridad anterior al comenzar para evitar
confundir un fallo con evidencia antigua. Revisar también ese estado al leer reportes.

Limitación técnica pendiente: el agregador actual `qa:report` puede resumir
resultados de ejecuciones anteriores y terminar con exit code 0 aunque la
última ejecución haya fallado. Hasta corregir esta limitación, `qa:report`
no debe utilizarse como control autónomo de aprobación. Es necesario contrastar
el estado de `run.json`, las fechas y los resultados de la ejecución correspondiente.
La corrección de `scripts/qa/report.mjs` queda pendiente; esta aclaración no
modifica el agregador ni las pruebas.

## Criterios de revisión

Se exige pasar smoke, 84 combinaciones y escenarios adicionales sin omisiones,
sin infracciones axe, sin regresiones de foco/reflow/targets, conservar las
72 pruebas previas y pasar Astro check, builds de producción/preview y auditorías.
Las excepciones de medición y pendientes manuales se registran explícitamente.
La aprobación técnica no autoriza jurídicamente los borradores ni resuelve
la discrepancia pendiente de Analytics/privacidad. Configuración remota de CI,
protección del baseline y headers efectivos de Cloudflare siguen fuera de 4B.

## Diff de este bloque

23 archivos de implementación/documentación; los artefactos locales no se incluyen en Git:

- Herramientas y comandos: `package.json`, `package-lock.json`, `playwright.config.ts`.
- Scripts nuevos: `scripts/qa/browsers.mjs`, `integrity.mjs`, `lighthouse.mjs`,
  `report.mjs`, `run.mjs`, `server.mjs`.
- Pruebas nuevas: `tests/e2e/fixtures.ts`, `interactions.spec.ts`, `matrix.spec.ts`.
- Correcciones CSS: `src/styles/global.css`, `src/components/SiteHeader.astro`,
  `SiteFooter.astro` y `src/components/landing/Hero.astro`, `ProductStory.astro`,
  `HowItWorks.astro`, `Trust.astro`, `DirectExchange.astro`.
- Documentación/exclusiones: `README.md`, este documento y `.gitignore`.
  La exclusión se limita a `/qa/` para que `scripts/qa/` sí pueda versionarse.

Sin modificaciones a workflows, checker de confianza, pruebas originales,
canónicos, contrato, configuración legal, Analytics o Workers. Sin cambios a
logos ni capturas históricas. Sin commit, push, deploy ni cambios remotos.
