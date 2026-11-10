# Fase 4A — Integridad de controles de CI, etapas 1 y 2

## Estado verificado posterior al bootstrap — 7 de noviembre de 2026

El bootstrap remoto de integridad de CI está incorporado. El PR #1 introdujo el checker confiable en c5cc91b718b41aeab685f3fe57fa50e3db654d6b. El PR #6 incorporó Secret/Base64 y Environment en C = 3a11b33e27da76175831894d4255a817d56e6738. La prueba del Secret espejo del PR #5 terminó en FAIL y ese puente permanece descartado.

El PR #9 conserva P = ed698ce018a8d1d58900bd643cea3d04086a6880, hijo directo de C, con un único comentario inocuo en scripts/ci/control-policy.mjs. Quedó cerrado, Draft, sin merge ni auto-merge; su rama se conserva. Main permanece en C. No se incorporó Fase 4C.1.

Sin autorización, legal-integrity 42332590926 rechazó P por CI_AUTH_REQUIRED, agregado CI_TRUST_FAILURE y exit 1; web-quality 42332590721 aprobó. Con autorización temporal válida, legal-integrity 42421634910 aprobó con controlIntegrity=authorized, digest e375a144866d6d90732416d96c8fd4887f2aa793dd74111fd5a66874900a5d17 y mergeApproval=false; web-quality 42421634599 aprobó. Los cuatro jobs proceden de GitHub Actions App 15368 y corresponden a P. En ambas fases el control jurídico independiente aprobó, con cero releases y 23 marcadores. Las pruebas no modificaron los 17 recursos jurídicos.

El Secret CI_CONTROL_CHANGE_AUTHORIZATION se instaló únicamente en el Environment ci-control-authorization y se eliminó después del cierre. Se comprobó su ausencia mediante GET individual 404 y listado autenticado 200 con cero Secrets. El Environment quedó sin Variables; no había Secret homónimo de repositorio ni Variable antigua de autorización.

El Ruleset 26397937 permanece activo sobre refs/heads/main, sin bypass: PR obligatorio, cero aprobaciones, web-quality y legal-integrity de App 15368, rama actualizada, bloqueo de borrado y force-push, y restricción temporal update. Main continúa inmovilizada. El Ruleset 26149031 protege legal-history-baseline en bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 y no se modificó.

El Environment 26065779197 usa ramas seleccionadas: una única política main de tipo branch, sin tags, revisores, temporizador ni reglas personalizadas de Apps. La API devuelve can_admins_bypass=true; este campo no equivale a un bypass del Ruleset. El workflow utiliza deployment:false y contents:read. Se observaron cero deployments, releases y artifacts publicados; no quedaron runs pendientes.

Los estados y logs proceden de GitHub. La comparación de bytes, el digest y el análisis de exposición se auditaron localmente. No se detectó exposición del transporte o del JSON en los logs examinados; no se afirma una garantía universal de confidencialidad. Cloudflare y Vercel conservan la etiqueta USER-VERIFIED. La suite vacía queued de Cloudflare no demuestra ejecución de un build.

Las pruebas negativa y positiva del transporte quedan cerradas en este contexto. No autorizan futuros cambios, merges, publicaciones ni retiradas de reglas. El Secret eliminado o caducado no invalida checks verdes anteriores. La transición a operación ordinaria permanece pendiente de autorización.

