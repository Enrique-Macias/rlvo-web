# AGENTS.md — RLVO Public Web

Este repositorio contiene exclusivamente el sitio web público de RLVO.

Dominio de producción:

rlvo.com.mx

El sitio incluye:

- Landing page pública.
- Páginas legales.
- Información de soporte y contacto.
- Página pública relacionada con eliminación de cuenta.
- SEO y metadata del sitio.

NO contiene:

- La aplicación móvil de RLVO.
- El panel administrativo de RLVO.
- El backend principal de RLVO.

Esos son proyectos independientes.

---

## 1. Antes de trabajar

Antes de proponer cambios o escribir código, leer:

1. `docs/PRODUCT.md`
2. `docs/BRAND.md`
3. `docs/DESIGN.md`
4. `docs/LANDING.md`
5. `docs/LEGAL_FACTS.md`
6. `docs/SEO.md`
7. `docs/DEPLOYMENT.md`

Estos documentos son fuentes de verdad del proyecto.

Si existe contradicción:

1. AGENTS.md
2. documentación específica en `/docs`
3. implementación existente

No resolver contradicciones importantes por suposición.
Preguntar antes de continuar.

---

## 2. Stack aprobado

Usar:

- Astro
- TypeScript strict
- Tailwind CSS
- HTML semántico
- CSS cuando sea más apropiado que Tailwind
- Cloudflare para deployment

El sitio debe ser static-first.

No añadir automáticamente:

- React
- Vue
- Svelte
- shadcn/ui
- Motion / Framer Motion
- GSAP
- librerías de estado
- bases de datos
- CMS
- servicios externos

Astro es suficiente por defecto.

Si una interacción requiere JavaScript, implementar primero la solución
más pequeña posible.

Si una funcionalidad realmente justifica una isla interactiva o framework,
explicar el motivo y pedir aprobación antes de añadir la dependencia.

---

## 3. Arquitectura

Este proyecto es el sitio público de RLVO.

Arquitectura general del ecosistema:

- Mobile app:
  React Native + Expo + Supabase.
  Otro repositorio.

- Public website:
  Astro + TypeScript + Tailwind + Cloudflare.
  ESTE repositorio.

- Admin:
  Proyecto independiente.
  Se servirá desde `admin.rlvo.com.mx`.

- Backend:
  Supabase utilizado principalmente por la aplicación y el admin.

No copiar lógica de la app o admin a este repositorio.

---

## 4. Static-first

La web pública debe ser estática siempre que sea posible.

No añadir:

- base de datos
- autenticación
- API propia
- server actions
- formularios que almacenen información
- cookies
- analytics
- trackers
- scripts de terceros

sin aprobación explícita.

Si una funcionalidad futura —por ejemplo eliminación de cuenta— necesita
comunicarse con Supabase, diseñarla como una integración explícita y separada.

Nunca exponer:

- Supabase service role key
- secretos
- credenciales
- tokens privados

al cliente.

---

## 5. Diseño

La dirección visual está definida en:

`docs/DESIGN.md`

Los design tokens existentes son fuente de verdad.

No cambiar:

- colores
- tipografías
- identidad
- personalidad visual

sin aprobación.

Sí se puede explorar:

- composición
- layouts
- jerarquía
- ritmo
- spacing
- storytelling visual
- microinteracciones
- responsive behavior

El objetivo NO es crear una landing SaaS genérica.

Evitar por defecto:

- grids de cards idénticas
- exceso de glassmorphism
- gradientes morados genéricos
- blobs decorativos sin propósito
- dashboards falsos
- métricas inventadas
- interfaces falsas de la app

La landing debe sentirse como una marca de marketplace universitario,
no como una plantilla de startup AI.

---

## 6. AppLlama / herramientas de diseño

Si AppLlama está disponible, puede utilizarse como director de diseño UI/UX.

Debe utilizarse principalmente para explorar:

- composición
- dirección visual
- jerarquía
- ritmo
- layouts
- responsive design
- microinteracciones
- presentación de screenshots

AppLlama NO puede modificar por su cuenta:

- brand tokens
- facts del producto
- textos legales
- claims
- arquitectura técnica

Sus propuestas deben adaptarse a RLVO.

RLVO no debe adaptarse automáticamente a las preferencias de la herramienta.

---

## 7. Contenido

No inventar:

- estadísticas
- número de usuarios
- universidades participantes
- testimonios
- reviews
- partnerships
- premios
- logos de universidades
- afiliaciones institucionales
- disponibilidad geográfica no confirmada
- funcionalidades futuras presentadas como existentes

La aplicación todavía no está publicada.

No crear enlaces falsos a:

- App Store
- Google Play

Utilizar "Próximamente" cuando corresponda.

Los hechos permitidos sobre el producto están en:

`docs/PRODUCT.md`

---

## 8. Screenshots de la app

