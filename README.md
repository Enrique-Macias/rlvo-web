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
capturas y la composición Open Graph. Los PNG en `public/screenshots/` son los originales y no se modifican.
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

También ejecuta `npm run audit:brand`: verifica integridad de los 18 SVG y
favicon, pares de contraste, tokens, logos, Open Graph y theme-color. No hay
dependencias nuevas ni un linter general configurado.

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
- `public/brand/`: SVG oficiales intactos; hashes en `src/config/brand-assets.json`.
- `src/content/legal.ts`: pendientes basados en `docs/LEGAL_FACTS.md`.
- `src/components/landing/`: composición editorial de la landing.
- `src/pages/`: siete páginas y robots estáticos; favicon original en `public/`.
- `docs/IMPLEMENTATION.md`: decisiones de diseño y comprobaciones de esta versión.

La disponibilidad se comunica como “Próximamente”. Las capturas conservan el
nombre anterior “Relevo” donde aparece en la app. Sus cifras y campus no son
claims de lanzamiento del sitio.

La identidad web utiliza Paleta 06, Fraunces e Inter locales y logos oficiales.
El canonical aprobado es `https://www.rlvo.com.mx`; no se modifican redirects.
Cloudflare Web Analytics permanece por instrucción expresa; la discrepancia
con la documentación y el aviso se registra en `docs/BRANDING_PHASE_2.md`.

## Publicación pendiente

`wrangler.jsonc` conserva Workers Static Assets: sirve `dist/`, sin adaptador
SSR ni código Worker. Esta fase no crea recursos ni conecta dominios; no se
inspeccionó la cuenta remota para confirmar el alojamiento efectivo.

Privacidad, términos y eliminación de cuenta siguen siendo borradores visibles
con `[[POR CONFIRMAR]]`, `noindex` y exclusión del sitemap. No publicar hasta
completar la revisión legal. Consulta `docs/DEPLOYMENT.md` para el alcance de
infraestructura y autorizaciones necesarias.