Los originales se conservaron privadamente y se verificaron byte por byte. Los [derivados redactados de PR #9](ci-evidence/pr-9/closure.md) son un candidato documental local para revisión; no implican publicación ni autorización de merge.

## Registro histórico de preparación anterior al PR #6

El texto de preparación y los resultados locales conservados a continuación describen su etapa y alcance originales. Las afirmaciones de que la migración era local o de que no se habían creado recursos remotos son registros históricos, no el estado actual. Para el estado vigente prevalece la sección anterior.

Estado actual: **candidato definitivo exclusivamente local**, transporte de
autorización mediante Secret/Base64 y Environment `ci-control-authorization` con
deployment: false. Incluye la implementación local 4B.2B y la preparación posterior;
no se ha publicado esta migración ni creado Environments, Secrets, variables,
commits, PRs, reglas o despliegues en esta preparación.

El bootstrap anterior sí fue incorporado a main en
`c5cc91b718b41aeab685f3fe57fa50e3db654d6b`; esa versión conserva el canal Variable.
T01–T03 se validaron remotamente en la etapa anterior y sus PRs se cerraron sin merge.
Esto no demuestra todavía la entrega ni el enmascaramiento del nuevo Secret.
Resultado posterior 4B.2C: el PR #5 demostró el fallo del Secret espejo no
referenciado. Ese puente queda descartado; no autoriza usar la Variable antigua.
El checkout original continúa en `9161c0a7c2cf27f0bb129643c8fea3371a96244b`, sin
publicar Fase 4C.1. Los resultados de etapas 1/2 al final son históricos.

## Límite y procedencia de la confianza

`scripts/ci/control-policy.mjs` usa solo built-ins de Node y procesos Git de lectura.
No importa módulos locales, ejecuta el candidato, hace checkout/fetch, instala npm
ni escribe archivos/refs. La suite unitaria de etapa 1 crea objetos Git sintéticos
sin refs. La de integración crea también refs en repositorios desechables para el
entrypoint y usa solo transporte Git local file. Ambas limpian sus temporales;
ninguna crea commits/refs en rlvo-web ni publica fixtures.

En la integración local de etapa 2 el módulo se carga de la **base confiable** y se
ejecuta en el job `legal-integrity`, junto con los controles jurídicos existentes. La
biblioteca no demuestra por sí misma que quien la importa sea confiable: ejecutar
la copia del PR anularía esa separación. El llamador debe validar contexto Actions,
repo literal, ref main, base/head del evento, origen y coincidencia del fetch,
pin/rama legal y ausencia de carreras. No hay una CLI que permita pasar un supuesto
archivo de autorización del candidato ni un flag de bypass.

La política se lee exclusivamente como blob de `baseSha:ci/control-policy.json`.
La del candidato se valida solo como JSON de datos para impedir eliminarla o
inutilizarla; nunca decide la cobertura de la evaluación actual. Sin política base
no existe fallback: se necesita bootstrap explícitamente revisado.

## Política v1 exacta

Fuente declarativa: `ci/control-policy.json`, esquema 1, repositorio literal
`Enrique-Macias/rlvo-web`. No se utiliza un motor glob. Las rutas son relativas al
repositorio, case-sensitive, sin rutas absolutas, traversal o caracteres de control.

Directorios críticos completos, incluyendo cualquier entrada nueva y descendientes:

- `.github/` (workflows, CODEOWNERS y acciones locales).
- `scripts/ci/` (incluye el checker y módulos futuros).
- `src/legal/` (implementación jurídica, no autorización editorial).

Archivos críticos exactos:

- `ci/control-policy.json`.
- `scripts/check-legal-baseline.mjs`, `scripts/verify-legal.ts`, `scripts/normalize-legal.ts`.
- `scripts/audit-static.mjs`, `scripts/audit-brand.mjs`, `scripts/audit-legal.ts`, `scripts/audit-legal-http.ts`.
- `scripts/prepare-assets.mjs`, `scripts/prepare-brand.mjs`.
- `tests/fixtures/legal-migration.json`.
- `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `.gitattributes`.
- `.npmrc`, `.gitmodules`, `.node-version`, `.nvmrc` (también se detecta su creación).
- `docs/CI_CONTROL_INTEGRITY.md`.

Prefijos de archivo críticos: `tests/ci-` y `tests/legal-`; protegen también nuevos
tests con esos prefijos. No se interpretan como expresiones regulares o glob.

Inputs que **nunca admiten excepción de CI**:

- Directorios completos `legal/` y `src/content/legal/`: registro, lock, borradores,
  históricos y cualquier archivo añadido, eliminado o renombrado.
- `src/config/legal-current.json`, `docs/PL-016-WEB-INTEGRATION-CONTRACT.md`,
  `docs/LEGAL_FACTS.md`, `src/content/legal.ts`, `src/pages/eliminar-cuenta.astro`,
  `src/config/site.ts`.

El módulo confiable exige este piso jurídico aunque la política declarativa intente
reducirlo. La política no puede dejar sin protección `.github/`, `scripts/ci/` ni su
propio archivo. Los cambios de contenido o cobertura de política siguen requiriendo
autorización externa; la revisión administrativa debe comprobar que no debilitan
otras rutas. No se ofrece validación semántica exhaustiva de una actualización.

Se detecta también una entrada no regular que sustituya un directorio ancestro de
una ruta reservada. Se rechazan symlinks/gitlinks protegidos incluso con autorización
o cuando son idénticos entre base y candidato. Fuera de estos scopes no se afirma
control de integridad. `scripts/qa/`, Playwright y Lighthouse no se ejecutan en los
workflows actuales; incorporarlos a CI requiere revisar dependencias y cobertura.

## API, comparación y digest

`inspectControls({root, repository, pullRequest, baseSha, headSha})` informa cambios.
No autoriza: devuelve `mergeApproval: false`, `changes` y `legalChanges` separados.

`verifyControls({...context, authorization, now})` aplica rechazo por defecto.
`now` es reloj confiable en milisegundos Unix (default `Date.now()`); su inyección
está prevista para pruebas, nunca se obtiene del PR. `pullRequest` es entero seguro
positivo. Los SHA son exactamente 40 caracteres hex minúsculos y deben identificar
commits existentes; la base debe ser ancestro del head. No se acepta HEAD simbólico.

Etapa 2 añade `verifyCurrentControls({root, repository, baseSha, headSha})` para
diagnóstico manual: exige base=head y produce pullRequest=null, sin inventar un PR
ni aceptar autorización de cambios. Valida política y tipos del mismo árbol. No
relaja la API de PR, que sigue exigiendo número positivo. La autorización manual
de GitHub Actions solo evalúa main; no autoriza cambios críticos ni un head distinto.

Se usa `git ls-tree -r -z`, `cat-file` y `merge-base`, con argumentos array, sin shell,
Git replace, variables GIT heredadas, configuración global ni lazy fetch. No se
ejecutan filtros de checkout, hooks o módulos del candidato. Se admiten blobs
protegidos regulares 100644/100755, con comparación de modo, tipo y bytes exactos,
sin normalización de texto. La política debe ser siempre blob 100644.

Cada diferencia tiene `{path, before, after}`. Cada descriptor no nulo contiene
`{type, mode, oid, bytes, sha256}`. Adición/eliminación usa null; rename se expresa
como eliminación más adición. Se conservan SHA-256 de contenido, no HTML ni hashes
de documentos inventados. No se muestran los cuerpos de los archivos.

`changesDigest` es SHA-256 de los bytes UTF-8 de `JSON.stringify` del siguiente
objeto, con las claves en este orden, más exactamente un LF:

```text
{schemaVersion:1, repository, pullRequest, baseSha, headSha, policySha256, changes}
```

`policySha256` corresponde a los bytes exactos de la política base. `changes` está
ordenado por ruta con comparación JS de unidades UTF-16, sin locale. Claves de cada
cambio/descriptor en el orden indicado arriba. La identidad de commits queda
incluida aunque repitan el mismo árbol. Las diferencias jurídicas no se incluyen en
el digest autorizable: `verifyControls` las rechaza antes de leer la autorización.

Límites de lectura: árbol de hasta 50,000 entradas y salida Git de 16 MiB; cada blob
protegido hasta 4 MiB, total de blobs únicos hasta 64 MiB; timeout de cada comando
Git de 10 s. El job confiable declara un timeout de 10 minutos; los límites de lectura no
constituyen por sí solos un timeout global de la biblioteca. Plataforma objetivo: Node 22.21.1 y Git SHA-1 en
macOS/Linux (usa `/dev/null`); Windows y repos Git SHA-256 no están validados.

## Autorización externa v1

Canal actual: GitHub Actions **Secret** `CI_CONTROL_CHANGE_AUTHORIZATION`,
exclusivamente en el Environment `ci-control-authorization`.
Contiene Base64 canónico del JSON UTF-8, no JSON plano. La biblioteca no lee env ni
conoce el transporte: conserva exactamente el contrato de nueve campos descrito
abajo. Solo el entrypoint confiable reconstruye el JSON desde el paso de la base;
nunca desde labels, comentarios, títulos, archivos o argumentos del candidato.

Campos exactos, sin extras ni ausencias:

```text
schemaVersion: 1
repository: "Enrique-Macias/rlvo-web"
pullRequest: entero positivo, igual al contexto confiable
baseSha: SHA base completo
headSha: SHA candidato completo
changesDigest: hexadecimal SHA-256 de 64 caracteres
authorizationId: identificador operativo de 1–80 caracteres [a-zA-Z0-9._-], inicia alfanumérico
issuedAt: UTC ISO 8601 con milisegundos, YYYY-MM-DDTHH:mm:ss.sssZ
expiresAt: mismo formato
```

Ventana positiva de máximo 24 horas; `issuedAt <= now < expiresAt`. Nuevo push, base,
repo, PR o digest necesita nuevo registro. No es una firma ni un secreto: su
autoridad procede del canal externo y del operador que puede editarlo. Los inputs
JSON se evalúan por sus valores; no se proporciona un formato firmado ni promesa
de rechazo de claves JSON duplicadas. El registro operativo debe tener claves únicas.

Sin cambios críticos no se requiere ni se evalúa una autorización vieja/malformada,
para que su caducidad no bloquee PRs ordinarios. Con diferencias críticas se exige
un registro válido. No se consume ni escribe: una autorización puede reevaluar el
mismo commit dentro de su ventana. No autoriza otras diferencias o PRs.

Un éxito devuelve `controlIntegrity: unchanged|authorized`, evidencia y siempre
`mergeApproval:false` y `legalVerificationRequired:true`. Solo constata igualdad de
inputs jurídicos entre base/head. **No sustituye** el checker del baseline aprobado,
la política drafts-only, los 23 marcadores, normalización, contratos ni tests legales.
La integración los intenta de forma independiente tras validar contexto y refs,
incluso cuando se rechaza la autorización de CI.

Errores son `ControlPolicyError` con `code` estable y mensaje prefijado. Códigos:
`CI_CONTEXT`, `CI_REF`, `CI_GIT`, `CI_ANCESTRY`, `CI_TREE`, `CI_BLOB_SIZE`,
`CI_ENTRY_TYPE`, `CI_POLICY_MISSING`, `CI_POLICY_SCHEMA`, `CI_LEGAL_IMMUTABLE`,
`CI_AUTH_REQUIRED`, `CI_AUTH_SCHEMA`, `CI_AUTH_BINDING`, `CI_AUTH_DIGEST`,
`CI_AUTH_TIME`, `CI_AUTH_NOT_YET_VALID`, `CI_AUTH_EXPIRED`. La biblioteca lanza; el
entrypoint de etapa 2 convierte cualquier rechazo en exit 1, sin catch permisivo,
continue-on-error o job condicional de aprobación.

## Transporte local 4B.2B: Secret, codec y control de salida

El único acceso permitido es `${{ secrets.CI_CONTROL_CHANGE_AUTHORIZATION }}` en
`steps[2].env.CI_CONTROL_CHANGE_AUTHORIZATION_B64` del job legal-integrity. No se
entrega al entorno general del job, checkout, setup o web-quality. El comando sigue
siendo literal: `node scripts/ci/trusted-legal.mjs`; no se interpola el valor en shell.

El entrypoint captura el transporte y elimina tanto ese nombre como el canal antiguo
`CI_CONTROL_CHANGE_AUTHORIZATION` del env recibido y de process.env **antes de cualquier
proceso hijo**. No lee el valor del canal antiguo. El JSON reconstruido solo vive en
memoria, no se exporta a env, archivos, argumentos, outputs o artifacts.

Codec: cadena estándar Base64 de hasta 8192 caracteres, longitud múltiplo de cuatro,
alfabeto A–Z/a–z/0–9/+/ con padding correcto, sin espacios, saltos de línea o alfabeto
URL-safe. Se exige igualdad byte a byte tras decodificar y recodificar, incluidos los
bits de padding. UTF-8 se decodifica con TextDecoder fatal; no se sustituyen bytes
inválidos ni se retira un BOM para convertir un JSON inválido en válido. Base64 vacío
o ausente conserva CI_AUTH_REQUIRED cuando existe un cambio crítico.

Solo se decodifica en PR con diferencias críticas y sin diferencias jurídicas. PR
ordinarios y workflow_dispatch ignoran incluso transporte inválido, como antes
ignoraban autorización malformada. Una diferencia jurídica conserva prioridad
CI_LEGAL_IMMUTABLE. El inspect previo y verifyControls leen los mismos SHA inmutables;
se conserva la inspección propia del validador original, sin aceptarle resultados
externos ni modificar su política.

Un codec inválido causa CI_AUTH_TRANSPORT dentro del bloque controls, exit 1 y
evaluación jurídica independiente. Base64 válido de `{` alcanza el validador original
y produce CI_AUTH_SCHEMA; bindings, digest, tiempos y nueve campos siguen intactos.
Los fallos de controls publican solo códigos conocidos y un mensaje constante;
un error interno no puede reflejar el JSON o el transporte en message/code. Las
excepciones originales no se vuelcan como stack o AggregateError completo.

Base64 no cifra ni otorga autoridad. GitHub enmascara el Secret de transporte, pero
el JSON decodificado no queda automáticamente protegido por esa máscara: la defensa
local es no imprimirlo. Los tests comprueban stdout/stderr, fragmentos privados
sintéticos y el env de todos los Git hijos. No simulan el runner ni prueban redacción
remota. Los metadatos deliberadamente públicos siguen siendo repo/PR/SHA, digest,
authorizationId, conclusiones y mergeApproval=false.

El candidato definitivo local usa el Environment fijo `ci-control-authorization`
solo en el job confiable, con `deployment: false`; la configuración remota sigue
pendiente de autorización. El código candidato no se ejecuta dentro de ese job,
pero web-quality sí ejecuta el candidato en otro runner y no referencia el
Environment ni el Secret. En forks se distingue pull_request de
pull_request_target: el segundo conserva el contexto privilegiado de la base.
Restricciones de Dependabot o Secrets ausentes nunca deben convertir un cambio
crítico en success/skipped.

## Environment del candidato definitivo: configuración y límites

```yaml
jobs:
  integrity:
    name: legal-integrity
    environment:
      name: ci-control-authorization
      deployment: false
```

El nombre y el booleano son literales, no dependen del candidato ni de inputs.
No se añade Environment al job web-quality. No cambian permisos, pasos, eventos,
checker, codec o contrato de autorización. El Secret se referencia únicamente en
el env del paso Node confiable; asociar el job al Environment no lo exporta por sí
solo a checkout/setup. No hay deployments obligatorios ni comandos de despliegue.

Antes de publicar o ejecutar este candidato debe autorizarse, crear y verificarse
el Environment por separado. Especificación: nombre exacto anterior, política de
ramas seleccionadas con una única regla **branch `main`**, sin tags ni comodines.
No usar «protected branches only»: seleccionaría otras ramas protegidas y depende
de protecciones cambiantes. Sin revisores humanos, wait timer o reglas de Apps de
protección de deployments; estas últimas son incompatibles con deployment: false.
No permitir bypass administrativo del Environment cuando sea configurable.
Crear inicialmente vacío; no introducir una autorización real en esta preparación.
No dejar que el primer workflow cree implícitamente un Environment sin restricciones.

Destino exclusivo del Secret `CI_CONTROL_CHANGE_AUTHORIZATION`: ese Environment.
Debe comprobarse antes de cada ventana de mantenimiento que no exista Secret
homónimo de repositorio ni un Secret de organización accesible, ni la Variable
antigua o el Secret espejo. No se agrega una expresión de fallback a ningún canal.
**Límite de procedencia:** GitHub resuelve secrets por nombre y ámbito; la expresión
`${{ secrets.CI_CONTROL_CHANGE_AUTHORIZATION }}` no permite exigir «solo Environment».
Si faltara allí y existiera a nivel repositorio/organización, GitHub podría entregar
ese valor. El YAML y el entrypoint no pueden distinguirlo. La exclusividad depende
de esa verificación remota y del control administrativo de configuración, no de una
prueba local ni de un indicador aportado por el candidato. No se inventa una
comprobación de procedencia ni se amplían permisos del token para consultar Secrets.

La política del Environment se evalúa sobre GITHUB_REF del evento, no sobre el ref
de actions/checkout. Para pull_request_target dirigido a main se espera la base
refs/heads/main; un pull_request de un candidato no obtiene acceso por hacer checkout
de main. Esto requiere verificación real en GitHub. Otros workflows confiables
ejecutados desde main y el propietario siguen siendo parte de la raíz de confianza:
el Environment no es una lista de workflows autorizados ni elimina esa autoridad.

Las reglas del Environment se evalúan antes de iniciar el job. Una restricción
incorrecta podría impedir incluso PR ordinarios, antes del control jurídico de Node.
Con el job iniciado y contexto/refs válidos, un transporte inválido sigue produciendo
CI_AUTH_TRANSPORT y la evaluación jurídica independiente. Un Secret ausente permite
PR ordinarios; cambios críticos conservan CI_AUTH_REQUIRED. La eliminación del Secret
no revoca un check exitoso anterior: se conserva el procedimiento de evidencia nueva.

En GitHub se verificaron la entrega del Environment Secret a legal-integrity mediante pull_request_target sobre main, la aceptación de la autorización exacta de PR #9 y el rechazo del mismo candidato sin autorización. Se observaron la asociación de los checks a P/App 15368, el control jurídico independiente y la ausencia de deployments y artifacts en esas ejecuciones.

Continúan fuera de esta prueba la precedencia ante Secrets homónimos en varios ámbitos, forks, otros eventos, la revocación automática de resultados anteriores y un intento real de merge rechazado. Las variantes de autorización inválida, caducada, con SHA/PR/digest distintos y la no herencia a procesos hijos cuentan con evidencia local; no se presentan como pruebas remotas realizadas.

Referencias oficiales:
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#secrets-context

### Evidencia local del candidato definitivo

Preparado en checkout independiente, HEAD separado en
`c5cc91b718b41aeab685f3fe57fa50e3db654d6b`, sin remotos configurados. Se transfieren
solo legal-trust.yml, trusted-legal.mjs, ci-workflows.test.mjs,
ci-trusted-entrypoint.test.mjs y este documento. El incremento Environment modifica
solo el workflow, sus pruebas YAML y la documentación; los otros dos archivos
conservan exactamente la implementación local de transporte previamente aceptada.
No incorpora la ascendencia de Fase 4C.1, ni crea un commit o hace staging de proyecto.

Validación con Node 22.21.1 y dependencias existentes copiadas, sin instalación:

- Corrida conjunta CI/jurídica: **258/258**, sin fallos, cancelaciones o skipped.
  Tras añadir dos negativos de eventos alternativos, se repite la suite YAML final:
  **44/44**. Son **260 casos distintos** aprobados, no una corrida única de 260:
  103 política + 18 integridad CI previa + 51 entrypoint + 44 YAML + 44 jurídicos.
- Los fixtures Git y sus commits/refs son desechables. Fetch restringido a file,
  con red bloqueada mediante GIT_ALLOW_PROTOCOL=file; nunca se hace fetch de GitHub.
  Los positivos verifican exit 0 y mergeApproval=false. Los negativos verifican
  exit 1 y códigos exactos, incluidos transporte/schema/binding/digest/caducidad,
  manteniendo resultado jurídico independiente. Ningún candidato se ejecuta.
- La auditoría YAML exige Environment literal y deployment booleano false,
  eventos originales, nombres de checks, acciones fijadas, permisos mínimos y
  Secret solo en el paso confiable. Sus negativos detectan ausencia/sustitución
  del Environment, deployment implícito o activo, eventos adicionales, condiciones
  de omisión, permisos de escritura y rutas alternativas de acceso a Secrets.
- Astro check: 75 archivos, cero errores/warnings/hints. Builds de producción y
  preview correctos con baseline aprobado explícito y auditorías estática, de
  branding y legal; se conservan las advertencias de 23 marcadores.
- Auditoría HTTP del build local: seis páginas 200, descargas y manifiesto exactos,
  18 versiones inexistentes 404. El sandbox bloqueó inicialmente el puerto local;
  la auditoría Node pasó fuera de esa restricción. La limpieza inicial por grupo
  de procesos fue rechazada; se cerró el PID de preview identificado y se verificó
  el puerto sin listener. No quedó una preview persistente ni hubo despliegue.
- Los 17 recursos jurídicos conservan bytes y modos contra main y baseline; sus
  metadatos se comparan antes/después para detectar reescrituras durante validación.
  Registro/lock vacíos, punteros null, cero releases, 23 marcadores. Fuera de los
  cinco archivos no hay diferencias de contenido o modo respecto a la base.

Comando de la corrida conjunta, ejecutado desde el checkout aislado:

```sh
GIT_ALLOW_PROTOCOL=file GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  GIT_TERMINAL_PROMPT=0 node --experimental-strip-types --test \
  tests/ci-control-policy.test.mjs tests/ci-integrity.test.mjs \
  tests/ci-trusted-entrypoint.test.mjs tests/ci-workflows.test.mjs \
  tests/legal-integrity.test.ts tests/legal-contract.test.ts
node --test tests/ci-workflows.test.mjs
```

No se ejecuta el entrypoint de producción directamente contra GitHub en local.
Esta evidencia no verifica semántica remota del Environment, precedencia de Secrets,
redacción del runner, bloqueo de PRs ni garantías de las protecciones de main.
El puente del PR #5 sigue descartado. No se autoriza ningún bootstrap administrativo
ni se cambia la configuración remota como consecuencia de estos resultados.

## Integración confiable: invocación y orden de evaluación

El workflow conserva `pull_request_target`, sus tipos y filtro main, los pins de
acciones y Node, runner hospedado, timeout y `contents: read`. No se instala npm ni
se concede escritura de variables/Secrets/refs, cachés o servicios. Solo se referencia
el Secret de autorización en el paso indicado arriba, sin permisos nuevos al token.
El checkout continúa fijado a `${{ github.event.pull_request.base.sha || github.sha }}`
con fetch-depth 0 y persist-credentials false. No se cambian web-quality ni su YAML.

Se elimina el if del job integrity, manteniendo **name: legal-integrity**. Si una
ejecución manual desde otra rama llega al entrypoint, falla en Node en lugar de
producir skipped; la política remota del Environment puede impedir el inicio antes.
No hay condiciones en los pasos, jobs auxiliares de aprobación o continue-on-error.

La invocación literal del paso se conserva:

```sh
node scripts/ci/trusted-legal.mjs
```

El entrypoint no admite flags de bypass, sustitución del checker o archivo de
autorización. No debe invocarse en el checkout de un candidato. Fuera del contexto
Actions admitido falla antes del fetch. Para pruebas locales usar las suites, no
simular Actions contra GitHub desde el directorio de trabajo.

El env general de la base conserva estas variables públicas:

```yaml
CI: 'true'
LEGAL_BASELINE_SHA: ${{ vars.LEGAL_BASELINE_SHA }}
BASE_SHA: ${{ github.event.pull_request.base.sha || github.sha }}
CANDIDATE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
PR_NUMBER: ${{ github.event.pull_request.number }}
```

El último paso añade únicamente:

```yaml
env:
  CI_CONTROL_CHANGE_AUTHORIZATION_B64: ${{ secrets.CI_CONTROL_CHANGE_AUTHORIZATION }}
```

Un Secret ausente se representa como vacío; es válido sin diferencias críticas.
No hay fallback implementado a vars, JSON plano, archivos o flags. La resolución de
Secrets entre ámbitos tiene el límite descrito arriba. La entrega efectiva y el análisis de redacción en el contexto de PR #9 cuentan
con la evidencia acotada descrita al inicio; otros contextos siguen sin probarse.
La API de Secrets permite consultar metadatos, no recuperar el valor como en Variables.

Secuencia del entrypoint:

1. Consume y retira el transporte del entorno heredable. Exige GITHUB_ACTIONS,
   repositorio literal, evento admitido y GITHUB_REF main.
   En PR valida PR_NUMBER y payload JSON del runner GITHUB_EVENT_PATH (máximo 2 MiB),
   incluyendo repo, PR, rama base y SHA base/head. No usa contenido libre como código.
   En manual exige base=head=GITHUB_SHA y PR_NUMBER vacío.
2. Verifica que HEAD del checkout corresponde a la base. Obtiene únicamente objetos
   Git desde la URL pública literal ya existente del repositorio; valida head del PR
   contra la ref descargada. Conserva igualdad pin/rama legal y ambas ascendencias.
3. Tras esas precondiciones, intenta el checker CI mediante import literal relativo
   al entrypoint de la base. Inspecciona y decodifica de forma diferida según lo
   anterior. Errores de codec/carga/sintaxis o internos quedan registrados como fallo,
   sin cargar código del candidato ni publicar mensajes arbitrarios del error.
4. Intenta **siempre** el flujo jurídico original `verifyGitCandidate`: checker
   extraído del SHA baseline, comparación histórica y drafts-only. No se modifican
   sus funciones, listas o reglas, ni se condiciona su invocación a autorización/éxito CI.
   Su secuencia interna de fallo cerrado se conserva: un fallo histórico no se oculta.
5. Si cualquiera falla, AggregateError CI_TRUST_FAILURE y exit 1. El JSON de error
   registra por separado controls/legal y sus causas. El catch final no transforma
   errores en éxito. Contexto/refs inválidos se rechazan antes de evaluar candidatos.
6. Solo ambas evaluaciones correctas producen exit 0 y JSON con candidato, base,
   baseline, evento, PR, digest, authorizationId (si procede), resultado jurídico y
   mergeApproval=false. No se imprime el JSON crudo de autorización ni secrets.

En PR #9, GitHub registró failure ante CI_AUTH_REQUIRED y success ante la
autorización válida. Se verificaron los jobs, eventos, candidato y App de origen.
Esto no demuestra por sí solo el rechazo de un intento real de merge.

## Autorizar mantenimiento legítimo (procedimiento sujeto a autorización específica)

1. Mantener Cloudflare desactivado. Preparar un PR técnico acotado, independiente de
   los documentos jurídicos. Identificar base/head exactos y revisar todo el diff.
2. Desde código confiable obtener inspección y digest; pasar pruebas específicas de
   la actualización. Revisar permisos/eventos, dependencias, cobertura y continuidad
   del siguiente checker. Un registro puede autorizar código peligroso si el dueño
   lo aprueba indebidamente; no hay análisis estático que sustituya esa decisión.
3. El propietario serializa la autorización con claves únicas, convierte los bytes
   UTF-8 a Base64 canónico y los entrega al Secret por stdin, sin imprimirlos ni
   incluirlos en argumentos. ID nuevo y caducidad corta; no cambiar baseline ni pin.
4. Obtener resultados nuevos mediante los eventos de PR elegibles. Verificar run,
   SHA, base, digest, ID, conclusión success real de ambos jobs y chequeo jurídico.
5. Fusionar solo con autorización de merge y reglas satisfechas. Si cambia un SHA,
   repetir el procedimiento; no ampliar la autorización a nombres de rama.
6. Registrar commit de merge y evidencia y retirar la autorización. La nueva política
   y checker solo serán confiables para posteriores PR una vez incorporados a main.

No requiere segunda persona ni una aprobación GitHub: es mantenimiento
administrativo explícito del único propietario. Si se añaden colaboradores, revisar
acceso a Secrets y capacidad de referenciarlos desde workflows. El token del job
continúa sin permisos para administrar Secrets, variables o refs.

## Revocación: obtener evidencia nueva antes de cualquier merge

**Retirar/caducar una autorización (Secret o canal anterior) NO revoca un check verde ya emitido.** Tampoco lo
revoca esta API, que no habla con GitHub. La ventana se comprueba al evaluar, no al
fusionar. Protocolo obligatorio del operador para una revocación previa al merge:

1. Cerrar el PR antes de retirar la autorización y verificar que no se fusionó; dejar
   registrado el head revocado y revisar que no se reutilice en otro PR abierto.
   Auto-merge debe permanecer desactivado. No continuar ante una carrera de merge.
2. Retirar la autorización externa y conservar su ID, SHA y causa. No aceptar como
   evidencia de revocación los resultados verdes anteriores del mismo head.
3. Con el PR aún cerrado, generar un **SHA head nuevo** (aunque el árbol fuera igual)
   o revertir los cambios críticos en un commit nuevo. Actualizar main si corresponde.
   No reabrir/reutilizar el head revocado. Prohibir operativamente su uso en otros PRs.
4. Si se mantiene el mantenimiento, emitir autorización nueva para los nuevos
   base/head/digest; si no, restaurar el árbol crítico de la base. No basta cambiar ID.
5. Reabrir solo con nuevo head y obtener resultados nuevos por evento de PR. Comprobar
   en GitHub que los contextos obligatorios pertenecen a ese candidato y no están
   skipped/neutral. Hasta completar esa evidencia no se permite merge.

La biblioteca prueba la reevaluación fallida al retirar autorización, el rechazo del
SHA nuevo con autorización vieja y las dos vías de recuperación. El cierre, rechazo
de reutilización del head y asociación GitHub son **procedimiento operativo**, no
enforcement implementado en esta etapa. Un operador que ignore el protocolo aún
podría reutilizar un resultado anterior que GitHub acepte. Enforcement automático
de revocación al instante del merge necesitaría otro diseño/servicio o control de
merge independiente y autorización separada; no se atribuye esa garantía al checker.

## Registro histórico de migración: puente descartado tras PR #5

Este apartado conserva el estado anterior al PR #6; no describe el main actual.

El workflow de main c5cc91b todavía ejecuta la versión que lee vars. Cambiar el
candidato no hace que esa base lea Secrets: el PR de migración necesita autorización
crítica válida por el canal antiguo. No se permite publicar su JSON sin protección,
omitir legal-integrity ni usar la copia candidata para autoautorizarse.

La prueba A/B de [PR #5](https://github.com/Enrique-Macias/rlvo-web/pull/5), Etapa
4B.2C, terminó en **FAIL**. Conservó base c5cc91b y candidato
`847a92917f951af7e24b574038ec8bf07cf8d526`. A usó un canario ficticio no autorizante
en la Variable; B añadió el Secret espejo no referenciado con los mismos bytes.
Ambas fases mostraron tres exposiciones completas y cero entradas enmascaradas.
Los cuatro jobs aprobaron, con controls unchanged y comprobación jurídica success:
A: legal-integrity 41166642515 / web-quality 41166642388;
B: legal-integrity 41166904011 / web-quality 41166903661.

El PR quedó cerrado sin merge, conservando rama y evidencia. Se retiró primero
`CI_CONTROL_CHANGE_AUTHORIZATION` y, tras finalizar los runs, el Secret temporal
`CI_CONTROL_BOOTSTRAP_MASK_PROBE`; la API confirmó ausencia de ambos. No se utilizó
ningún registro real de autorización ni se incorporó la migración. No se publica
el canario aquí. La prueba no identifica si la causa interna fue entrega o redacción.

Por decisión del propietario se descarta este puente. No volver a introducir una
autorización real por la Variable antigua ni interpretar los checks verdes como
éxito de confidencialidad. La migración Secret/Base64 permanece local. Cualquier
bootstrap administrativo exige un procedimiento nuevo, auditable y autorización
expresa de sus operaciones; este documento no concede bypass ni permiso de merge.
No modificar el baseline jurídico ni su Ruleset para resolver este bloqueo.

## Recuperación y bootstrap (referencia histórica etapas 1/2)

- Autorización ausente, caducada o incorrecta: mantener PR bloqueado, revisar, obtener
  contexto/digest nuevo y emitir otro registro o revertir cambios críticos en un
  commit nuevo. No deshabilitar checks, introducir un allow-all o modificar baseline.
- Política candidata eliminada/malformada: corregirla en otro commit; ni siquiera
  una autorización válida permite una política inutilizable o sin piso jurídico.
- Política base inexistente: bootstrap revisado. El main remoto 614b91ff no contiene
  esta política; no puede autoautorizar la instalación inicial. Incorporación mínima
  y explícitamente autorizada, con revisión del propietario y evidencia local.
- Checker/política base defectuosos: revertir el cambio a un estado conocido mediante
  PR si aún funciona el control; si impide todo PR, requiere intervención administrativa
  excepcional, acotada y expresamente autorizada, con registro y restauración de las
  protecciones. No hay bypass automático ni se promete eliminar todo bloqueo posible.
- Preparar bootstrap desde la línea de main remoto, en checkout separado autorizado,
  para no publicar incidentalmente el commit local 9161c0a ni otros incrementos.

Secuencia remota propuesta para el primer bootstrap, aún no ejecutada:

1. Aprobar por separado la revisión final y la preparación de un checkout aislado
   desde el SHA main remoto confirmado (último conocido 614b91ff...). Transferir solo
   los archivos autorizados de este endurecimiento, nunca la historia/commit 9161c0a.
2. Revisar diff, tests, política, permisos y legalidad congelada; preparar un commit/PR
   exclusivo solo cuando se autoricen esas operaciones. Conservar Cloudflare apagado.
3. El workflow viejo de main no importa control-policy ni compara la infraestructura
   CI. Que ese workflow o los tests del propio candidato pasen **no certifica** el
   endurecimiento que se está incorporando. La primera raíz necesita revisión
   explícita del propietario, evidencia local y autorización excepcional de bootstrap.
4. Incorporar el cambio mínimo con autorización de merge, sin tocar referencia legal,
   variable LEGAL_BASELINE_SHA o ruleset histórico. El primer commit confiable que
   contiene política/checker será la base de validación de posteriores PRs.
5. Autorizar luego pruebas remotas separadas: manual de diagnóstico de main y PR
   válido/negativos, verificando los SHA y ambos contextos. Crear la variable de
   mantenimiento únicamente si se autoriza y hace falta; no es requisito para PR normal.
6. Solo después, con autorización aparte, crear/activar main con PR obligatorio,
   cero aprobaciones y los checks de App GitHub Actions. No desactivar el control
   jurídico ni usar HEAD como baseline para completar el bootstrap.

El baseline jurídico permanece en bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 y su
ruleset 26149031 no interviene en el mantenimiento de CI. No hay release v1.0,
activación Supabase ni modificación de fuentes jurídicas en este mecanismo.

## Pruebas locales de esta etapa

```sh
node --test --test-concurrency=1 tests/ci-control-policy.test.mjs
```

No modifica package.json ni añade dependencias. El nombre del test coincide con el
glob existente test:ci; cuando se incorpore en una publicación futura, ese comando lo
recogerá. Eso no integra el checker en el job confiable ni configura reglas remotas.

La suite usa un repositorio Git temporal válido, objetos sin refs y fixtures
técnicos, reloj fijo y errores específicos. Incluye proceso exitoso exit 0 y negativo
exit 1 por CI_AUTH_REQUIRED, no por faltar contexto Git. Los negativos de autorización
mantienen digest y bindings válidos salvo el campo que se desea probar. No requieren
red, GitHub, Astro, npm install, builds, cambios en fuentes ni datos de producción.

Registro histórico de etapa 1, 29 de octubre de 2026: **101/101 pruebas nuevas correctas**,
0 fallidas, canceladas, skipped o pendientes; Node 22.21.1, Git 2.52.0, macOS arm64.
Incluye el harness válido exit 0 y negativo exit 1 por CI_AUTH_REQUIRED. Las 72
pruebas anteriores de Fase 4A no se reejecutaron en esa etapa: su autorización limitó
la ejecución a la suite nueva aislada. Tampoco se ejecutaron Astro check, builds,
smoke, full o workflows remotos. No se presenta la suite local como enforcement
de reglas o revocación en GitHub.

Verificación histórica de alcance de etapa 1: los 176 archivos previamente versionados conservaron
SHA-256, tamaño, modo, inode y timestamps durante el trabajo; incluye las 70 fuentes
protegidas de QA. Las fuentes conservan 23 marcadores: 5 en términos, 13 en privacidad
y 5 en eliminación (4 instancias PendingInfo y la fecha pendiente centralizada).
Es comprobación de fuentes sin generar HTML; no se ejecutó build. Registro y lock
siguen vacíos y los punteros null. Solo se añadieron los cuatro archivos de esta etapa.

### Resultado local de etapa 2

```sh
node --test --test-concurrency=1 tests/ci-*.test.mjs
node --experimental-strip-types --test tests/legal-integrity.test.ts tests/legal-contract.test.ts
```

- CI: **167/167**, desglosadas en 103 de política (101 originales y 2 de diagnóstico
  manual), 26 de entrypoint, 18 de integridad CI previa y 20 de YAML/permisos
  (10 originales más 10 negativos nuevos). Cero fail, cancelled, skipped o todo.
- Legal: **44/44** anteriores, sin modificar sus fuentes. Total conjunto: **211/211**.
- Node 22.21.1, Git 2.52.0, macOS arm64. Las pruebas de proceso ejecutan la copia del
  entrypoint materializada de una base sintética, manteniendo el candidato solo como
  objetos. El wrapper Git de tests reemplaza exclusivamente el fetch público literal
  por el repo temporal y restringe transporte a file; no es una opción de producción.
  Los objetos originales se leen del rlvo-web local hacia temporales. No hubo fetch
  remoto, credenciales, GitHub Actions, modificaciones remotas, previews o builds.
- Los 26 casos de entrypoint incluyen exit 0 válido; exit 1 por ausencia, schema,
  binding, digest o caducidad; checker/entrypoint/tests o YAML del candidato alterados;
  autorización en archivo ignorada; revocación; diagnóstico manual; validación de
  contexto/evento/pin; flags rechazados. Errores internos, sintaxis inválida del
  checker y throw null fallan sin impedir intentar el control jurídico original.
- Hay dos negativos con autorización CI válida y control CI success que confirman
  por causas específicas la ejecución del checker histórico y drafts-only. Otra
  prueba rechaza cambios jurídicos en ambas evaluaciones. No se suavizan controles.
- Comparación de los 176 archivos versionados previos: solo cambian los tres archivos
  autorizados de integración (workflow legal-trust, entrypoint trusted-legal y tests
  ci-workflows). De las 70 fuentes protegidas previas, 67 permanecen idénticas; las
  otras 3 son esos cambios CI revisables, no fuentes jurídicas. La política declarativa
  de etapa 1 permanece idéntica. Los 23 marcadores se conservan (5/13/5); canónicos,
  contrato, registro, lock, punteros, checker histórico, Analytics y Workers intactos.

Las pruebas locales no demuestran que GitHub resuelva vars en el evento real,
registre failure o asocie ambos checks al SHA requerido por un PR. No se ejecutaron
Astro check, builds, smoke, full o Lighthouse: no hay cambios de componentes ni del
sitio generado, y esta etapa valida integración CI sin publicación.

Cobertura: rutas declaradas y reservadas, tipos/modos/bytes, creación/eliminación/
rename, symlink/gitlink, working-tree no confiable, checker/tests/política del
candidato alterados, rechazo jurídico con autorización exacta, contexto/SHA/
ascendencia, digest/TTL, revocación y recuperación, límites de tamaño y ausencia de
ejecución del candidato incluso autorizado. No es un simulador del scheduler GitHub.

## Resultado local de 4B.2B

Validación del 31 de octubre de 2026 (UTC), Node 22.21.1, sin instalación de paquetes:

```sh
node --test --test-concurrency=1 tests/ci-workflows.test.mjs tests/ci-trusted-entrypoint.test.mjs
node --test --test-concurrency=1 tests/ci-control-policy.test.mjs tests/ci-integrity.test.mjs
node --experimental-strip-types --test tests/legal-integrity.test.ts tests/legal-contract.test.ts
```

- Entry point/procesos: **51/51**; auditoría YAML: **31/31**. Conjunto focalizado:
  **82/82**, incluye una repetición final de los 31 tests YAML sin sumarlos dos veces.
- Biblioteca de política y regresión CI previa: **121/121** (103 + 18).
- Jurídicas: **44/44**. Total distinto: **247/247**, sin fallos, cancelaciones,
  skipped o todo. Se conservan las 167 CI anteriores y se añaden 36 casos: 25 de
  proceso/transporte y 11 de YAML/aislamiento del Secret.
- Los positivos comprueban exit 0, authorized/unchanged y mergeApproval=false.
  Los negativos comprueban exit 1 y código exacto (transporte, schema, binding,
  digest, caducidad o prioridad jurídica). También se demuestra que una excepción
  que contiene JSON/código privado alcanza el throw previsto y no refleja su valor.
- Cada Git hijo del proceso bajo prueba comprueba ausencia de ambos nombres de
  autorización en su env. Fetch inicial explícito file:// y wrapper limitado a file;
  no se contacta GitHub ni se actualizan refs del proyecto. Fixtures y objetos Git
  sintéticos permanecen en temporales y se eliminan al terminar.
- Astro check: 80 archivos, 0 errores/warnings/hints. Builds producción y preview
  correctos con auditorías estática, branding y legal. Se ejecutaron en una copia
  temporal con node_modules copiado, sin npm install y con baseline aprobado explícito.
  Canónicos, registro, lock, punteros y contrato conservaron bytes y timestamps
  durante ambos builds. Las advertencias de 23 marcadores se mantienen visibles.
- Comparación previa/posterior: solo cambian los cinco archivos permitidos; los
  otros 176 archivos del snapshot, index y HEAD permanecen intactos. La política y
  biblioteca originales, checker histórico, textos jurídicos, Analytics, Workers,
  dependencias y fuentes de Fase 4C.1 no cambian. No se afirma igualdad de los 70
  archivos protegidos contra HEAD: los tres controles CI versionados autorizados
  sí difieren, como ya ocurría en el trabajo local anterior.
- Registro/lock vacíos, punteros null, cero releases y 23 marcadores, verificados
  además por comparación del working tree jurídico con el baseline bd46ee5.

No se ejecutaron PRs, workflows remotos, T05–T09 reales ni el canario del puente.
Tampoco se crearon Secrets/Variables, commits de proyecto, push, merges, despliegues
o cambios de configuración. La prueba de runner/enmascaramiento sigue pendiente.

## Límites y estado histórico de etapa 2

La raíz de confianza sigue incluyendo al propietario, main y su futura protección,
la máquina que prepara autorizaciones, Git/Node y permisos de configuración. No hay
WORM, análisis semántico de código autorizado ni garantía de tests honestos dentro
de un runner que ejecuta código arbitrario del candidato. No se protege el repo
completo ni se congelan los bytes HTML.

GitHub exige contextos/app, no identidad criptográfica del archivo de workflow; otra
ejecución de la misma App puede imitar nombres. skipped/neutral pueden satisfacer
reglas. Comparar todos los YAML detecta cambios desde la base, pero no demuestra por
sí mismo que GitHub exija esa ejecución. Antes de activar main hace falta validar PRs,
head/merge SHA, ausencia/fallo/suplantación y políticas del evento pull_request_target.
Los runs manuales previos no demuestran ese enforcement. Si se puede eludir, detener
el bootstrap y evaluar una raíz externa independiente en otra autorización.

Registro histórico de etapa 2: import desde base, variable externa declarada,
rechazo exit 1, ejecución jurídica independiente e incondicional tras precondiciones,
y pruebas del proceso real con Git temporal. No hay integración remota ni enforcement
de PR demostrado. El siguiente paso requiere revisión/autorización para cerrar esta
integración; bootstrap, commits, push, PRs, variables y main siguen siendo operaciones
separadas. No incorporar secretos de despliegue, npm o código del PR al job target.

Referencias: GitHub Docs, [checks obligatorios](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks),
[variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables),
[Secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
[redacción de datos estructurados](https://docs.github.com/en/actions/reference/security/secure-use),
[seguridad pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