Los screenshots reales estarán, cuando existan, en:

`public/screenshots/`

Solo utilizar screenshots reales proporcionados.

Está prohibido inventar UI de la aplicación y presentarla como captura real.

Se pueden presentar screenshots reales dentro de:

- phone frames
- composiciones
- fondos
- crops
- layouts editoriales

sin alterar de manera engañosa la interfaz mostrada.

---

## 9. Configuración centralizada

Datos globales deben vivir en:

`src/config/site.ts`

Por ejemplo:

- brand name
- legal name cuando exista
- domain
- URLs
- contact email
- support email
- social links
- legal update dates
- app availability

No hardcodear estos valores repetidamente en componentes.

El proyecto está pasando de "Relevo" a "RLVO".

La implementación debe permitir completar ese rebranding desde la configuración.

---

## 10. Idioma

Todo contenido visible al usuario:

Español de México.

HTML:

`lang="es-MX"`

Evitar traducciones literales del inglés y lenguaje corporativo artificial.

---

## 11. Páginas legales

La única fuente factual para contenido legal es:

`docs/LEGAL_FACTS.md`

No inventar cláusulas legales.

No asumir:

- periodos de retención
- jurisdicción
- responsable legal
- domicilio
- edad mínima
- procedimientos ARCO
- datos recolectados
- terceros
- procesos de eliminación

Si falta información utilizar:

`[[POR CONFIRMAR: descripción]]`

No ocultar esos marcadores durante desarrollo.

Antes de producción, advertir si existe cualquier marcador pendiente.

---

## 12. Fuentes

Las fuentes deben servirse localmente.

No usar Google Fonts mediante CDN.

Preferir:

- archivos locales
- paquetes que permitan empaquetar las fuentes

Tipografías definidas actualmente:

- Fraunces — display
- Inter — UI/body

---

## 13. JavaScript

Objetivo:

enviar la menor cantidad posible de JavaScript al cliente.

Preferir:

HTML + CSS → Astro → JavaScript mínimo → isla interactiva

en ese orden.

No hidratar componentes que no necesiten interactividad.

---

## 14. Animaciones

Las animaciones deben ser:

- sutiles
- rápidas
- funcionales
- consistentes

Respetar:

`prefers-reduced-motion`

No utilizar animaciones que bloqueen contenido o navegación.

---

## 15. Responsive

Mobile-first.

Validar como mínimo:

- 360px
- 390px
- 768px
- 1280px

Evitar layouts diseñados únicamente para desktop.

---

## 16. Accesibilidad

Objetivo mínimo:

WCAG 2.2 AA cuando sea aplicable.

Requerido:

- HTML semántico
- navegación por teclado
- foco visible
- contraste adecuado
- alt text correcto
- labels accesibles
- headings jerárquicos
- reduced motion
- targets táctiles adecuados

No usar ARIA cuando HTML semántico resuelva el problema.

---

## 17. Performance

Objetivo Lighthouse móvil:

- Performance >= 95
- Accessibility >= 95
- Best Practices >= 95
- SEO >= 95

Evitar:

- JavaScript innecesario
- imágenes sin optimizar
- fuentes excesivas
- layout shift
- dependencias grandes

Usar las capacidades de optimización de Astro cuando corresponda.

---

## 18. SEO

Cada página pública debe tener:

- title
- meta description
- canonical
- Open Graph básico cuando corresponda

El proyecto debe generar:

- sitemap
- robots.txt

No añadir structured data con información inventada.

Ver `docs/SEO.md`.

---

## 19. Calidad

Antes de considerar una tarea terminada:

- ejecutar build
- ejecutar Astro check
- revisar errores TypeScript
- revisar links internos
- revisar responsive
- revisar accesibilidad básica
- comprobar que no aparecieron requests externos inesperados

No declarar algo como probado si no fue probado realmente.

---

## 20. Git

No hacer:

- commit
- push
- merge
- cambios de branches remotos

sin instrucción explícita.

---

## 21. Infraestructura

No modificar:

- DNS
- Cloudflare
- Squarespace
- Google Workspace
- Supabase production

sin instrucción explícita.

Las instrucciones de deployment viven en:

`docs/DEPLOYMENT.md`.

---

## 22. Flujo de trabajo

Para tareas grandes:

1. Leer documentación relevante.
2. Inspeccionar implementación existente.
3. Proponer plan.
4. Indicar archivos que serán creados/modificados.
5. Identificar decisiones o datos faltantes.
6. Esperar aprobación.
7. Implementar.
8. Ejecutar verificaciones.
9. Reportar resultados.

El reporte final debe indicar:

- qué se hizo
- qué archivos cambiaron
- qué se verificó
- qué no se pudo verificar
- cualquier desviación respecto al plan
- cualquier `[[POR CONFIRMAR]]` pendiente

No presentar suposiciones como hechos.