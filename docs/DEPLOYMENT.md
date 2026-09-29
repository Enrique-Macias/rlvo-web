# RLVO Web — Deployment

## Plataforma

Cloudflare.

El sitio debe diseñarse para deployment mediante la plataforma de Cloudflare
compatible con la configuración actual de Astro.

No asumir Vercel.

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

---

## Build

El proyecto debe poder ejecutar:

npm run build

y:

npm run check

sin errores.

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