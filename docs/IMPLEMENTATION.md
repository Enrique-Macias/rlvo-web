# Primera implementación del sitio público

Revisión realizada el 29 de septiembre de 2026 (America/Monterrey).

## Arquitectura

Astro 7, TypeScript strict y Tailwind 4. Todas las páginas se generan como
archivos estáticos. No hay scripts de cliente, islas, API en ejecución,
formularios, analytics, cookies ni integraciones con Supabase. Los endpoints
de robots y favicon se resuelven durante el build.

Marca, dominio, idioma, correos, metadata, navegación, disponibilidad, URLs
futuras de tiendas, redes y fechas legales viven en `src/config/site.ts`.

## Dirección visual y AppLlama

Se revisaron nuevamente referencias mediante el MCP antes de implementar.
Las pantallas de Onform `1490334045/onb_7481b` (Onboarding Welcome) y
`1490334045/onb_4g51z` (Video Analysis Intro) ayudaron a decidir:

- Presentar una captura con una función narrativa concreta, acompañada por
  una explicación breve.
- Usar encuadres y profundidad para destacar el producto, conservando el
  contenido real de las capturas.
- Alternar vistas completas y recortes para variar el ritmo.

La adaptación web es propia de RLVO: hero superpuesto en escritorio, una
captura principal de 280 px en móvil, dos escenas escalonadas de descubrir y
publicar, sección oscura de pasos, perfil sobre un fondo forest derivado y
cierre tipográfico brick. Se conservaron los tokens de DESIGN.md.

No se copiaron contenido, claims, marcas, funciones ni métricas de las
referencias. AppLlama ofrece referencias móviles; la adaptación responsive
de la web se diseñó y comprobó en navegador.

## Capturas reales

- `home-marketplace.png`: hero, encuadre completo y marco discreto.
- `category-browse.png`: plano secundario del hero de escritorio y recorte
  ampliado en la sección de descubrimiento.
- `create-listing.png`: composición de publicación, recortada por CSS.
- `user-profile.png`: perfil y reputación, con pie contextual.
- `product-detail.png`: recorte de precio, vendedor y descripción junto a
  la explicación de coordinación directa.

Los cinco PNG originales permanecen intactos según Git. Sharp solo genera
copias redimensionadas y codificadas en WebP; los crops se aplican al contenedor
CSS. El texto Relevo se conserva donde aparece. Se aclara que los campus y
cifras visibles pertenecen a las capturas previas al lanzamiento.

## Dependencias

- Astro: generación estática y componentes.
- TypeScript 6: tipado estricto; se fijó esta versión por compatibilidad con
  el peer dependency de `@astrojs/check`.
- `@astrojs/check`: validación de Astro y TypeScript.
- Tailwind y `@tailwindcss/vite`: utilidades CSS y compilación.
- `@astrojs/sitemap`: sitemap de las rutas indexables.
- `@fontsource-variable/inter` y `@fontsource-variable/fraunces`: fuentes
  locales, únicamente el subconjunto latino normal de cada familia.
- Sharp (desarrollo): generar variantes WebP durante dev/build. Se copian
  las licencias de las fuentes junto con los assets generados.

No se añadieron frameworks de UI ni librerías de animación. Los enlaces tienen
feedback CSS de 200 ms. Las preguntas de soporte usan details/summary nativos.
Reduced motion elimina transiciones y animaciones. Las anclas navegan sin
desplazamientos animados largos.

## Verificaciones

- `npm run check`: 31 archivos, 0 errores, 0 warnings, 0 hints.
- `npm run build`: 7 páginas, robots, favicon y sitemap; auditoría estática
  aprobada. Advertencia esperada: 18 apariciones de pendientes legales.
- Enlaces internos, anchors, imágenes, un h1 por página, idioma, canonical,
  description y Open Graph comprobados en el HTML generado.
- Ausencia de scripts en las siete páginas y de archivos JavaScript enviados
  al cliente. No hay recursos externos en los componentes ni solicitudes
  externas en la medición de Lighthouse.
