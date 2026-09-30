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
conexión del dominio, redirección de `www` y despliegue requieren una
instrucción explícita posterior.

Referencia: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/

---

## Dominio

Producción:

https://rlvo.com.mx

También debe contemplarse:

https://www.rlvo.com.mx

La estrategia exacta de redirect/canonical se decidirá al configurar
producción.

Canonical principal:

https://rlvo.com.mx

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

Cloudflare Web Analytics, PostHog u otra herramienta solo se añadirá mediante
decisión explícita.

Cualquier herramienta debe revisarse por:

- privacidad
- cookies
- requests externos
- impacto en performance
- implicaciones legales
