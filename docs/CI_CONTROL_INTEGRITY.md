# Fase 4A — Integridad de controles de CI, etapas 1 y 2

Estado: biblioteca y política de etapa 1, integradas **localmente** al entrypoint y
workflow legal-integrity en etapa 2. No publicado; no protege todavía los PR reales.
No hay variable remota nueva, ruleset de main, commit, push, PR ni despliegue creado.
No es un incremento de
Fase 4C. `9161c0a7c2cf27f0bb129643c8fea3371a96244b` permanece local.

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
Git de 10 s. No se afirman límites globales de duración del llamador: el futuro job
debe conservar su timeout propio. Plataforma objetivo: Node 22.21.1 y Git SHA-1 en
macOS/Linux (usa `/dev/null`); Windows y repos Git SHA-256 no están validados.

## Autorización externa v1

Nombre conectado localmente en etapa 2: `CI_CONTROL_CHANGE_AUTHORIZATION`. No existe
lectura automática de env en la biblioteca. El entrypoint confiable entrega el JSON desde
la configuración externa; nunca desde YAML del PR, labels, comentarios, títulos,
archivos de aprobación o argumentos definidos por el candidato.

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
La etapa 2 deberá ejecutarlos incondicionalmente, incluso tras mantenimiento de CI.

Errores son `ControlPolicyError` con `code` estable y mensaje prefijado. Códigos:
`CI_CONTEXT`, `CI_REF`, `CI_GIT`, `CI_ANCESTRY`, `CI_TREE`, `CI_BLOB_SIZE`,
`CI_ENTRY_TYPE`, `CI_POLICY_MISSING`, `CI_POLICY_SCHEMA`, `CI_LEGAL_IMMUTABLE`,
`CI_AUTH_REQUIRED`, `CI_AUTH_SCHEMA`, `CI_AUTH_BINDING`, `CI_AUTH_DIGEST`,
`CI_AUTH_TIME`, `CI_AUTH_NOT_YET_VALID`, `CI_AUTH_EXPIRED`. La biblioteca lanza; el
entrypoint de etapa 2 convierte cualquier rechazo en exit 1, sin catch permisivo,
continue-on-error o job condicional de aprobación.

## Integración local de etapa 2: invocación y orden de evaluación

El workflow conserva `pull_request_target`, sus tipos y filtro main, los pins de
acciones y Node, runner hospedado, timeout y `contents: read`. No se instala npm ni
se concede acceso a secrets, escritura de variables/refs, cachés o servicios.
El checkout continúa fijado a `${{ github.event.pull_request.base.sha || github.sha }}`
con fetch-depth 0 y persist-credentials false. No se cambian web-quality ni su YAML.

Se elimina el if del job integrity, manteniendo **name: legal-integrity**. Una
ejecución manual desde otra rama falla en Node en lugar de producir skipped.
No hay condiciones en los pasos, jobs auxiliares de aprobación o continue-on-error.

La invocación literal del paso se conserva:

```sh
node scripts/ci/trusted-legal.mjs
```

El entrypoint no admite flags de bypass, sustitución del checker o archivo de
autorización. No debe invocarse en el checkout de un candidato. Fuera del contexto
Actions admitido falla antes del fetch. Para pruebas locales usar las suites, no
simular Actions contra GitHub desde el directorio de trabajo.

El YAML de la base entrega estas variables:

```yaml
CI: 'true'
LEGAL_BASELINE_SHA: ${{ vars.LEGAL_BASELINE_SHA }}
CI_CONTROL_CHANGE_AUTHORIZATION: ${{ vars.CI_CONTROL_CHANGE_AUTHORIZATION }}
BASE_SHA: ${{ github.event.pull_request.base.sha || github.sha }}
CANDIDATE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
PR_NUMBER: ${{ github.event.pull_request.number }}
```

