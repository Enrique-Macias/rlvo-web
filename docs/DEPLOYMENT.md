# RLVO Web — Deployment

## Plataforma

Cloudflare.

El sitio debe diseñarse para deployment mediante la plataforma de Cloudflare
compatible con la configuración actual de Astro.

No asumir Vercel.

### Configuración preparada para la primera versión

Se utilizará Cloudflare Workers Static Assets para servir la salida estática
de Astro desde `dist/`. `wrangler.jsonc` contiene únicamente la configuración
del alojamiento: no tiene `main`, bindings, secretos ni adaptador SSR.

`assets.not_found_handling` usa `404-page`; las rutas inexistentes deben
responder 404 y mostrar `404.html`. `html_handling` usa `drop-trailing-slash`,
coherente con las rutas canónicas de Astro. El dominio raíz conserva `/`.

La configuración es local. Esta implementación no crea un proyecto de
Cloudflare, no publica versiones ni modifica DNS. La creación del recurso,
conexión del dominio, redirecciones entre hosts y despliegue requieren una
instrucción explícita posterior.

Referencia: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/

---

## Dominio

Canonical público aprobado: https://www.rlvo.com.mx.

Se conserva el mecanismo local de Workers Static Assets; no se migra a Pages.
La consulta HTTP del 27 de octubre de 2026 devolvió 200 tanto para `www` como
para `rlvo.com.mx`, sin redirección en esas respuestas. No se inspeccionó la
cuenta remota de Cloudflare; los headers no identifican por sí solos Pages
frente a Workers. No modificar redirects sin verificar la configuración real
y obtener autorización específica.

---

## DNS

Actualmente el dominio está gestionado externamente.

NO modificar DNS desde código.

No modificar:

- MX
- SPF
- DKIM
- DMARC
- registros de Google Workspace

durante deployment de la web.

Los cambios DNS se realizarán manualmente y con aprobación.

---

## Environments

Como mínimo contemplar:

- local development
- preview
- production

No añadir secretos si el sitio continúa siendo completamente estático.

Local: `npm run dev`. Revisión del artefacto: `npm run preview`.
Preview no indexable: `npm run build:preview`, que establece `SITE_ENV=preview`
durante el build. Producción: `npm run build`.

Las previews tienen `noindex`, robots bloqueado y no generan sitemap indexable.
Estos mecanismos no restringen el acceso al contenido. Cualquier protección
de acceso deberá configurarse explícitamente al preparar el alojamiento.

---

## Build

El proyecto debe poder ejecutar:

npm run build

y:

npm run check

sin errores.

El build ejecuta una auditoría estática de páginas, enlaces, anchors, metadata
y assets. Advierte cuando hay información legal pendiente. Los documentos
legales deben revisarse y completarse antes de publicar; el build exitoso no
significa que estén aprobados.

---

## Static-first

Preferir salida estática.

No introducir runtime server-side únicamente por conveniencia.

Si una funcionalidad futura requiere backend, documentar primero:

- motivo
- endpoint
- datos procesados
- seguridad
- secretos requeridos
- impacto de privacidad

antes de implementarla.

---

## Future account deletion integration

La página `/eliminar-cuenta` puede necesitar en el futuro una integración
segura con el backend/Supabase.

No implementar operaciones administrativas de Supabase desde el navegador.

Nunca exponer una service role key.

La arquitectura de esa funcionalidad debe aprobarse por separado.

---

## Observability / analytics

No instalar analytics inicialmente.

Discrepancia detectada en Fase 2: la implementación actual ya incluye
Cloudflare Web Analytics y la auditoría exige ese beacon. Por instrucción
expresa se conserva sin cambios. Esta política, LEGAL_FACTS.md y el aviso
actual deben conciliarse antes de PROD; esta fase no modifica texto jurídico.
Ver `docs/BRANDING_PHASE_2.md`.

Cloudflare Web Analytics, PostHog u otra herramienta solo se añadirá mediante
decisión explícita.

Cualquier herramienta debe revisarse por:

- privacidad
- cookies
- requests externos
- impacto en performance
- implicaciones legales
