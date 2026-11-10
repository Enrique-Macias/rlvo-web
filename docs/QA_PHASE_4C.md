# Fase 4C — Consolidación de QA, accesibilidad y preparación operativa local

Fecha del plan: 28 de octubre de 2026 (America/Monterrey).
Repositorio: `rlvo-web`.
Base local: `614b91ff1eaa7c8d90bb732e61d45b015169fe10`, cierre de Fase 4B.

Estado: alcance general aprobado. Está autorizada exclusivamente la implementación
local del incremento **4C.1: fiabilidad y trazabilidad de QA**, sin commit.
El resto del plan conserva sus criterios y requiere autorización independiente.
La creación inicial de este documento no ejecutó pruebas ni cambios remotos.

## Convenciones y fuentes

El nombre y ubicación siguen `docs/CI_PHASE_4A.md` y `docs/QA_PHASE_4B.md`:
Markdown en `/docs`, nombres en mayúsculas y bloque de fase explícito.

Fuentes locales consultadas, sin acceso a servicios externos:

- `AGENTS.md`, `PRODUCT.md`, `BRAND.md`, `DESIGN.md` y `LANDING.md`.
- `QA_PHASE_4B.md`: resultados anteriores, limitaciones y pendientes humanos.
- `CI_PHASE_4A.md`: raíz de confianza, bootstrap y límites de CI remoto.
- `package.json`, lockfile, scripts de QA y workflows existentes: ejecución real.
- `DEPLOYMENT.md`, `SEO.md` y configuración estática: alojamiento e indexación.
- `LEGAL_FACTS.md`, `LEGAL_VERSIONING.md`, `PL-016-WEB-INTEGRATION-CONTRACT.md`
  y `LEGAL_PUBLICATION_RUNBOOK.md`: restricciones jurídicas y de publicación.

Las rutas de documentos de esta lista son relativas a `/docs` salvo AGENTS,
paquetes, scripts y workflows. No se modifica ninguna fuente mediante este plan.

## Relación con las fases existentes

- **4A:** conserva sus workflows, pruebas y modelo de confianza. Su aprobación
  local no demuestra que GitHub aplique protecciones o checks obligatorios.
- **4B:** conserva su commit y evidencia histórica. Los resultados auditados
  fueron smoke 12/12, full 99/99 y regresión 72/72; no son ejecuciones nuevas
  de 4C ni garantizan que futuros cambios mantengan esos resultados.
- **4C:** consolida la fiabilidad de QA, la revisión de accesibilidad y la
  preparación operativa local. La ejecución futura necesita aprobación.
- **5:** mantiene su numeración y propósito de preparación de publicación.
  No se inicia, sustituye ni incorpora automáticamente a 4C. Un cierre técnico
  de 4C no autoriza push, deploy, publicación jurídica ni activación en Supabase.

## Objetivos

1. Impedir que `qa:report` presente resultados antiguos o incompatibles como
   evidencia válida de una ejecución posterior.
2. Resolver la revisión de los siete textos informativos con contraste
   indeterminado y clasificar los demás registros `incomplete`.
3. Ejecutar, cuando se autorice y existan los entornos necesarios, una matriz
   humana que complemente las comprobaciones automáticas de WCAG 2.2 AA.
4. Conciliar la documentación de Node con los requisitos y runtime reales.
5. Preservar integridad jurídica, identidad aprobada y arquitectura estática
   durante las verificaciones locales.
6. Preparar criterios y evidencia para una revisión posterior de GitHub y
   Cloudflare, manteniendo esos accesos y operaciones sujetos a otra autorización.

## Alcance de la futura implementación

### Fiabilidad y trazabilidad de QA

La limitación de partida está documentada en 4B: el agregador podía leer resultados
de ejecuciones anteriores y terminar con exit code 0 aunque la última ejecución
hubiera fallado. Su corrección local en 4C.1 se registra al final de este plan;
los reportes anteriores siguen siendo evidencia histórica, sin contrato verificable.

El diseño de implementación deberá cumplir estos requisitos:

- Identificador único por ejecución y perfil; estado inicial, estado final,
  fechas, resultado del proceso y artefactos asociados verificables.
- Identificación de la revisión del código y una huella de las entradas
  relevantes, incluida la configuración y cambios locales sin commit. Un SHA
  de HEAD por sí solo no identifica el estado de un working tree modificado.
- Correspondencia verificable entre ejecución, resultados, integridad y
  perfil solicitado. No basar la vigencia únicamente en la hora o edad del archivo.
- Perfiles requeridos explícitos. Una iteración smoke no exige ejecutar full
  o Lighthouse; un informe smoke tampoco se presenta como cobertura full.
- Los perfiles pueden proceder de invocaciones distintas, con identificadores
  distintos, si pertenecen a la revisión y configuración compatibles declaradas.
  No exigir que todas las invocaciones compartan el mismo identificador.
