# Evidencia de QA — contrato 4C.1

## Propósito y alcance

`qa:report` anteriormente leía carpetas fijas sin validar el estado de su
ejecución. Un build fallido podía dejar resultados antiguos y un resumen con
código cero. Desde 4C.1, el modo verificable utiliza exclusivamente la última
invocación de cada perfil solicitado, con identidad, contexto y bytes asociados.
No añade dependencias, modifica la matriz E2E ni habilita CI o despliegues remotos.

## Archivos y metadata

Todo resultado generado sigue dentro de `/qa/`, ignorado por Git:

```text
qa/latest/{smoke,full,lighthouse}.json
qa/runs/<UUID>/run.json
qa/runs/<UUID>/integrity.json
qa/runs/<UUID>/evidence.json
qa/runs/<UUID>/results.json          # smoke/full
qa/runs/<UUID>/html/                # reporte Playwright
qa/runs/<UUID>/artifacts/           # screenshots/traces
qa/runs/<UUID>/summary.json         # Lighthouse completo
qa/runs/<UUID>/{inicio,contacto,soporte}-{1,2,3}.{json,html}
qa/runs/<UUID>/partial.json         # progreso Lighthouse, nunca aprobatorio
qa/summary.json                    # snapshot del último reporte verificable
```

`run.json`, esquema 1, contiene `runId` (UUID v4), `profile`, `status`,
`startedAt`, `finishedAt`, `exitCode`, `context` y, ante un error, `error`.
El contexto contiene el SHA de HEAD, `sourceHash` SHA-256 de una lista ordenada
de rutas, permisos y digest de fuentes relevantes, y runtime: Node, OS,
arquitectura, versiones instaladas de Playwright, axe y Lighthouse, ubicación
de navegadores y hash del descriptor de revisiones de Playwright.

La huella incluye archivos seguidos y archivos nuevos no ignorados de `src/`,
`public/`, `legal/`, `scripts/`, `tests/`, `brand-reference/`, `.github/`,
configuración de herramientas/paquetes y los documentos PL-016 y LEGAL_FACTS.
Rechaza fuentes ausentes o enlaces simbólicos. No basta con el SHA de HEAD:
los cambios relevantes sin commit también invalidan la compatibilidad.
Excluye salidas ignoradas, `/qa/` y documentación narrativa como este archivo,
el README y el plan 4C; así se puede registrar evidencia sin invalidarla.
Un commit, incluso documental, cambia la revisión y requiere nueva evidencia.

Los resultados Playwright (`config.metadata.qa`), cada JSON Lighthouse y su
resumen, la integridad y el sello comparten este vínculo:

```json
{
  "schemaVersion": 1,
  "runId": "UUID de la ejecución",
  "profile": "smoke | full | lighthouse",
  "contextHash": "SHA-256 del JSON del contexto"
}
```

`integrity.json` acredita las 73 fuentes protegidas del HEAD de partida, las
entradas vigiladas sin reescritura, cero releases y ambos punteros en null.
El inventario explícito de `scripts/qa/integrity.mjs` conserva las 70 rutas de
4B/4C.1 y añade únicamente `scripts/ci/control-policy.mjs`,
`tests/ci-control-policy.test.mjs` y `tests/ci-trusted-entrypoint.test.mjs`.
Se exige igualdad exacta de rutas antes de comparar sus bytes contra HEAD:
perder, añadir, duplicar o sustituir una ruta se rechaza aunque el conteo coincida.
El reporte exige ese mismo conteo; no acepta evidencia antigua de 70 como actual.
`evidence.json` registra ese vínculo y los SHA-256 de los archivos requeridos:
resultados e integridad en E2E; resumen, nueve JSON, nueve HTML e integridad
en Lighthouse. Screenshots, traces y HTML de Playwright son diagnósticos
auxiliares, no forman parte del sello de aprobación; axe queda embebido en
el JSON sellado. Los HTML Lighthouse conservan su contenido original; se añade
metadata únicamente al JSON, sin cambiar mediciones ni instrumentación.

## Ciclo y estados

1. El runner registra un UUID nuevo, estado `running` y puntero `latest` antes
   del preflight, build o navegador. Invalida el snapshot aprobatorio anterior.
2. Captura el contexto y las entradas, verifica fuentes protegidas y construye
   producción local. Cada invocación posee su propia preview de loopback.
3. Ejecuta el perfil, compara fuentes/entradas antes y después, comprueba
   cobertura, valida resultados y escribe el sello.
4. Cierra con `passed` y código 0 solo tras completar esos controles. Un fallo
   cierra con `failed`, error y código 1. SIGINT/SIGTERM cierran `interrupted`
   y código 1 después de esperar la limpieza de los procesos propios de QA.
