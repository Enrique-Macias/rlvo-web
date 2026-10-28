# Versionado legal — implementación técnica de Fase 3

Estado: implementación técnica aprobada para cierre mediante un commit local, sin publicación ni activaciones. No existen releases jurídicos. Los alias continúan mostrando borradores y conservan 23 marcadores `[[POR CONFIRMAR: …]]` entre términos (5), privacidad (13) y eliminación de cuenta (5).

## Fuentes de verdad y alcance

`docs/PL-016-WEB-INTEGRATION-CONTRACT.md`, entregado por el equipo móvil, describe el backend en `main` 38b6b73, sin consultar bases remotas. Se conserva sin cambios. Las decisiones de implementación autorizadas por el responsable de RLVO resuelven sus puntos abiertos sobre formato, normalización, rutas, identificadores y fuente editorial. No se ha comprobado la configuración efectiva de una base remota.

rlvo-web es la fuente editorial de los canónicos aprobados. El repositorio móvil conservará copias verificadas en `docs/legal/versiones/<version>/`; esas copias no constituyen una segunda fuente editable. Este trabajo no escribe en ese repositorio ni en Supabase. `staging-prueba`, sus HTML y sus hashes permanecen como excepción histórica y nunca se reutilizan.

Se conserva Astro estático, Workers Static Assets, `wrangler.jsonc`, el dominio canónico `https://www.rlvo.com.mx`, los redirects existentes y Analytics. Los headers de descarga son archivos estáticos, sin Worker ejecutable ni backend nuevo. No se introducen scripts cliente.

## Contenido y normalización

Fuentes actuales: `src/content/legal/drafts/terminos.md` y `privacidad.md`. El título, introducción, fecha y cuerpo proceden del mismo Markdown; no dependen de interpolaciones del sitio. Los H2 llevan anchors editoriales explícitos `{#id}`, que el renderer convierte en secciones sin mostrarlos como texto. No se admiten HTML, MDX, interpolaciones, código ni protocolos activos. El Markdown se procesa con `@astrojs/markdown-satteri` 0.4.2, paquete que Astro ya incluía transitivamente; declararlo directamente evita depender de esa relación interna, sin añadir otro motor o paquetes nuevos al lock.

Perfil `rlvo-markdown-utf8-nfc-lf-1`, aplicado al archivo completo, incluidos encabezado y anchors:

1. Decodificar UTF-8 estrictamente; rechazar bytes inválidos.
2. En edición explícita, eliminar BOM inicial y normalizar Unicode a NFC.
3. Convertir CRLF/CR a LF.
4. Eliminar espacios ASCII U+0020 y tabuladores U+0009 al final de cada línea.
5. Mantener exactamente un LF final; rechazar texto vacío, BOM interior y controles no admitidos.
6. Codificar UTF-8 sin BOM. SHA-256 se calcula sobre esos bytes exactos, sin pasar por HTML, conversión de texto o normalización durante la verificación.

`npm run normalize:legal` comprueba; `npm run normalize:legal -- --write` modifica exclusivamente los dos borradores, solo cuando el cambio editorial esté autorizado. Nunca normaliza releases. `assertCanonical` y `canonicalSha256` fallan si los bytes no cumplen; no los corrigen. `.gitattributes` desactiva conversión de finales de línea para todos los canónicos. Una corrección de un release requiere otra versión.

Las pruebas de migración comparan texto visible, título, introducción, fecha, enlaces y anchors con la Fase 2 (`tests/fixtures/legal-migration.json`). Sus huellas son controles de regresión de texto, no hashes de PL-016 ni del HTML histórico de STAGING.

## Registro y compatibilidad con el catálogo

`legal/registry.json` contiene `schemaVersion: 1` y una lista `releases`, hoy vacía. Cada entrada futura contiene exclusivamente las columnas reales necesarias para preparar una alta:

- `tipo`: `terminos` o `aviso_privacidad`, texto con CHECK, no enum de PostgreSQL.
- `version`: CHECK exacto `^[a-z0-9][a-z0-9.-]{0,39}$`, 1–40 caracteres. Se conserva literalmente en la URL, incluso puntos o guiones repetidos válidos. Se reserva adicionalmente cualquier identificador que contenga `staging-prueba`.
- `vigente_desde`: timestamptz. La edición web exige ISO 8601, zona explícita `Z` u offset hasta ±14:00 y hasta seis decimales. Es un subconjunto editorial del tipo PostgreSQL, no una restricción adicional atribuida al backend. Se rechazan fechas inválidas. La comparación usa microsegundos, evitando perder precisión o admitir dos offsets del mismo instante.
- `url`: URL HTTPS inmutable de la página, exactamente `https://www.rlvo.com.mx/terminos/{version}` o `/privacidad/{version}`. Este origen y correspondencia son una regla web más estricta que el CHECK HTTPS del backend.
- `contenido_sha256`: 64 caracteres hexadecimales minúsculos en los JSON web; corresponde al digest crudo de 32 bytes de la columna `bytea`.

Se comprueban PK `(tipo, version)` y UNIQUE `(tipo, vigente_desde)`. `created_at` se omite: lo asigna `now()` en el backend. No se inventan `id`, `activa`, enums o campos de aceptación en el catálogo. `hexToBytea` produce `\x<hex>` para PostgREST; para SQL se utilizará `decode('<hex>', 'hex')`, con el digest calculado fuera de PostgreSQL. Nunca se hashea un literal Markdown mediante una conversión SQL implícita a bytea.

`aviso_privacidad` se mapea explícitamente al segmento público `privacidad` mediante `contract.ts`. La aceptación de términos usa `accion='aceptado'`; la presentación del aviso usa `accion='presentado'` y no constituye consentimiento. Esta web no invoca `estado_terminos`, `aceptar_terminos` ni escribe aceptaciones.

## Releases, punteros y manifiesto

Un release futuro vivirá en `src/content/legal/releases/{terminos|privacidad}/{version}/document.md`. Se rechaza su incorporación si contiene marcadores pendientes, la palabra «borrador» o una fecha de actualización sin confirmar. Esto es un filtro técnico; la aprobación jurídica es una revisión humana obligatoria y no puede inferirse de que el archivo pase el filtro.

`src/config/legal-current.json` tiene punteros explícitos `terminos` y `aviso_privacidad`, hoy `null`. No se infiere la vigente ordenando versiones ni se consulta Supabase. Un puntero debe referir un release y no anticipar su `vigente_desde`. Registrar un documento web no lo activa en la base. Es posible publicar primero una URL inmutable manteniendo los punteros anteriores. Actualizar los punteros requiere coordinar la activación por separado; una web estática no sigue automáticamente el reloj o el catálogo de Supabase.

`/legal/manifest.json` usa `format: rlvo-legal-manifest`, `formatVersion: 1`, perfil canónico, algoritmo `SHA-256`, codificación `hex`, `current` explícito y `releases`. Cada release expone las cinco columnas anteriores más tres campos exclusivamente web: `canonical_url`, `checksum_url` y `bytes`. Estos tres campos no son columnas de Supabase. El manifiesto no es un volcado de la base ni demuestra que se haya ejecutado un INSERT. Actualmente no contiene registros ni hashes de releases; los borradores se descargan por separado.

## Rutas y SEO

- `/terminos` y `/privacidad`: borrador identificado mientras el puntero sea null; después, contenido íntegro de la versión seleccionada, sin redirección.
- `/terminos/{version}` y `/privacidad/{version}`: solo se generan para entradas del registro. El segmento coincide exactamente con `version`. Ningún `v1.0` se crea en esta fase.
- `/legal/{terminos|privacidad}/{version}.md`: bytes originales, sin serialización de texto.
- `/legal/{terminos|privacidad}/{version}.sha256`: checksum en formato shasum, con el nombre `{version}.md`.
- `/legal/borradores/{terminos|privacidad}.md` y `.sha256`: fuentes actuales editables; nunca se usan para registrar PL-016. Siguen leyendo los borradores aunque en el futuro cambien los punteros.
- `/legal/manifest.json`: manifiesto estático reproducible, sin fecha de build variable.

