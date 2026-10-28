# Fase 4A — CI reproducible y confianza de documentos legales

Implementación local aprobada para commit, sujeta a la revisión final de seguridad. Sin push, deploy, modificación remota de GitHub/Cloudflare, migraciones ni cambios en Supabase, app móvil o Analytics. No incluye axe, pruebas visuales o navegadores de los bloques siguientes.

## Situación comprobada y límites

Consulta de metadatos de solo lectura del 28 de octubre de 2026: `Enrique-Macias/rlvo-web` es público, pertenece a una cuenta personal y su rama por defecto es `main`. No se inspeccionaron ni modificaron billing, reglas activas, colaboradores, políticas de Actions o variables. No afirmar que existe protección remota.

El commit `bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4` es el candidato inicial aprobado para la referencia histórica. Que exista localmente no lo convierte en una rama protegida ni demuestra que esté publicado en GitHub.

El diseño usa las posibilidades de un repositorio público personal: rulesets/protección de ramas y CODEOWNERS. No presupone workflows obligatorios de una organización, GitHub Enterprise ni un plan privado. Su disponibilidad efectiva y configuración deberán comprobarse por un administrador con autorización.

## Dos workflows y dos niveles de confianza

### Calidad del candidato: `.github/workflows/web-ci.yml`

Eventos `pull_request` hacia main, `push` a main y ejecución manual. El checkout usa el SHA exacto del head del PR; no pretende verificar el commit sintético de merge. El control de confianza exige que el head contenga la base del evento y la protección remota deberá exigir una rama actualizada.

Runner hospedado `ubuntu-24.04`, `contents: read`, sin secrets, credenciales persistentes, submódulos, LFS, caché compartida, subida/descarga de artefactos ni despliegue. No runners propios. No `pull_request_target` en este workflow.

`node scripts/ci/verify-web.mjs` realiza:

1. Exige un SHA completo en `LEGAL_BASELINE_REF`, obtenido de `vars.LEGAL_BASELINE_SHA`, sin fallback a HEAD o al candidato inicial. Comprueba que no existan releases y que los datos jurídicos coincidan con ese baseline.
2. Captura los inputs jurídicos y package.json/package-lock.json, antes incluso de instalar. Registra SHA-256, tamaño, modo, inode, dispositivo, mtime y ctime. Comprueba también adiciones/eliminaciones y rechaza symlinks.
3. Ejecuta `npm ci --ignore-scripts --no-audit --no-fund`. Usa las integridades del lock, sin resolver versiones nuevas ni ejecutar lifecycle scripts de instalación.
4. Ejecuta `test:ci`, normalización en modo lectura, las 44 pruebas legales y Astro check.
5. Construye preview y producción mediante los scripts existentes, incluyendo auditorías estática, branding y legal. Deja producción como último artefacto.
6. Inicia una instancia de preview por la API de Astro en un proceso independiente y puerto efímero, para cada build. No reutiliza ni detiene la preview del usuario. Ejecuta el test HTTP existente: seis páginas 200, descargas idénticas, manifiesto y 18 rutas inexistentes 404.
7. Tras cada comando contrasta los inputs con el snapshot, detectando incluso una reescritura con idénticos bytes. Repite la política jurídica al final. Detiene sus procesos y limpia temporales en éxito o error.

El snapshot es un detector de regresiones dentro de un job que ejecuta código del candidato. No es una barrera contra un candidato malicioso que controle todo su proceso y pueda falsificar sus propios scripts, tests o resultados. Esa amenaza se aborda mediante el workflow independiente y las revisiones obligatorias. Este job no tiene acceso a credenciales de Cloudflare/Supabase ni autoriza publicación.

### Control independiente: `.github/workflows/legal-trust.yml`

Evento `pull_request_target`, solo hacia main, y ejecución manual únicamente desde main. Esta es una excepción deliberada para cargar el control desde la base, sin dejar que el PR cambie el código que lo audita. `contents: read` es explícito; las demás capacidades no se conceden. No se referencia ningún secret, token de despliegue, caché o artefacto. Los runners de ambos workflows son distintos.

El checkout del control se fija al SHA de la base del evento. **Nunca** se hace checkout del candidato, se importa un módulo suyo, se ejecuta npm o se carga su configuración Astro en este job. `scripts/ci/trusted-legal.mjs`, cargado de esa base, solo:

