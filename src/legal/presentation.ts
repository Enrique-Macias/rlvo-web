import type { DocumentKind } from './canonical.ts';

// Rótulos de navegación, no contenido jurídico. El texto del documento vive en Markdown.
export const presentation: Record<DocumentKind, { label: string; toc: Record<string, string> }> = {
  terminos: {
    label: 'Términos',
    toc: { servicio: 'Servicio y elegibilidad', cuenta: 'Cuenta', publicaciones: 'Publicaciones',
      moderacion: 'Moderación y reportes', operaciones: 'Operaciones directas', resenas: 'Reseñas',
      contenido: 'Contenido y propiedad', eliminacion: 'Eliminación', canales: 'Canales oficiales', pendientes: 'Revisión jurídica' },
  },
  privacidad: {
    label: 'Privacidad',
    toc: { alcance: 'Alcance', responsable: 'Responsable', datos: 'Datos que tratamos', usos: 'Cómo los usamos',
      moderacion: 'Moderación', proveedores: 'Proveedores', conservacion: 'Conservación', eliminacion: 'Eliminación', derechos: 'Tus derechos' },
  },
};