5. Un SIGKILL, caída del proceso o fallo de disco puede dejar `running` o
   archivos ausentes: el reporte los rechaza. Nunca recupera un éxito previo.

`finishedAt`/`exitCode` son null mientras la ejecución está abierta. Un estado
desconocido o cierre incoherente falla. `latest` solo se actualiza al iniciar:
una ejecución anterior que termine más tarde no sustituye una invocación nueva.
No ejecutar builds simultáneos sobre el mismo working tree: comparten `dist/`.

Preview y comandos comparten `spawnOwned`: en POSIX crean un grupo propio y
terminan ese grupo, incluidos los descendientes que permanezcan en él. La
cancelación anterior al arranque no crea procesos; durante el arranque conserva
el manejador, envía SIGTERM y espera la salida, aunque todavía no haya URL.
El timeout de arranque sigue siendo 30 segundos. Después de ready, cancelación
y `stop()` esperan la misma promesa idempotente de limpieza. Se conceden hasta
5 segundos de gracia y luego hasta 3 segundos tras SIGKILL; si el SO no confirma
la terminación, se rechaza con «limpieza no confirmada», nunca con éxito.
Se retiran timers y listeners de arranque/cancelación cuando corresponde.

Esos plazos y el programa de arranque pueden acortarse/sustituirse mediante
parámetros de función en fixtures controlados. El CLI no expone overrides,
conserva la preview Astro propia y no usa credenciales ni servicios nuevos.

Las escrituras JSON usan temporal propio y rename. Un lock breve exclusivo
`qa/.state.lock` serializa registro/punteros y validación/publicación del resumen;
no se mantiene durante build o navegación. Si queda abandonado, se falla cerrado.
Tras comprobar que no hay procesos de QA/report activos, el operador puede
retirar únicamente ese lock y repetir el comando; no se borra automáticamente
por antigüedad, no se elimina evidencia y no se usa un reporte anterior.

## Comandos y códigos de salida

Los comandos existentes siguen disponibles:

```sh
npm run test:qa
npm run qa:smoke
npm run qa:report -- --profiles smoke
npm run qa:full
npm run qa:report -- --profiles smoke,full
npm run qa:lighthouse
npm run qa:report
```

`qa:browsers` conserva la instalación existente. No es necesario ejecutar full
o Lighthouse en cada iteración. Smoke exige 12 casos; full, 99: las 84
combinaciones más 15 interacciones. No se admiten filtros, omisiones, duplicados,
fallos esperados, retries/flaky, errores globales ni anexos axe requeridos ausentes.
Axe exige cero infracciones y evidencia de target-size; los `incomplete` siguen
visibles como revisión pendiente, sin convertirlos en aprobados.

Lighthouse exige nueve mediciones válidas, identidad coincidente, tres rutas,
condiciones de 4B, correspondencia entre JSON individuales, scores y medianas.
Antes de sellar, contrasta también `configSettings` de cada medición con las
condiciones del resumen: categorías, form factor, método de throttling, screen
emulation, maxWaitForLoad y los tres parámetros de throttling declarados.
Los parámetros adicionales que Lighthouse incorpora por defecto se conservan;
no se inventan como requisitos ni se omiten los declarados. Una contradicción,
por ejemplo `desktop` frente a `mobile`, produce un error específico.
El objetivo ≥95 sigue siendo orientativo: los valores inferiores se informan,
no se ocultan ni se convierten en un umbral absoluto. Los JSON no sustituyen
la revisión de los motivos de una puntuación inferior.

`qa:report` sin argumentos exige los tres perfiles. `--profiles` define un
alcance parcial explícito; no concede cobertura de los perfiles no solicitados.
UUID distintos son compatibles si revisión, fuentes y runtime coinciden
exactamente con el estado actual. Se comprueban también bytes y fechas dentro
de la ejecución. La vigencia significa última invocación compatible, no una
caducidad arbitraria por horas; las fechas permanecen visibles para el revisor.
Las fuentes vuelven a comprobarse antes de publicar el resumen.

- **Runner 0:** perfil completado y sellado; no equivale a aprobación global.
- **Reporte verificable 0:** evidencia automática válida del alcance indicado,
  `status=valid`, `automatedApproval=true`. Expresa límites humanos y jurídicos.
- **Reporte/runner distinto de 0:** fallo explícito; no aprobar. Un reporte
  inválido escribe `automatedApproval=false` cuando puede escribir metadata.
- **Resumen pendiente:** una invocación nueva invalida el anterior; ejecutar
  el reporte tras terminar para verificar el alcance deseado.