- Rechazo de resultados ausentes, antiguos respecto de la ejecución declarada,
  parciales, corruptos, fallidos, interrumpidos o incompatibles. Los artefactos
  viejos podrán conservarse como historia, sin usarse como fallback válido.
- Escritura del estado de cierre solo después de completar las comprobaciones;
  una interrupción que deje el estado abierto nunca se considera éxito.
- Un exit code 0 del agregador solo podrá indicar que la evidencia automática
  requerida es válida y satisfactoria. El resultado debe separar pendientes
  humanos, aprobación jurídica y autorización de publicación; no certifica WCAG.
- Ausencia de un perfil opcional, como Lighthouse cuando no corresponde,
  identificada como no ejecutado, sin reutilizar silenciosamente otra medición.

Antes de implementar se revisará el contrato concreto de metadata y artefactos.
Se priorizarán las herramientas existentes y built-ins de Node; no se presupone
una nueva dependencia ni se modifica el checker confiable de 4A para resolverlo.

**Criterios de aceptación:**

- **Q1:** un caso válido produce un informe que permite verificar ejecución,
  perfil, revisión, huella de entradas y procedencia de cada artefacto requerido.
- **Q2:** cada caso negativo produce fallo explícito y código distinto de cero;
  no se emite o reutiliza un resultado de aprobación que oculte ese fallo.
- **Q3:** el informe expresa su cobertura real y sus pendientes humanos; una
  ejecución parcial no adquiere cobertura completa ni aprobación WCAG o jurídica.
- **Q4:** las regresiones nuevas se ejecutan mediante un comando local
  reproducible y las pruebas originales conservan sus controles.

Casos negativos mínimos, en fixtures aislados que no alteren documentos reales:

1. Fallo de build antes de Playwright, dejando un `results.json` anterior válido.
2. Ejecución marcada como fallida, abierta o interrumpida.
3. Identificador de resultados distinto al de su metadata o certificado de integridad.
4. Revisión, configuración o huella de entradas incompatibles.
5. Archivo obligatorio ausente, JSON inválido o esquema no admitido.
6. Perfil, proyectos o cobertura requerida incompletos; pruebas fallidas u omitidas
   que impidan satisfacer el contrato del perfil. No ocultarlas con retries.
7. Fallo de integridad con resultados de navegador satisfactorios.
8. Lighthouse requerido pero ausente, fallido o perteneciente a otra ejecución.
9. Mezcla de un perfil actual con resultados anteriores incompatibles.
10. Cambio de una entrada relevante después de producir los resultados.

Las pruebas no dependerán solo de modificar un timestamp. Incluirán un caso
positivo de perfiles separados pero compatibles y otro de smoke independiente,
para no convertir el full en requisito de cada iteración de desarrollo.

### Accesibilidad y clasificación de contraste

Los 25 registros `incomplete` de 4B son resultados indeterminados, no
infracciones confirmadas ni resultados aprobados. La cuenta es por escenario
y selector; incluye dos registros repetidos de soporte en su estado expandido.

Los **siete textos informativos** de `/` que necesitan revisión manual son:

1. Título de `.discover-story .story-copy`.
2. Párrafo de `.discover-story .story-copy`.
3. Título de `.publish-story .story-copy`.
4. Párrafo de `.publish-story .story-copy`.
5. Caption de `.trust-visual`.
6. Caption de `.detail-figure`.
7. Párrafo `.direct-fact`.

Los otros 18 registros corresponden a símbolos redundantes y un rótulo
decorativo. Se documentará su función y aplicabilidad; `aria-hidden` por sí
solo no sustituye el análisis visual ni demuestra que cualquier icono sea decorativo.

**Criterios de aceptación:**

- **A1:** cada uno de los siete textos informativos tiene escenario, selector,
  fondo real, medición, evidencia y conclusión contra el criterio WCAG aplicable.
  Se revisan solapamientos; el par de tokens nominal no basta.
- **A2:** los otros 18 registros tienen clasificación y justificación manual,
  distinguiendo elementos de escenarios repetidos y sin darlos por aprobados
  únicamente porque su regla automática quedó indeterminada.
- **A3:** ante un defecto confirmado se propone su corrección concreta y
  regresión antes de modificar producción. No se desactivan reglas ni se añaden
  exclusiones generales para obtener resultados verdes.

Se conservan Paleta 06, fuentes locales, logos oficiales y capturas históricas.
No se recolorean capturas ni se modifica contenido jurídico para resolver hallazgos.

### Consistencia de Node y herramientas

El estado de partida distingue:

- `package.json` y raíz del lockfile: Node mínimo `>=22.19.0`.
- Workflows y runner reproducible de 4A: Node `22.21.1`, npm `10.9.4`.
- README: todavía menciona mínimo 22.12, pendiente de conciliación documental.