La autorización procede de `vars` del repositorio base, no de la rama, labels,
body, archivos o scripts del PR. Una variable ausente se representa como vacía;
esa ausencia es válida cuando no hay diferencias críticas. No se ha creado ni
consultado su valor remoto. La referencia YAML está cubierta por auditoría local;
la disponibilidad/lectura efectiva en un evento pull_request_target real queda
**NO VERIFICADA** hasta una ejecución remota autorizada.

Secuencia del entrypoint:

1. Exige GITHUB_ACTIONS, repositorio literal, evento admitido y GITHUB_REF main.
   En PR valida PR_NUMBER y payload JSON del runner GITHUB_EVENT_PATH (máximo 2 MiB),
   incluyendo repo, PR, rama base y SHA base/head. No usa contenido libre como código.
   En manual exige base=head=GITHUB_SHA y PR_NUMBER vacío.
2. Verifica que HEAD del checkout corresponde a la base. Obtiene únicamente objetos
   Git desde la URL pública literal ya existente del repositorio; valida head del PR
   contra la ref descargada. Conserva igualdad pin/rama legal y ambas ascendencias.
3. Tras esas precondiciones, intenta el checker CI mediante import literal relativo
   al entrypoint de la base. Incluso errores de carga/sintaxis, errores internos y
   rechazos quedan registrados como fallo, sin cargar código del candidato.
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

En producción futura GitHub deberá convertir el exit 1 en failure del job; aquí
solo se demuestra el código del proceso y la ausencia de mecanismos YAML permisivos.
No se afirma todavía asociación con el PR, bloqueo de merge o protección de main.

## Autorizar mantenimiento legítimo (operación futura, no ejecutada)

1. Mantener Cloudflare desactivado. Preparar un PR técnico acotado, independiente de
   los documentos jurídicos. Identificar base/head exactos y revisar todo el diff.
2. Desde código confiable obtener inspección y digest; pasar pruebas específicas de
   la actualización. Revisar permisos/eventos, dependencias, cobertura y continuidad
   del siguiente checker. Un registro puede autorizar código peligroso si el dueño
   lo aprueba indebidamente; no hay análisis estático que sustituya esa decisión.
3. El propietario registra fuera del PR la autorización exacta, con ID nuevo y
   caducidad corta. No cambiar el baseline jurídico ni el pin para autorizar CI.
4. Obtener resultados nuevos mediante los eventos de PR elegibles. Verificar run,
   SHA, base, digest, ID, conclusión success real de ambos jobs y chequeo jurídico.
5. Fusionar solo con autorización de merge y reglas satisfechas. Si cambia un SHA,
   repetir el procedimiento; no ampliar la autorización a nombres de rama.
6. Registrar commit de merge y evidencia y retirar la autorización. La nueva política
   y checker solo serán confiables para posteriores PR una vez incorporados a main.

No requiere segunda persona ni una aprobación GitHub: es mantenimiento
administrativo explícito del único propietario. Las variables de repo pueden ser
editables por colaboradores; si se añaden, revisar este modelo y los accesos a API.
El token del job debe continuar sin permisos de escritura de variables o refs.

## Revocación: obtener evidencia nueva antes de cualquier merge

**Retirar/caducar una variable NO revoca un check verde ya emitido.** Tampoco lo
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

## Recuperación y bootstrap

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

## Límites y etapa 2 pendiente

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

Etapa 2 implementada localmente: import desde base, variable externa declarada,
rechazo exit 1, ejecución jurídica independiente e incondicional tras precondiciones,
y pruebas del proceso real con Git temporal. No hay integración remota ni enforcement
de PR demostrado. El siguiente paso requiere revisión/autorización para cerrar esta
integración; bootstrap, commits, push, PRs, variables y main siguen siendo operaciones
separadas. No incorporar secretos de despliegue, npm o código del PR al job target.

Referencias: GitHub Docs, [checks obligatorios](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks),
[variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables),
[seguridad pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
