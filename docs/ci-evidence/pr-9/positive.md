# PR #9 — prueba positiva de autorización temporal

Resultado de la prueba: **PASS**. La aceptación del checker no concede permiso de merge.

## GitHub — evidencia remota observada

- [PR #9](https://github.com/Enrique-Macias/rlvo-web/pull/9), con base C `3a11b33e27da76175831894d4255a817d56e6738` y candidato P `ed698ce018a8d1d58900bd643cea3d04086a6880`.
- [RLVO Legal Trust — run 42421634910](https://github.com/Enrique-Macias/rlvo-web/actions/runs/42421634910), evento `pull_request_target`: job `legal-integrity` en **success**.
- El resumen del checker registra `controlIntegrity: authorized`, `mergeApproval: false` y el digest esperado:
  `e375a144866d6d90732416d96c8fd4887f2aa793dd74111fd5a66874900a5d17`.
- El identificador esperado se cotejó durante la prueba; su valor y las fechas exactas del registro de autorización se excluyen de este derivado.
- Control jurídico independiente: **success**, cero releases y 23 marcadores.
- [RLVO Web CI — run 42421634599](https://github.com/Enrique-Macias/rlvo-web/actions/runs/42421634599), evento `pull_request`: job `web-quality` en **success**, 216 pruebas CI y 44 jurídicas aprobadas.
- Ambos checks corresponden a P y a GitHub Actions App 15368. Son ejecuciones nuevas, posteriores a la instalación del Secret.
- Cero artifacts publicados, deployments y releases registrados.

## Auditoría local

- Se verificó el uso del checkout confiable C y la lectura del candidato como objetos Git en `legal-integrity`. `web-quality` evalúa el candidato en otro runner sin ese Environment.
- La autorización temporal se generó en memoria con el contrato de nueve campos y una vigencia de 30 minutos; el transporte fue Base64 estándar canónico del JSON UTF-8.
- El Secret se entregó por stdin exclusivamente a `ci-control-authorization`; no se incluyó en argumentos, archivos versionados ni variables exportadas.
- La revisión de ambos logs no detectó el transporte, el JSON completo ni los fragmentos examinados. Esto no prueba ausencia de cualquier filtración posible.
- Se cotejaron una modificación crítica, cero cambios jurídicos y el digest exacto.
- Fuentes privadas: `positive-test-redacted-evidence.json` y `positive-test-final-audit.json`; hashes en [provenance.json](provenance.json).

## Limpieza — consultas autenticadas de GitHub

- PR #9 cerrado, Draft, sin merge ni auto-merge; rama conservada.
- Secret temporal eliminado: GET individual **404** y listado autenticado **200**, con cero Secrets.
- Environment sin Variables; main y candidato intactos.
- Rulesets 26397937 y 26149031 activos, íntegros y sin bypass.
- Ningún run conocido pendiente; cero deployments y releases.
- No fue necesaria recuperación manual.

## USER-VERIFIED

La configuración externa de Cloudflare y Vercel se registra como confirmación del propietario. No se atribuye a las pruebas una comprobación experimental de ausencia de futuros builds.

## Alcance y límites

La prueba acredita la entrega y aceptación observadas para este PR y estos SHA. No demuestra precedencia entre Secrets homónimos, forks u otros eventos. El Secret eliminado o caducado no invalida resultados verdes anteriores. No constituye aprobación de merge ni autorización jurídica.