**Criterio T1:** documentar correctamente mínimo soportado y versión fijada
para reproducir CI, sin confundirlos ni rebajar el requisito del paquete para
acomodarlo al README. La configuración real es la referencia de partida.
Un cambio de runtime, pins o dependencias requiere justificación y revisión
adicionales; no forma parte automática de una corrección documental.

### Validación técnica local

**Criterios V1–V6**, para ejecutar después de autorizar la implementación:

- **V1:** Astro check sin errores ni warnings nuevos; revisar TypeScript strict.
- **V2:** conservar las 28 pruebas CI y 44 legales existentes; añadir las regresiones
  de QA sin eliminar o debilitar controles previos. Informar el nuevo total real.
- **V3:** builds de producción y preview con auditorías estática, branding y legal.
  Dejar identificado el artefacto final y su modo, restaurando producción local
  al terminar cuando corresponda. No ejecutar despliegue alguno.
- **V4:** comparar las 70 fuentes protegidas de la base de 4B con una referencia
  explícita estable, además de verificar que los builds no reescriban las
  entradas vigiladas. No regenerar un lock o cambiar el baseline para hacer pasar pruebas.
- **V5:** mantener 23 marcadores visibles (5 términos, 13 privacidad, 5 eliminación),
  borradores intactos, registro y lock vacíos y punteros `terminos` y
  `aviso_privacidad` en `null`. No crear ni publicar `v1.0`.
- **V6:** HTTP local: páginas esperadas 200, rutas inexistentes 404 real, descargas
  byte por byte, checksums y manifiesto coherentes; sin fallback SPA.

Al cierre del bloque pertinente se ejecutarán smoke y full con la matriz
existente de 84 combinaciones más escenarios adicionales. El full se reserva
para hitos o cambios relevantes, no para cada iteración. Se conservarán los
errores, omisiones y resultados indeterminados, sin presentarlos como aprobados.

Lighthouse corresponde si cambian presentación, assets o comportamiento que
puedan afectar sus mediciones, o si se acuerda una nueva medición de cierre.
En ese caso: tres ejecuciones por `/`, `/contacto` y `/soporte`, producción
local, condiciones y versiones documentadas, resultados individuales y medianas.
El objetivo ≥95 por categoría se mantiene como objetivo, no como aprobación
absoluta; analizar resultados inferiores sin cambios artificiales para elevarlos.
Si no se repite, indicar por qué y distinguir los resultados históricos de 4B.

## Matriz de QA manual

Todas las filas comienzan **pendientes de ejecución**. Esta tabla define
comprobaciones futuras; no registra pruebas realizadas por la creación del plan.

Rutas comunes: `/`, `/terminos`, `/privacidad`, `/soporte`, `/contacto`,
`/eliminar-cuenta` y una URL inexistente, como `/qa-no-existe`, que responda 404.
Los anchos de referencia son 360, 390, 768 y 1280 CSS px; en dispositivos
físicos se registra el viewport real en lugar de atribuirles dimensiones simuladas.

| ID | Cobertura y entorno | Procedimiento | Criterio y evidencia |
|---|---|---|---|
| M01 | Siete rutas; Chrome/Firefox desktop y Safari nativo disponible | Tab y recorrido inverso, activación, skip link, header, footer y retorno arriba | Orden comprensible, foco visible y no oculto, sin trampas; registrar navegador, atajo y preferencia de navegación por enlaces |
| M02 | Siete rutas; VoiceOver + Safari y NVDA + Firefox o Chrome | Lectura por landmarks, títulos, enlaces e imágenes; seguir navegación | Nombres, jerarquía y orden comprensibles; registrar OS, versiones, lector y observaciones, sin presentar axe como sustituto |
| M03 | Landing; cuatro anchos y estados que originaron los siete casos informativos | Medir contraste sobre el fondo real, revisar recortes y solapamientos | Medición reproducible y decisión por cada texto conforme al criterio WCAG aplicable; conservar captura y justificación |
| M04 | Landing y seis vistas restantes, más soporte expandido | Clasificar los otros 18 registros indeterminados | Distinguir decoración, redundancia e información necesaria; conservar los dos registros repetidos como escenarios, sin inflar la cantidad de elementos distintos |
| M05 | Siete rutas; Chrome, Firefox y Safari disponibles | Zoom nativo 200 % y 400 %, texto aumentado y reflow a 320 CSS px | Sin pérdida de contenido o funcionalidad ni solapamientos que impidan leer; registrar zoom y viewport efectivos, no solo scrollWidth |
| M06 | Siete rutas; iPhone/Safari y Android/Chrome físicos | Navegación táctil, portrait/landscape, header/footer, enlaces y áreas próximas a barras del navegador | Contenido y acciones accesibles, targets de diseño de 44 px en controles aislados; registrar dispositivo/OS/viewport, sin sustituirlo por emulación |
| M07 | `/soporte`; teclado y lectores previstos | Abrir y cerrar todos los details por teclado y comprobar sus anuncios | Estado comprensible, foco conservado y contenido accesible expandido y contraído |
| M08 | `/terminos` y `/privacidad`; desktop y móviles previstos | Índice, enlaces de descarga, archivo obtenido y checksum | Destinos correctos, nombres accesibles, archivo canónico exacto y SHA-256 verificable; ningún hash de HTML se presenta como PL-016 |
| M09 | Siete rutas y controles interactivos | Hover, foco, activación, contraste forzado cuando exista y espaciado de texto | Legibilidad y foco conservados; distinguir incompatibilidad de entorno de defecto y registrar cualquier pérdida de contenido |
| M10 | Landing, enlaces y soporte | Preferencia reduced motion; observar scroll y transiciones | Sin movimiento que bloquee uso; comprobar preferencia y comportamiento real sin cambiar ajustes globales del usuario sin permiso |

