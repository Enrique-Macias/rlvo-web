# PR #9 — cierre de pruebas de transporte CI

**CI AUTHORIZATION TESTS CLOSURE READY**, aceptado por el propietario dentro del alcance probado.

Estos resúmenes son derivados redactados para revisión local. No implican commit, publicación, aprobación de merge ni habilitación de operación ordinaria.

## GitHub — evidencia remota observada

- [PR #9](https://github.com/Enrique-Macias/rlvo-web/pull/9): cerrado, Draft, sin merge ni auto-merge.
- Base C y main al cierre: `3a11b33e27da76175831894d4255a817d56e6738`.
- Candidato P y rama conservada `ci/probe-authorized-control-from-c`: `ed698ce018a8d1d58900bd643cea3d04086a6880`.
- [Prueba negativa](negative.md): rechazo específico por `CI_AUTH_REQUIRED`, con control jurídico correcto y `web-quality` aprobado.
- [Prueba positiva](positive.md): `controlIntegrity: authorized`, control jurídico correcto, `web-quality` aprobado y `mergeApproval: false`.
- Environment `ci-control-authorization` limitado a la única rama `main`, sin Secrets ni Variables al cierre.
- Ruleset principal 26397937 activo, sin bypass, con PR obligatorio, cero aprobaciones humanas y checks `web-quality` y `legal-integrity` de App 15368, rama actualizada, bloqueo de borrado/force-push y regla temporal `update`.
- Ruleset histórico 26149031 activo, intacto y sin bypass sobre `legal-history-baseline` en `bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4`.
- Cero deployments, releases y runs conocidos pendientes. La suite vacía de Cloudflare en `queued`, sin check runs, no demuestra un build.

## Auditoría local

Los originales privados se conservaron byte por byte, con tamaños y hashes verificados. Se preservaron el checkout original, su índice y sus cambios preexistentes. No se incorporó Fase 4C.1.

Las fuentes no se publican como respuestas API completas ni snapshots. [provenance.json](provenance.json) identifica los originales por nombre, tamaño y SHA-256, y los derivados por su hash. [SHA256SUMS](SHA256SUMS) verifica los tres resúmenes y el manifiesto; no contiene su propio hash.

## USER-VERIFIED

Cloudflare: builds automáticos de producción y preview desactivados y sin Deploy Hooks. Vercel: ningún proyecto bajo la administración declarada del propietario vinculado al repositorio. Estas afirmaciones no fueron verificadas de forma independiente por herramientas.

## Criterios y pendientes

- **PASS:** rechazo sin autorización, aceptación del registro exacto, independencia jurídica, cierre sin merge y limpieza verificada del Secret.
- **PASS:** ninguna modificación jurídica, publicación o incorporación de Fase 4C.1.
- **Límite:** no se realizó un intento real de merge rechazado por los checks. Los tests locales no sustituyen esa prueba.
- **Límite:** no se garantiza ausencia universal de filtraciones, precedencia de ámbitos, comportamiento en forks ni revocación automática.
- **Pendiente:** incorporación documental, decisión separada sobre `update` y diseño de operación ordinaria. Main sigue inmovilizada.
- **Pendiente:** publicación jurídica; permanecen los 23 marcadores y la política de borradores.

Borrar o caducar una autorización no revoca checks ya aprobados. No reutilizar este candidato de prueba ni sus resultados para un merge futuro. Toda operación posterior necesita autorización específica.