1. Valida los SHA y el número del PR antes de construir argumentos. Usa `execFileSync` con arrays, sin interpolar títulos, ramas o bodies en shell.
2. Descarga desde la URL pública literal del repositorio la rama `legal-history-baseline` y el head del PR como objetos Git. No necesita credenciales persistentes ni usa una URL aportada por el fork.
3. Exige que `vars.LEGAL_BASELINE_SHA` sea un SHA completo y coincida exactamente con el tip de `refs/heads/legal-history-baseline`. Falla si falta cualquiera o si se están actualizando de forma descoordinada. Un cambio de variable por sí solo no puede escoger otro checker.
4. Exige que el baseline sea ancestro de la base y esta sea ancestro del candidato. Un PR atrasado debe actualizarse. Si el head cambió durante el fetch, falla y debe repetirse para el nuevo SHA.
5. Lee inputs jurídicos exclusivamente mediante `git ls-tree`/`cat-file`: blobs regulares 100644, rutas acotadas, sin Git replace, symlinks, gitlinks, filtros, extracción tar ni checkout. Las lecturas tienen límites de tamaño.
6. Extrae `scripts/check-legal-baseline.mjs` **del SHA del baseline**, a un directorio temporal separado, e importa ese código confiable. El checker actual solo usa built-ins de Node y comprueba bytes y metadata históricos. Los módulos de `scripts/ci/` proceden de la base revisada, no del PR.
7. Aplica además la política `drafts-only` desde el control de la base: registro y lock vacíos, punteros null, sin archivos legales añadidos o eliminados y coincidencia byte por byte con los borradores, contrato y fuentes auxiliares aprobados. Conserva los 23 marcadores (5 términos, 13 privacidad, 5 eliminación).

La coincidencia entre rama y pin **no prueba vía API que la rama tenga protección habilitada**. La protección es una configuración externa pendiente. Un administrador comprometido o con bypass sigue formando parte de la raíz de confianza; este repositorio no ofrece WORM ni protección frente a ese actor.

## Riesgo particular de pull_request_target

GitHub documenta el riesgo de ejecutar código del PR con la confianza de la base. Aquí no ocurre: el candidato se trata solo como blobs, en un job sin secrets, npm o permisos de escritura. No añadir en el futuro builds, `require/import` del candidato, checkout del fork, scripts descargados del PR o consumo de sus artefactos a este workflow.

La documentación oficial consultada el 28 de octubre de 2026 describe además una política por defecto para repositorios públicos que bloquea `pull_request_target`: se encuentra en modo evaluate y anuncia enforcement para repositorios afectados el 2 de diciembre de 2026. **No se comprobó si aplica a este repositorio ni se modificó.** Antes de habilitar el control habrá que revisar las políticas efectivas y autorizar por separado cualquier excepción limitada a este workflow. Si la política lo bloquea, el check obligatorio debe permanecer sin éxito; no desactivar el control ni ampliar permisos como fallback.

Si no se autoriza este evento, se necesita aprobar otra raíz de ejecución independiente, por ejemplo un check externo de una GitHub App dedicada o una infraestructura de organización adecuada. No se implementa esa alternativa ni se crea una App en 4A.

## Pins y dependencias

- `actions/checkout` v6.0.2: `de0fac2e4500dabe0009e67214ff5f5447ce83dd`.
- `actions/setup-node` v6.1.0: `395ad3262231945c25e8478fd5baf05154b1d79f`.
- Node 22.21.1 y npm 10.9.4: versiones exactas del entorno validado de Fase 3; el runner local las exige. No se presentan como los parches más recientes. Revisar advisories y actualizar los pins mediante un cambio aprobado antes de habilitar CI si corresponde. El runtime de las propias acciones es independiente del Node utilizado para el proyecto.
- `setup-node` declara `package-manager-cache: false`; no se utiliza `actions/cache` ni se conserva estado entre PRs. `persist-credentials: false` impide dejar la credencial de checkout al código del candidato.
- `yaml` 2.9.1 pasa a dependencia explícita de desarrollo para analizar los workflows con claves únicas y verificar su política de seguridad. Esa versión ya estaba en el lock transitivamente; no se incorporan paquetes resueltos nuevos ni JavaScript al sitio.