Registrar por fila: responsable, fecha, revisión/huella del código, entorno,
ruta/ancho/estado, pasos, resultado, evidencia, severidad y acción pendiente.
Estados: pendiente, realizado conforme a los criterios del caso, defecto
confirmado o no aplicable con justificación. Un entorno no disponible queda
pendiente, no se convierte en aprobado o no aplicable por conveniencia.

La revisión humana no se limita a ausencia de scroll horizontal. Las capturas
se guardarán en una ubicación QA separada de `public/screenshots/`, sin alterar
originales ni convertir capturas nuevas en assets históricos. No se presume
que guardar screenshots equivale a comparación visual automática contra un baseline.

## Preparación operativa: criterios para una revisión posterior

Esta sección prepara una lista de comprobaciones, no autoriza su ejecución
externa. En 4C local su estado será **preparado / no verificado externamente**.

### GitHub y confianza histórica

- Confirmar repositorio, rama de publicación y configuración efectiva de Actions,
  políticas de eventos, permisos, revisiones, checks y bypasses.
- Confirmar si un push está conectado a despliegues automáticos antes de
  solicitarlo. Un push podría tener efectos externos aunque los workflows
  locales no contengan un comando de deploy.
- Revisar segundo revisor de confianza y viabilidad de CODEOWNERS; no asumir
  que el propietario puede aprobar su propio PR ni asignar permisos sin autorización.
- Mantener como candidato inicial histórico
  `bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4`. Es distinto de la base de trabajo
  de 4C. Su existencia local no demuestra publicación o protección remota.
- Preparar verificación de `legal-history-baseline`, coincidencia exacta con
  `LEGAL_BASELINE_SHA`, historia autorizada y protección contra cambios, borrado
  y force-push. Si la rama ya existe, inspeccionarla; no resetearla ni moverla
  automáticamente a HEAD o al commit de 4B.
- Exigir `web-quality` y `legal-integrity` asociados al candidato esperado,
  no solo nombres coincidentes o una ejecución manual satisfactoria.
- Preparar PRs controlados positivos y negativos: baseline ausente/discrepante,
  PR atrasado, modificación histórica con lock reescrito e intento de omitir
  el control. Los fallos deben bloquear, sin ampliar permisos o añadir secrets.
- Conservar el checker desde la referencia confiable y el control de la base;
  no ejecutar código del PR en el job de confianza. Comprobar después las
  políticas vigentes de `pull_request_target`, sin asumir su disponibilidad.

**Evidencia futura requerida:** SHA, ejecución/check y candidato asociados,
reglas efectivas, responsables y resultados de los negativos. Los tests locales
no prueban enforcement remoto. Cambiar workflows o desplegar ese modelo queda
fuera de la implementación local de este plan y requiere autorización separada.

### Cloudflare, rutas y headers

- Confirmar alojamiento efectivo, configuración Git/deploy y hosts sin asumir
  que el contenido de `wrangler.jsonc` acredita la cuenta remota.
- Conservar Workers Static Assets y el canonical `https://www.rlvo.com.mx`.
  No migrar a Pages ni cambiar redirects, DNS o dominio.
- Preparar verificación de HTTP 200/404, canonical, rutas generales, descargas,
  manifiesto, bytes SHA-256 y ausencia de fallback SPA.
- Preparar comprobación de MIME/charset de Markdown, checksums y JSON;
  `X-Robots-Tag`, `Cache-Control` y política noindex conforme a `public/_headers`.
  Astro preview no demuestra la aplicación de headers de Cloudflare.
- Registrar host, URL exacta, estado, redirects, headers, instante y revisión
  efectivamente desplegada. Un resultado del sitio actual no valida por sí
  mismo el nuevo artefacto local.
- Mantener el CORS observado por Lighthouse en localhost como evidencia local;
  no inferir que está limitado a localhost ni que existe el mismo fallo en PROD.
  Revisar posteriormente sin cambiar Analytics o sus endpoints en 4C.