- Fuentes WOFF2 servidas desde el mismo origen; dos archivos, con preload.
- Landing inspeccionada visualmente a 360, 390, 768 y 1280 px. Las otras seis
  páginas se revisaron en esos cuatro anchos mediante medidas DOM; sin
  overflow horizontal. El layout legal se inspeccionó visualmente en móvil
  y escritorio.
- Teclado: enlace de salto, destino del foco en main, acción principal,
  navegación del footer y apertura de details en soporte. Foco sólido visible.
- axe-core 4.13: 0 violaciones en las siete páginas tras corregir un rótulo
  decorativo con contraste insuficiente.
- Reduced motion: comprobación adicional de estilos calculados en Chrome
  con la preferencia forzada, en inicio y soporte; todas las duraciones de
  transición/animación a cero.
- Contraste calculado: brick/paper 4.50:1, ink-soft/paper 5.00:1,
  forest/paper 5.53:1, ink/paper 14.42:1, gold/ink 7.29:1.
- Preview: build con SITE_ENV=preview, noindex y robots bloqueado comprobados.
  Se restauró después el build normal.
- HTTP local: páginas normales 200; ruta inexistente 404. La visita directa
  a `/404` muestra el documento noindex con 200, como archivo público.
- Sitemap normal: únicamente `/`, `/contacto` y `/soporte`.
- Búsqueda de marcadores `[[FIRMAR]]`: ninguno en implementación o fuentes
  legales; los pendientes utilizan el formato POR CONFIRMAR.

### Lighthouse móvil

Lighthouse 13.5.0, Chrome headless, sobre `astro preview` del build estático.
La medición final comenzó después de terminar la auditoría de axe.

- Performance: 100.
- Accessibility: 100.
- Best Practices: 100.
- SEO: 100.
- FCP: 0.9 s. LCP: 1.9 s. TBT: 0 ms. CLS: 0.
- Sin errores de consola ni requests externos de la página.

Es una medición de laboratorio local con emulación móvil, no una medición de
producción ni de dispositivos físicos. No se probó Safari, un lector de
pantalla ni el deployment real de Cloudflare. La auditoría automatizada no
certifica por sí sola cumplimiento completo de WCAG.

Las herramientas de QA se instalaron fuera del repositorio, en
`/private/tmp/rlvo-qa`, y no forman parte de las dependencias del sitio.

## Información pendiente antes de producción

Existen 12 textos distintos de POR CONFIRMAR, repetidos 18 veces en las páginas:

1. Fecha de actualización del aviso de privacidad.
2. Fecha de actualización de los términos.
3. Fecha de actualización de la información de eliminación.
4. Responsable del tratamiento y domicilio.
5. Edad mínima.
6. Ley aplicable y jurisdicción.
7. Medio y procedimiento ARCO.
8. Contenido exacto del token push almacenado.
9. Proveedores de moderación activos al lanzamiento.
10. Conservación del hash del correo de cuentas suspendidas tras eliminarlas.
11. Ruta, alcance, conservación y plazo del proceso de eliminación.
12. Periodos de conservación de datos personales.

Los tres documentos siguen visibles y noindex. También faltan revisión legal
final, imagen Open Graph oficial y URLs de tiendas cuando la app se publique.
No se requiere una fecha de lanzamiento para comunicar “Próximamente”.

## Ajustes respecto al plan

La existencia de capturas reales permitió implementar la experiencia del
producto desde esta versión. `ProductStory` reúne propuesta de valor,
descubrimiento y publicación para evitar fragmentación. `ContentLayout`
comparte el sistema documental con contacto, soporte y 404. Los datos legales
pendientes tienen una fuente común en `src/content/legal.ts`.

Se añadieron Sharp y los paquetes de fuentes por necesidades de imágenes y
autoalojamiento. La configuración de Cloudflare quedó preparada sin instalar
un runtime SSR ni ejecutar un despliegue. Se extrajo LANDING.md de DESIGN.md
conservando exactamente el contenido de sus requisitos.

No se ejecutaron commits, push, cambios remotos ni modificaciones de DNS,
Cloudflare, Google Workspace o Supabase.
