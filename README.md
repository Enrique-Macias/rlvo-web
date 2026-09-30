# RLVO — sitio público

Sitio estático para `rlvo.com.mx`, construido con Astro, TypeScript strict y
Tailwind CSS. Lee `AGENTS.md` y `/docs` antes de trabajar.

## Desarrollo

Requiere Node.js 22.12 o posterior compatible con Astro (ver `package.json`).

```sh
npm ci
npm run dev
```

`npm run dev` y `npm run build` preparan automáticamente copias WebP de las
capturas. Los PNG en `public/screenshots/` son los originales y no se modifican.
`public/media/` es generado e ignorado por Git. También contiene las licencias
de las fuentes. Inter y Fraunces se empaquetan localmente desde Fontsource.

## Verificación

```sh
npm run check
npm run build
npm run preview -- --host 127.0.0.1 --port 4321
```

El build termina con una auditoría de metadata, rutas, anchors, imágenes,
sitemap, robots, scripts y marcadores legales pendientes. Los marcadores
producen una advertencia; deben resolverse antes de producción.

Para un build de revisión no indexable:

```sh
npm run build:preview
```

Este modo añade `noindex` a todas las páginas y bloquea robots. Ejecuta otra vez
`npm run build` para restaurar el artefacto de producción. Noindex no es control
de acceso: el contenido sigue siendo visible para quien tenga la URL.

## Configuración y contenido

- `src/config/site.ts`: marca, dominio, correos, navegación, estado de
  lanzamiento, metadata y fechas legales.
- `src/styles/tokens.css`: identidad visual definida en `docs/DESIGN.md`.
- `src/content/legal.ts`: pendientes basados en `docs/LEGAL_FACTS.md`.
- `src/components/landing/`: composición editorial de la landing.
- `src/pages/`: siete páginas, robots y favicon estáticos.
- `docs/IMPLEMENTATION.md`: decisiones de diseño y comprobaciones de esta versión.

La disponibilidad se comunica como “Próximamente”. Las capturas conservan el
nombre anterior “Relevo” donde aparece en la app. Sus cifras y campus no son
claims de lanzamiento del sitio.

## Publicación pendiente

`wrangler.jsonc` prepara Cloudflare Static Assets: sirve `dist/`, sin adaptador
SSR ni código Worker. No se han creado recursos ni conectado dominios.

Privacidad, términos y eliminación de cuenta siguen siendo borradores visibles
con `[[POR CONFIRMAR]]`, `noindex` y exclusión del sitemap. No publicar hasta
completar la revisión legal. Consulta `docs/DEPLOYMENT.md` para el alcance de
infraestructura y autorizaciones necesarias.