Los SHA de las acciones se contrastaron con los commits enlazados desde sus releases oficiales. Cambiar un pin exige revisar su procedencia y el diff, repetir las verificaciones y obtener revisión. El lock de npm y el runtime fijado hacen reproducible la selección de dependencias. La imagen Ubuntu hospedada y servicios de descarga siguen evolucionando: no se garantiza un artefacto completo idéntico bit por bit entre plataformas. Los canónicos sí se comparan estrictamente byte por byte.

## CODEOWNERS, checks y límites reales

`.github/CODEOWNERS` prepara al propietario verificado como revisor de workflows, controles, scripts, paquetes, pruebas e inputs legales. No envía notificaciones por sí mismo mientras permanezca local y no activa revisiones obligatorias. GitHub utiliza el CODEOWNERS de la base del PR; debe protegerse también el propio `.github/`.

Para que el modelo resista un PR que cambie a la vez workflow, checker y lock, se necesitan revisiones obligatorias de esos paths, desestimar aprobaciones obsoletas, exigir revisión del último push y bloquear push directo/borrado/force-push en main, limitando bypasses. No basta con seleccionar un nombre de check: un workflow nuevo podría intentar imitarlo. Exigir el origen GitHub Actions reduce suplantación por otras Apps, pero no distingue por sí mismo dos workflows de la misma App; la revisión de todos los workflows sigue siendo necesaria.

El propietario no puede aprobar su propio PR. Se requiere definir un segundo revisor de confianza con permiso write y ajustar CODEOWNERS antes de imponer esa regla a cambios del propietario. No se inventan colaboradores ni se asigna acceso remoto en este bloque.

Tras un push autorizado, comprobar en PRs reales que `web-quality` y `legal-integrity` pertenecen al SHA/candidato esperado y se pueden exigir como checks. Una ejecución manual no demuestra que esos checks satisfagan una regla de PR. No se configura merge queue: su evento y pruebas requerirían aprobación separada.

## Bootstrap remoto: pasos pendientes de autorización

1. El commit local de 4A cuenta con autorización; el push y la incorporación remota requieren autorización separada. Revisar manualmente el bootstrap; hasta que el control exista en main no hay raíz remota revisada desde la que ejecutar el nuevo job. No hay bypass automático para este primer caso.
2. Asegurar que el commit inicial bd46ee5 completo existe en el repositorio remoto autorizado y es ancestro de main. No hacer squash/rebase que cambie ese SHA sin aprobar otro candidato. Crear `legal-history-baseline` en ese commit, tras revisar su contenido vacío de releases. Si ya existe una referencia con ese nombre, detener el bootstrap e inspeccionar su historial; nunca sobrescribirla o resetearla al candidato inicial. No moverla silenciosamente al último HEAD.
3. Proteger la rama de baseline contra modificación no autorizada, borrado y force-push, restringir actores/bypasses y definir responsables de su avance. Comprobar las reglas efectivas, no solo que el nombre de la rama exista.
4. Configurar la variable no secreta `LEGAL_BASELINE_SHA` con ese SHA, controlar quién puede editarla y verificar su coincidencia con la rama. Si no existe, ambos workflows fallan cerrado.
5. Definir el segundo revisor y proteger main con revisiones de CODEOWNERS y checks obligatorios de origen esperado. Confirmar disponibilidad en el repositorio público personal y revisar bypass de administradores.
6. Revisar la política efectiva de eventos de Actions y, solo si se autoriza, permitir el caso acotado `pull_request_target`. Mantener el token predeterminado y los permisos de estos jobs de solo lectura. No añadir secrets o accesos Cloudflare/Supabase.
7. Ejecutar PRs controlados: caso válido, cambio de bytes y del lock a la vez, intento de quitar el control en un workflow, pin discrepante, PR atrasado y sincronización durante fetch. Incluir un fork autorizado si procede. Verificar que los casos negativos bloquean la integración y que el check no se omite por políticas o asociaciones de SHA.

La autorización de commit local no habilita ninguno de los ajustes ni operaciones remotas de esta lista. No se han ejecutado; solo se consultaron metadatos públicos del repositorio y documentación oficial.

## Avanzar el baseline histórico

No se actualiza desde Actions, desde el PR ni automáticamente después de un build. Para incorporar futuros releases reales se requiere primero otra autorización jurídica y una modificación expresamente revisada de la política `drafts-only`, que hoy rechaza cualquier release aunque se cambie el pin.