**Evidencia futura requerida:** autorización y entorno identificados, artefacto
desplegado conocido y respuestas reales contrastadas con lo esperado. Validar
el artefacto nuevo exige un despliegue autorizado fuera de esta preparación.
No se despliega un borrador público para fabricar evidencia de headers.

## Dependencias, riesgos y decisiones pendientes

### Técnicos

- El contrato concreto de identidad, huellas y perfiles se define en 4C.1
  ([QA_EVIDENCE.md](QA_EVIDENCE.md)). Preservar evidencia histórica sin reutilizarla
  como evidencia nueva; hashes locales editables no constituyen una raíz de confianza.
- Disponibilidad de Node/npm y navegadores fijados; instalación reproducible
  no significa que todos los servicios de descarga o runners sean inmutables.
- El guard local y el agregador no sustituyen la raíz de confianza remota de 4A.
- Conciliar README en una futura implementación autorizada. No actualizar
  dependencias o runtime incidentalmente ni introducir un linter nuevo sin necesidad justificada.

### QA manual

- Designar revisores y disponer de iPhone/Android físicos, Safari/VoiceOver
  y Windows/NVDA o registrar la falta del entorno. No inventar resultados.
- Evitar aprobar contraste a partir de tokens si el fondo real está indeterminado.
- Documentar casos no resueltos y su efecto sobre el cierre, sin afirmar
  conformidad WCAG completa por las puntuaciones de axe o Lighthouse.

### Legales y publicación

- Los 23 marcadores, borradores y falta de aprobación jurídica continúan
  bloqueando la publicación definitiva; no bloquean preparar este plan local.
- Analytics y la documentación de privacidad siguen discrepando. Se mantiene
  el beacon existente y se remite la conciliación a una decisión autorizada
  de producto/jurídica antes de PROD.
- El checklist legal menciona retirar noindex después de aprobación, mientras
  `LEGAL_VERSIONING.md` conserva noindex hasta una decisión SEO explícita.
  Registrar esa decisión pendiente sin editar documentos legales ni retirar noindex.
- La política `drafts-only` de 4A rechaza releases reales. Su eventual cambio,
  la aprobación de `v1.0` y el avance del baseline requieren revisión y otra
  autorización; no se debilita la política para cerrar 4C.
- La publicación legal seguirá el runbook: URL inmutable y canónico verificados,
  copia móvil comparada por SHA-256 y después INSERT autorizado por su responsable.
  `aceptado` para términos y `presentado` para aviso permanecen diferenciados.
- Las decisiones de PL-008/PL-009 y la validación del borrado de evidencia son
  dependencias de revisión jurídica/backend, no tareas que se implementan en la web.

## Orden de implementación, después de aprobar el plan

1. **Confirmar alcance, contrato de QA y responsables.** Revisar archivos que
   se modificarían y definir evidencia de cierre. Sin implementación por ahora.
2. **Corregir trazabilidad y agregación.** Implementar Q1–Q4 y sus controles
   negativos antes de utilizar el reporte como evidencia de aprobación automática.
3. **Conciliar herramientas.** Documentar T1 con el mínimo y runtime reales,
   sin alterar configuración o dependencias salvo otra decisión justificada.
4. **Ejecutar la revisión humana.** Cubrir A1–A3 y M01–M10; proponer correcciones
   concretas cuando exista un defecto comprobado, con regresión y autorización aplicables.
5. **Cerrar validación local.** Ejecutar V1–V6, pruebas nuevas, smoke/full en el
   hito correspondiente y Lighthouse cuando aplique; conservar evidencias actuales.
6. **Completar preparación operativa.** Entregar listas GitHub/Cloudflare con
   criterios, responsables y permisos necesarios, sin ejecutar accesos remotos.
7. **Solicitar revisión del cierre de 4C.** Informar resultados reales, diffs,
   pendientes y bloqueos de publicación. Un commit posterior requiere autorización.

## Criterios de cierre de 4C y límites de autorización

La futura entrega deberá acreditar Q1–Q4, A1–A3, T1 y V1–V6 y mostrar el estado
de todas las filas manuales. No debe haber defectos confirmados sin resolver
que impidan lectura, navegación o funcionalidad dentro del alcance aprobado.
Si falta un entorno o revisión obligatoria, esa parte queda pendiente: no se
declara completada. Cualquier cierre con una excepción necesita aceptación
explícita del responsable, sin convertirla en declaración de conformidad WCAG
ni quitar bloqueos de publicación.

La preparación operativa se acepta por sus criterios y evidencia solicitada,
no por aparentar que se comprobaron servicios externos. Las verificaciones
remotas pendientes no impiden completar su preparación local, pero impiden
declarar habilitada la protección remota o validados los headers del nuevo deploy.