Las páginas versionadas llevan canonical propio; cuando un alias muestra un release, su canonical apunta a esa URL permanente. Se conserva `noindex, follow` para documentos, históricos y artefactos legales y su exclusión del sitemap; cualquier indexación legal futura necesita una decisión SEO explícita. Las descargas y el manifiesto declaran noindex/no-store en `public/_headers`, con MIME de Markdown y JSON, sin modificar la configuración Workers. `astro preview` no aplica los headers de Cloudflare: se comprueba su copia en el build, quedando su aplicación real pendiente de un deploy autorizado.

Las rutas inexistentes no tienen salida estática. El alojamiento ya configura `404-page`, sin fallback SPA. La prueba HTTP local comprueba estado 404, no solo texto de error. Los enlaces de descarga tienen targets de 44 px y foco heredado. Se corrigió el id duplicado preexistente `contenido` del skip link usando `contenido-principal`, preservando los anchors jurídicos.

## Integridad histórica

`legal/releases.lock.json`, esquema 2, tiene dos mapas, ambos hoy vacíos:

- `files`: ruta canónica → SHA-256 y tamaño exacto.
- `records`: `tipo/version` → SHA-256 del JSON de metadata en orden fijo (`tipo`, `version`, `vigente_desde`, `url`, `contenido_sha256`), UTF-8 y LF final.

El segundo digest protege metadata, no se almacena en `contenido_sha256`. El registro y el lock deben tener exactamente las mismas entradas. Se comprueban canónicos, hashes, tamaños, metadata y ausencia de archivos Markdown huérfanos. Los releases no pueden ser symlinks. No hay comando que regenere o «actualice» automáticamente el lock histórico.

`verifyReleaseLock` y el checker independiente impiden quitar o sustituir entradas históricas, cambiar bytes, URL, vigencia o hash, y reutilizar `(tipo, version)` con otro contenido o metadata. Reescribir documento, registro y lock a la vez no pasa frente a una referencia anterior protegida. Se permite únicamente añadir versiones conservando todo lo anterior.

Un repositorio editable no es almacenamiento WORM. Estas comparaciones observan estados: una eliminación temporal seguida de restauración idéntica entre dos referencias no se distingue por SHA-256. Se requieren historial protegido, revisiones y auditoría operativa para eventos intermedios. La integridad del canónico tampoco congela los bytes HTML de la plantilla; la representación jurídica sí se deriva del mismo Markdown. Si se desea evidencia visual, archivar HTML aparte, con su propio hash y sin confundirlo con PL-016.

## Referencia protegida para CI: diseño y bootstrap pendiente

`npm run verify:legal -- --baseline-ref <SHA-completo-protegido>` contrasta el lock y metadata actuales con Git. CI falla cerrado sin un SHA completo de 40 caracteres o si ese commit no contiene el lock. El job puede suministrarlo en `LEGAL_BASELINE_REF` (variable protegida externa al PR), para que el prebuild también verifique el mismo baseline sin argumentos adicionales. Un argumento explícito prevalece sobre la variable. El uso local sin argumento toma HEAD; solo permite el bootstrap sin lock si no hay ningún release. Antes del primer commit de Fase 3, HEAD corresponde al cierre de Branding y aparece el aviso local de bootstrap; después, HEAD ya contiene el lock vacío. Esa excepción nunca está habilitada en CI. El commit local no configura por sí mismo una referencia protegida remota.

`scripts/check-legal-baseline.mjs` es independiente y usa solo built-ins de Node. Para no confiar en código cambiado por el PR, el job obligatorio debe extraer y ejecutar **la copia del checker de la referencia protegida**, fuera del árbol del PR, con el checkout candidato como cwd. Comprueba también el registro y los bytes reales frente al baseline; no basta con ejecutar un npm script que un PR pueda sustituir.

Configuración externa necesaria, todavía NO ejecutada:

1. Revisar y aprobar la primera integración de esta fase, sin releases. Su commit completo será el baseline inicial. El bootstrap necesita revisión específica; no se añade un bypass automático de CI.
2. Proteger la rama de publicación y el workflow/check obligatorio: revisiones para canónicos, registro, lock, código legal y CI; impedir force-push/borrado, restringir bypasses y permisos de edición.
3. Mantener el SHA baseline fuera del control del PR, en una política/job protegido. Resolverlo a un commit completo; descargar historia suficiente y verificar que corresponde a la línea autorizada de publicación.
4. Extraer el checker del commit protegido y ejecutarlo con `CI=true` y `--baseline-ref <SHA>`. Ejecutar además check, tests y build actuales. No ejecutar código no confiable con credenciales o tokens de escritura.
5. Avanzar la referencia al commit aprobado tras cada incorporación/publicación, conservando el historial y las referencias de releases. Una referencia perpetuamente anclada al lock vacío no protege adiciones posteriores.
6. Autorizar despliegues solo de artefactos asociados a estos checks y conservar backups de los canónicos. Aplicar verificaciones periódicas de URLs y bytes servidos después de publicar.