El resumen es un snapshot, no un control autónomo perpetuo: para aprobar se debe
ejecutar el comando verificable, revisar su código y alcance sobre las fuentes
actuales. Si el disco/lock impide escribir, manda el código de error, nunca un
`qa/summary.json` anterior. No consumir solo ese archivo como gate de CI.

Consulta histórica explícita, sin sobrescribir `qa/summary.json`:

```sh
npm run qa:report -- --history UUID
npm run qa:report -- --history legacy:smoke
npm run qa:report -- --history legacy:full
npm run qa:report -- --history legacy:lighthouse
```

Este modo es **informativo**, muestra `automatedApproval=false` y advierte
que un código 0 significa consulta exitosa, nunca aprobación. Puede inspeccionar
ejecuciones fallidas; no certifica actualidad ni bytes de los artefactos. Las
carpetas antiguas `qa/smoke`, `qa/full` y `qa/lighthouse` permanecen intactas
como evidencia previa sin contrato; no se migran ni se adoptan automáticamente.

## Límites y controles separados

Los hashes detectan corrupción o mezcla accidental; son metadata local editable,
no firmas ni una raíz de confianza ante cambios maliciosos del código/artefactos.
La protección histórica y el checker de 4A siguen siendo controles separados.
No hay TTL, servicio externo, base de datos ni nueva dependencia. La identidad
del descriptor no acredita la autenticidad de binarios modificados manualmente
en la caché de navegadores; usar las instalaciones aprobadas de Playwright.
Las pruebas de procesos se ejecutan en macOS: PID terminado, escalamiento,
descendiente resistente y runner real con SIGINT/SIGTERM. Linux sigue pendiente
de ejecución. En Windows se termina el hijo directo y se omiten los tres casos
de descendientes POSIX y señales al runner. El resto de la suite tampoco se ha
validado en Windows: los escenarios resistentes a SIGTERM/SIGKILL pueden requerir
adaptación a sus señales nativas. No se acredita limpieza de descendientes allí.
Tampoco se promete recoger procesos que creen una sesión/grupo ajeno
ni limpiar todo recurso temporal tras SIGKILL o una caída del SO.

## Pruebas de las correcciones F01–F04

`test:qa` ejecuta `qa-evidence.test.mjs` y `qa-process.test.mjs`, sin instalar
dependencias. Los fixtures CLI clonan exclusivamente el repositorio local y
reutilizan su commit existente, sin red ni commits nuevos. Preparan metadata
de herramientas y fuentes mínimas para que `captureContext()` funcione realmente;
el caso de aprobación debe devolver 0. Cada negativo de evidencia comprueba
código 1 y el motivo esperado, sin aceptar un fallo previo de Git como sustituto.
Un caso separado conserva el fallo de preflight sin Git como escenario intencional.

Los negativos semánticos modifican datos **antes** de llamar al sellador y
exigen el error concreto y la ausencia de `evidence.json`. Los negativos de bytes
parten de evidencia válida sellada y exigen el error de hash. Para probar el
consumo por CLI se recalculan hashes únicamente con un helper de tests, aislando
la condición semántica: el sellador de producción conserva todas sus verificaciones
y no dispone de bypass. No se fabrican releases jurídicos.

Una prueba de mutación carga en memoria el validador sin el rechazo de infracciones
de axe. La misma aserción semántica, que pasa con el módulo original, debe fallar
con código 1 y «Missing expected exception» en el mutante. No cambia archivos
del repositorio ni se permite que un fallo de hash haga pasar esa prueba.

Los fixtures de proceso comprueban cancelación antes/durante/después de ready,
timeouts, ENOENT, salida temprana, idempotencia, SIGKILL observado, descendientes
POSIX y runner real interrumpido durante un build controlado. Una simulación
sin proceso real cubre el error acotado cuando el SO no confirma la terminación.
Las pruebas tienen plazos propios y limpieza de respaldo de sus PIDs y temporales.

Este incremento no resuelve los 25 `incomplete` históricos, los siete contrastes
informativos, lectores de pantalla o dispositivos físicos. No declara conformidad
WCAG completa. Tampoco corrige la discrepancia de privacidad/Analytics ni el
CORS del beacon observado en localhost. Lighthouse conserva su comportamiento
de red original; ejecutar nuevas mediciones con conectividad acordada. E2E
mantiene el aislamiento de requests externos de 4B.

No habilita el baseline remoto ni `LEGAL_BASELINE_SHA`: el fallo cerrado de
GitHub requiere un bootstrap/protección autorizado independiente. No autoriza
push, deploy, cambios remotos, publicación jurídica o inicio de otros incrementos.