**Autorización vigente:** implementar únicamente 4C.1 localmente, sus pruebas
y documentación necesaria, preservando este plan preexistente. Autoriza las
verificaciones locales del incremento; no autoriza commit, push, deploy,
operaciones remotas ni comenzar 4C.2, 4C.3, 4C.4 o Fase 5.

**Después de aprobar la implementación local:** los cambios concretos se
limitarán al alcance aprobado. Los comandos con dependencias y navegadores
ya disponibles pueden ejecutarse localmente; instalar desde npm o descargar
navegadores requiere acceso de red. Lighthouse y navegadores manuales pueden
intentar cargar el beacon, a diferencia del aislamiento E2E existente: acordar
esa conectividad antes de ejecutarlos y no alterar Analytics para elevar puntuaciones.
Las pruebas físicas podrán requerir una preview en red local autorizada; no
exponerla públicamente ni cambiar bindings o preferencias globales por suposición.

**Fuera de autorización en esta fase:** push, deploy, cambios de GitHub,
Cloudflare, DNS, Supabase, STAGING o PROD; creación o activación de documentos
legales; cambios de Analytics; alteración de marcadores, fuentes jurídicas,
logos originales o capturas históricas; retirada de noindex; modificaciones
del repositorio móvil e inicio de Fase 5. Cualquier acceso externo, incluso
de solo lectura, se solicitará por separado. No se incorporan credenciales al sitio.

Las decisiones aún abiertas son los responsables y entornos
manuales, las correcciones que pudieran justificarse y las autorizaciones
operativas futuras. No queda abierta la arquitectura estática aprobada ni la
prohibición de publicar o activar documentos durante esta consolidación local.

## Avance autorizado — incremento 4C.1

Se implementa el contrato descrito en [QA_EVIDENCE.md](QA_EVIDENCE.md): UUID por
invocación, carpeta propia, puntero explícito a la última ejecución, estados
cerrados, huella de fuentes/runtime, vínculo entre resultados e integridad y
sello SHA-256 de la evidencia requerida. La consulta histórica es informativa;
el modo verificable falla cerrado y declara únicamente su cobertura automática.

Archivos de implementación: scripts/configuración QA, regresiones nuevas y
comando `test:qa`; documentación limitada a este plan, contrato QA y enlace en
README. No hay dependencias nuevas ni cambios de producción, controles de 4A,
contenido jurídico, Analytics o Workers.

Validación **inicial, anterior a la auditoría F01–F04**, 28 de octubre de 2026,
Node 22.21.1 / npm 10.9.4,
macOS arm64, sin commit ni operaciones remotas de configuración o publicación:

- `npm run test:qa`: **54/54**. Incluye identidad/cobertura, resultados antiguos,
  estados abiertos/fallidos/interrumpidos, archivos ausentes/corruptos, errores
  tempranos, rechazo de retries/omisiones, mezcla de IDs/contextos, bytes alterados,
  integridad fallida, Lighthouse parcial/incoherente y consulta histórica explícita.
  Los fixtures aislados ejercitan también el runner y el código de salida del
  CLI; no fabrican releases ni escriben fuentes jurídicas reales.
- `npm run test:ci`: **28/28**; `npm run test:legal`: **44/44**. Se conservan las
  72 pruebas previas, sin cambios en sus archivos. Total unitario/regresión: **126**.
- `npm run check`: **0 errores, 0 warnings y 0 hints** (76 archivos).
- `qa:smoke`: **12/12**, 8 evaluaciones axe; `qa:full`: **99/99**, 87 evaluaciones
  axe. Cero infracciones automáticas, sin retries ni skips. La matriz y pruebas
  E2E originales no se modifican. Full conserva **25 registros incomplete**;
  smoke muestra 23 porque no cubre todos los escenarios del perfil completo.
- `qa:lighthouse`: **9/9 mediciones**, tres por página indexable. Medianas
  Performance/Accessibility/Best Practices/SEO: **100/100/96/100** en `/`,
  `/contacto` y `/soporte`. El 96 vuelve a incluir errores de consola por CORS
  del beacon original en localhost. No demuestra el estado de producción.
- `qa:report` sin argumentos: **código 0**, evidencia automática válida para
  smoke/full/Lighthouse con UUID separados y contexto compatible. También se
  verificó el alcance smoke independiente. La inspección histórica y el rechazo
  de evidencia inválida se prueban con códigos 0 informativo y 1 respectivamente.
- Builds preview y producción con auditorías estática, branding y legal:
  **correctos**. Preview conserva la advertencia esperada del sitemap vacío por
  noindex; la salida final local se restauró a producción.
- HTTP sobre previews propias de ambos builds: seis rutas públicas 200,
  descargas exactas, manifiesto coherente y **18 versiones inexistentes 404** por
  entorno, sin fallback SPA ni redirects. No prueba headers efectivos de Cloudflare.