Fase 3 dejó el checker y su modo de fallo estricto sin workflows. El bloque 4A prepara ahora workflows y CODEOWNERS locales, sin habilitar servicios, protecciones o variables remotas. El modelo de confianza, los pins, el bootstrap y las limitaciones del repositorio se documentan en `docs/CI_PHASE_4A.md`; requieren revisión y autorización separadas.

## Verificación y publicación

```sh
npm run normalize:legal
npm run test:legal
npm run verify:legal
npm run check
npm run build
npm run build:preview
# Restaurar después el artefacto de producción:
npm run build
# Con una preview local iniciada:
npm run test:legal:http -- http://127.0.0.1:4391
```

El repositorio no define lint; no se presenta como ejecutado. El build audita links, anchors, ids únicos, metadata, branding, scripts permitidos, sitemap, descargas exactas, checksums y manifiesto. Las pruebas legales incluyen vectores A/C y negativos del contrato, normalización, PK/UNIQUE, bytea, punteros, rechazo de borradores y alteración/eliminación/sustitución/reutilización con baseline. Los datos de prueba son exclusivamente técnicos en memoria o directorios temporales; nunca se publican como versiones aprobadas.

Para el orden de publicación, comparación con el archivo móvil e INSERT separado y autorizado, ver `docs/LEGAL_PUBLICATION_RUNBOOK.md`.

## Pendientes antes de PROD

Aprobación jurídica de contenido y de los 23 marcadores; revisión de PL-008/PL-009 (presentación vs aceptación y borrado de evidencia con la cuenta); discrepancia Analytics/implementación/documentación/privacidad; baseline y CI protegidos; autorizaciones de publicación/deploy/activación; calendario común entre ambos repositorios y catálogo. El backend no verifica el hash ni vuelve a descargar la URL, y la app no lee el hash: no atribuirles esa garantía. No se han ejecutado cambios remotos ni se ha creado una versión real.

## Evidencia local de esta revisión

- Astro check: 55 archivos, 0 errores, warnings o hints.
- Pruebas legales: 44/44, incluidos vectores del contrato y controles negativos.
- Builds de producción y preview: correctos, con auditorías estática, branding y legal. Se restauró el build de producción al terminar.
- Revisión final previa al commit: los canónicos, registro, lock, punteros y contrato conservaron SHA-256, tamaño, inode, mtime y ctime durante ambos builds; no se detectaron reescrituras silenciosas.
- HTTP local: seis páginas públicas 200, descargas exactas, manifiesto correcto y 18 rutas inexistentes 404 (incluye v1.0 y staging-prueba en páginas, Markdown y checksums).
- Chrome: términos y privacidad a 360, 390, 768 y 1280 px, sin overflow, ids únicos, un H1 y enlaces de descarga de 44 px. El skip link lleva el foco al main correcto.
- Se conservan los 23 marcadores y los siete beacons existentes; cero scripts cliente adicionales. Los 49 archivos protegidos revisados frente a Branding permanecen idénticos.
- `git diff --check` correcto; sin coincidencias de patrones comunes de credenciales en archivos nuevos/modificados. El contrato entregado no se modificó.
- Sin lint configurado, Lighthouse/axe completos, validación de screen reader, activaciones ni comprobación de headers en Cloudflare. No se prueba una publicación aprobada real porque no existe ningún release autorizado. La integridad histórica se prueba con material técnico aislado, no con versiones jurídicas ficticias.

La implementación técnica de Fase 3 cuenta con aprobación para un commit exclusivamente local, sujeto a la revisión final de integridad. La Fase 4 requiere aprobación de su plan antes de implementarse. No se autorizaron push, deploy ni operaciones remotas.