Después de aprobar contenido, identificación, bytes, metadata, publicación y registro conforme al runbook PL-016, el responsable comparará el nuevo estado con el baseline anterior usando el checker de este último. Todas las entradas anteriores deben permanecer idénticas; solo se añaden las aprobadas. Revisar también cualquier cambio del código que se extraerá del nuevo baseline.

Autorizar por separado el avance **fast-forward** de `legal-history-baseline` al commit aprobado de la línea de main y luego actualizar el pin externo al mismo SHA, en una ventana controlada. Durante una discrepancia CI falla cerrado. Conservar el SHA anterior y la evidencia; no eliminar URLs/entradas históricas ni sustituir sus hashes. La siguiente revisión utilizará el checker y el lock del nuevo baseline, no siempre el lock vacío inicial.

La activación de `documentos_legales` continúa siendo otra operación, fuera de CI y de 4A. No se modifica ni reutiliza `staging-prueba`. Éxito técnico no es aprobación jurídica ni autorización de INSERT/deploy.

## Comprobación local y lo que aún no puede probarse

```sh
# Candidato inicial explícito para pruebas locales; no es una referencia protegida remota.
LEGAL_BASELINE_REF=bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4 npm run ci:web
```

Reinstala node_modules desde el lock; necesita acceso al registro npm y a localhost. Los snapshots y previews son temporales y no se añaden al repositorio. No requiere GitHub, tokens de Cloudflare o Supabase. La entrada `trusted-legal.mjs` comprueba el contexto Actions y no permite simular una protección remota mediante un flag local; sus funciones puras y de lectura Git se prueban por separado.

Los tests de 4A cubren pin inválido/discrepante, cambio del checker del candidato, fuentes alteradas, marcadores, intento de release/punteros, históricos y lock reescritos, snapshots de lecturas/escrituras/adiciones/eliminaciones/symlinks y regresiones peligrosas en YAML/permisos/acciones/cachés. Todo material de prueba de releases existe exclusivamente en memoria, no como documento aprobado ni artefacto público.

Pendiente de GitHub real: asociación de checks con el PR y SHA, fetch de refs remotos, disponibilidad del baseline en remoto, política del evento target, permisos/token efectivos, aprobaciones de forks, validación de CODEOWNERS y enforcement de reglas/bypasses. Pendiente de bloques posteriores: axe/WCAG completo, navegadores/dispositivos, headers efectivos de Cloudflare y revisión de Analytics/privacidad.

## Referencias oficiales consultadas

- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://github.com/actions/checkout/releases/tag/v6.0.2
- https://github.com/actions/checkout/commit/de0fac2e4500dabe0009e67214ff5f5447ce83dd
- https://github.com/actions/setup-node/releases/tag/v6.1.0
- https://github.com/actions/setup-node/commit/395ad3262231945c25e8478fd5baf05154b1d79f

## Resultado local del bloque

Ejecución completa de `npm run ci:web` en macOS arm64 con el candidato inicial explícito: correcta. Instalación limpia desde lock: 296 paquetes, con lifecycle scripts deshabilitados; 28/28 controles de 4A y 44/44 pruebas legales; Astro check sobre 62 archivos, cero errores, warnings o hints; ambos builds y sus auditorías correctos. En cada build, seis páginas respondieron 200, las descargas coincidieron byte por byte y 18 rutas inexistentes respondieron 404 real. Las dos previews temporales se cerraron y se restauró el artefacto de producción.

Las 13 entradas vigiladas conservaron hashes y metadata filesystem durante toda la ejecución. Los 23 marcadores permanecen visibles en el HTML generado (5/13/5), el registro y lock continúan vacíos y los punteros null. La revisión comparó además 58 archivos protegidos con el commit de Fase 3: intactos, incluidos contrato, canónicos, checker original, Analytics, Workers y assets. No hay paquetes resueltos nuevos en el lock, solo la declaración dev de yaml ya existente.

Un primer intento de instalación falló por restricciones del sandbox y se repitió con acceso autorizado al registro npm y localhost. Durante la preparación también se corrigió el uso de la CLI de preview, que detectaba una instancia preexistente: el runner final usa una instancia propia por la API y dejó aquella intacta. Los resultados anteriores corresponden al runner corregido.

La validación YAML y los controles semánticos se ejecutaron localmente; no se ejecutó un scheduler de Actions ni se afirma una validación remota de GitHub. Este bloque cuenta con autorización para un commit exclusivamente local tras la revisión final de seguridad; ningún check o ajuste remoto fue creado. No se iniciaron 4B/4C.