- Guard de entradas antes/después de ambos builds: SHA-256, tamaño, modo,
  inode/dispositivo y timestamps sin reescrituras. **70 fuentes protegidas**
  idénticas a `614b91ff1eaa7c8d90bb732e61d45b015169fe10`. Se mantienen **23 marcadores**
  (5/13/5), cero releases, lock vacío y punteros null.

Evidencia de las invocaciones finales, bajo `qa/runs/` (ignorado):

- Smoke: `d2368110-8fd3-4566-aaaf-7ad4156112a2`.
- Full: `7514333d-2b33-41fb-8bcb-b3145f0d4754`.
- Lighthouse: `df8906fb-7d13-4ea0-a3f4-1d521186b5ba`.
- Huella de fuentes: `41d90ef98507fe88b0ffb4a52b50d7f2ed4f1dd9ad4fc646945fff6ee7e34e1d`.

La auditoría posterior identificó F01–F03 como bloqueantes y F04 como mejora;
estos resultados iniciales no constituyen su cierre. Las correcciones y nueva
evidencia se registran en el apartado siguiente. No se reinstalaron dependencias ni se
descargaron navegadores; lockfile y versiones permanecen intactos. No se cambian
workflows ni se añade ejecución remota de `test:qa`; su incorporación eventual
a CI necesita revisión/autorización del bloque correspondiente.

Persisten la configuración/protección remota del baseline de 4A, los pendientes
humanos de contraste y dispositivos, la discrepancia Analytics/privacidad y los
bloqueos jurídicos para publicación. Un lock local abandonado se rechaza, con
recuperación manual documentada; no se prueban cancelación de descendientes en
Windows ni autenticidad de binarios locales alterados. La evidencia es un snapshot
de ejecución y no una firma o aprobación perpetua del árbol de trabajo.

Q1–Q4 son el alcance del incremento; A1–A3, T1, matriz manual y preparación
operativa de otros incrementos permanecen pendientes. Los resultados históricos
de 4B se conservan y no se vuelven a presentar como una ejecución nueva.

## Correcciones autorizadas F01–F04 — 4C.1

Se conserva HEAD `614b91ff1eaa7c8d90bb732e61d45b015169fe10`, sin commit ni
operaciones remotas. La autorización cubre exclusivamente los cuatro hallazgos
y sus regresiones; no inicia 4C.2, 4C.3, 4C.4 ni Fase 5.

- **F01:** los fixtures de CLI que verifican evidencia usan un clon Git local
  válido del commit existente y metadata reproducible de herramientas. Se exige
  un caso positivo con código 0 y negativos con código 1, resumen no aprobatorio
  y motivo específico. El fallo sin Git se conserva como preflight intencional,
  separado de los casos que deben alcanzar los validadores.
- **F02:** los negativos semánticos invalidan datos antes de sellar y exigen el
  error concreto y la ausencia del sello. Los de bytes alteran evidencia válida
  sellada y exigen el error de hash. Un helper exclusivo de tests recalcula hashes
  para probar el consumo por CLI sin encubrir errores semánticos. El sellador de
  producción no cambia ni recibe bypasses. Un mutante en memoria sin el guard
  de infracciones axe hace fallar la misma aserción semántica con código 1 y
  «Missing expected exception»; con el módulo original esa prueba pasa.
- **F03:** preview y comandos comparten grupo propio, promesa de cierre
  idempotente y espera de terminación. Durante arranque se conserva el manejador
  hasta limpiar, incluso ante cancelación/timeout sin URL. SIGTERM tiene hasta
  5 segundos de gracia y SIGKILL hasta 3 segundos adicionales; falta de confirmación
  produce error acotado, nunca éxito. Pruebas con procesos reales verifican
  cancelación antes/durante/después de ready, spawn no invocado con señal previa,
  salida observada por SIGKILL, descendiente resistente y runner interrumpido
  durante build mediante SIGINT y SIGTERM, con estado `interrupted` y código 1.
- **F04:** cada JSON Lighthouse debe contener `configSettings` compatible con
  el resumen: categorías, form factor, throttling method, screen emulation,
  maxWaitForLoad y los tres parámetros de throttling declarados. Se rechaza
  antes del sello una medición desktop bajo resumen mobile; también se prueban
  ausencia de configuración, viewport y throttling discrepantes. No cambian
  puntuaciones, umbrales, Analytics ni condiciones de medición.

Archivos de esta corrección: `scripts/qa/{command,server,results}.mjs`,
`tests/qa-evidence.test.mjs`, nuevo `tests/qa-process.test.mjs`, el comando
`test:qa` de `package.json` y los documentos `QA_EVIDENCE.md` y este plan.
Los otros seis archivos preexistentes de 4C.1 se conservan byte por byte.

Validación de las correcciones:

- `test:qa`: **86/86**, sin omisiones en macOS arm64. Se amplía la suite inicial
  de 54 casos: 72 de evidencia y 14 de procesos.
