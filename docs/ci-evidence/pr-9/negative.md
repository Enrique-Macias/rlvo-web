# PR #9 — prueba negativa sin autorización

Resultado de la prueba: **PASS**. El fallo del job fue el rechazo esperado.

## GitHub — evidencia remota observada

- Repositorio: [Enrique-Macias/rlvo-web](https://github.com/Enrique-Macias/rlvo-web).
- [PR #9](https://github.com/Enrique-Macias/rlvo-web/pull/9), cerrado, Draft y sin merge al cerrar esta fase.
- Base C: `3a11b33e27da76175831894d4255a817d56e6738`.
- Candidato P: `ed698ce018a8d1d58900bd643cea3d04086a6880`.
- [RLVO Legal Trust — run 42332590926](https://github.com/Enrique-Macias/rlvo-web/actions/runs/42332590926), evento `pull_request_target`: job `legal-integrity` en **failure**.
- Causa interna observada: `CI_AUTH_REQUIRED`; agregado `CI_TRUST_FAILURE`; exit 1.
- Control jurídico independiente: **success**, cero releases y 23 marcadores.
- [RLVO Web CI — run 42332590721](https://github.com/Enrique-Macias/rlvo-web/actions/runs/42332590721), evento `pull_request`: job `web-quality` en **success**.
- Ambos checks pertenecen a GitHub Actions App 15368 y están asociados a P.
- Cero artifacts publicados, deployments y releases registrados en esta fase.

## Auditoría local

- P tiene como único padre C. El diff añade un comentario a `scripts/ci/control-policy.mjs`, sin alterar código ejecutable.
- Se compararon los bytes y se confirmó una modificación crítica y cero cambios jurídicos.
- Los logs muestran checkout de C, candidato P y transporte vacío. El rechazo no fue un fallo de infraestructura.
- La inspección de logs no detectó credenciales expuestas; no constituye una garantía universal de confidencialidad.
- Fuente privada: `final-evidence.json`. Tamaño y SHA-256 del original figuran en [provenance.json](provenance.json).

## USER-VERIFIED

El propietario confirmó la desactivación de builds automáticos de producción y preview de Cloudflare, ausencia de Deploy Hooks y ausencia de proyectos de Vercel bajo su administración vinculados al repositorio. No es una verificación independiente de esas plataformas.

## Alcance y límites

El resultado demuestra rechazo del candidato P sin autorización en este contexto. No demuestra un intento real de merge rechazado, no autoriza cambios futuros y no modifica el baseline jurídico.

La afirmación de que no se creó un Secret corresponde a esta fase negativa; posteriormente hubo una [fase positiva separada](positive.md).