- Las 72 pruebas anteriores: **28/28 CI y 44/44 legales**, con sus fuentes intactas.
  Total unitario/regresión: **158**; smoke y full se informan por separado.
- Astro check: **0 errores, 0 warnings y 0 hints** (77 archivos).
- Smoke final: **12/12**, 8 evaluaciones axe, cero infracciones automáticas y
  23 registros incomplete. Full final: **99/99**, 87 evaluaciones axe, cero
  infracciones y 25 registros incomplete; sin retries ni skips. No se modifica
  la matriz ni los tests E2E originales. El full tardó 407.456 s en esta ejecución;
  no se cambiaron límites ni controles para obtener el resultado.
- Lighthouse final: **9/9 mediciones** con verificación de las condiciones
  efectivas. Medianas Performance/Accessibility/Best Practices/SEO: `/`
  **99/100/96/100**, `/contacto` y `/soporte` **100/100/96/100**. Ninguna categoría
  quedó por debajo del objetivo. El error CORS del beacon se volvió a observar
  en localhost; no acredita el comportamiento en PROD y Analytics permanece igual.
- `qa:report` final, sin argumentos: **código 0**, con los tres perfiles actuales
  y compatibles. Su aprobación se limita a evidencia automática; no acredita
  revisión humana, conformidad WCAG completa, aprobación jurídica ni publicación.
- Builds preview y producción: **correctos**, con auditorías estática, branding
  y legal. Preview conserva el warning esperado de sitemap vacío por noindex;
  producción local queda restaurada como artefacto final.
- HTTP en previews propias de ambos builds: seis páginas públicas 200, descargas
  exactas, manifiesto coherente y **18 versiones inexistentes 404** por entorno.
  Las previews propias se cerraron mediante la nueva limpieza.
- Guard de entradas antes/después de check y ambos builds: contenido, tamaño,
  modo, inode/dispositivo y timestamps intactos. **70 fuentes protegidas** iguales
  al commit de partida; **23 marcadores** (5 términos, 13 privacidad, 5 eliminación),
  cero releases, lock vacío y punteros null. No se reescriben canónicos ni contrato.
- `git diff --check`: correcto. Sin dependencias nuevas, cambios en lockfile,
  workflows, Workers, Analytics, fuentes de producción, Supabase o repositorio móvil.

Evidencia final de estas correcciones, en `qa/runs/` (ignorado):

- Smoke: `5de85c62-319c-47ca-9546-e12e377b9ff2`.
- Full: `cd2eb099-50e3-45cf-9c59-b0ca5c797e24`.
- Lighthouse: `6a549c13-b17a-4f45-a58e-f74d27a2b50f`.
- Huella de fuentes: `0646cf26c53641a81036fc812a8f6ebaf59e662329873af67e2eb725c7df78c2`.

Los IDs de la validación inicial permanecen históricos y no sustituyen esta
evidencia final. F01–F04 quedan corregidos y verificados localmente, pendientes de
revisión final del responsable; no se autoriza ni realiza commit mediante este registro.

No se ejecutaron las pruebas de procesos en Linux o Windows porque el entorno
disponible es macOS. Los tres casos POSIX de descendientes/señales al runner se
omiten en Windows; otros casos resistentes a SIGTERM/SIGKILL pueden necesitar
adaptación antes de acreditar allí la suite. No se promete recoger procesos que
abandonen el grupo propio ni todos los temporales tras SIGKILL/caída del SO.
El caso de limpieza no confirmada se prueba con simulación aislada, sin dejar
un proceso real sin terminar. Esto no habilita verificaciones remotas.

La discrepancia Analytics/privacidad, el baseline GitHub, la causa no identificada
de Workers Builds, los 25 registros incomplete y la revisión humana/jurídica
siguen pendientes. No se corrigen ni se presentan como aprobados en 4C.1.

## Recuperación local sobre main posbootstrap — 10 de noviembre de 2026

Base de recuperación: `d217b1c83c3728f8acfd46d8e8b219508d8e62d6`.
Los registros anteriores de 70 fuentes corresponden a su base histórica y se
conservan sin reescribir. La comparación de árboles demuestra que las 70 rutas
siguen incluidas y solo se añadieron `scripts/ci/control-policy.mjs`,
`tests/ci-control-policy.test.mjs` y `tests/ci-trusted-entrypoint.test.mjs`.

El contrato QA se ajusta a 73 fuentes con inventario explícito e igualdad exacta
de rutas, manteniendo la comparación de bytes contra HEAD y todos los controles
jurídicos. Los negativos cubren pérdida de cualquiera de las 73 rutas, sustitución
con el mismo conteo, adición no aprobada, duplicados y evidencia con conteos 70/72/74.
No se modifican esas fuentes, workflows, política CI ni baseline jurídico.
La corrección y su validación son locales; no autorizan commits, PR o publicación.
