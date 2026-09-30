const brand = 'RLVO';
const domain = 'rlvo.com.mx';
const url = `https://${domain}`;

export const site = {
  brand,
  previousBrand: 'Relevo',
  domain,
  url,
  locale: 'es-MX',
  ogLocale: 'es_MX',
  contactEmail: `contacto@${domain}`,
  supportEmail: `soporte@${domain}`,
  privacyEmail: `privacidad@${domain}`,
  legalName: null,
  socialLinks: [] as { label: string; url: string }[],
  launch: {
    status: 'coming-soon',
    label: 'Próximamente',
    appStoreUrl: null,
    googlePlayUrl: null,
  },
  legalDates: {
    privacy: '[[POR CONFIRMAR: fecha de actualización del aviso de privacidad]]',
    terms: '[[POR CONFIRMAR: fecha de actualización de los términos]]',
    deletion: '[[POR CONFIRMAR: fecha de actualización de la información de eliminación]]',
  },
  seo: {
    title: `${brand} — Compra y vende entre estudiantes`,
    description: 'Un marketplace móvil para comprar y vender entre estudiantes de tu comunidad universitaria, con verificación por correo universitario. Próximamente.',
    image: null as string | null,
    imageAlt: null as string | null,
  },
  navigation: [
    { label: 'La app', href: '/#la-app' },
    { label: 'Cómo funciona', href: '/#como-funciona' },
    { label: 'Comunidad', href: '/#comunidad' },
  ],
  footer: [
    { label: 'Privacidad', href: '/privacidad' },
    { label: 'Términos', href: '/terminos' },
    { label: 'Eliminar cuenta', href: '/eliminar-cuenta' },
    { label: 'Soporte', href: '/soporte' },
    { label: 'Contacto', href: '/contacto' },
  ],
} as const;

export const pages = {
  '/': { title: site.seo.title, description: site.seo.description, index: true },
  '/privacidad': { title: `Aviso de privacidad | ${brand}`, description: `Borrador del aviso de privacidad de ${brand}. Consulta los datos y proveedores documentados y los puntos pendientes de revisión.`, index: false },
  '/terminos': { title: `Términos de uso | ${brand}`, description: `Borrador de los términos de uso de ${brand}, pendiente de revisión antes del lanzamiento.`, index: false },
  '/eliminar-cuenta': { title: `Eliminación de cuenta | ${brand}`, description: `Consulta cómo eliminar una cuenta de ${brand}, qué información se elimina y qué registros pueden conservarse o anonimizarse.`, index: false },
  '/contacto': { title: `Contacto | ${brand}`, description: `Contacta al equipo de ${brand} para consultas generales sobre el marketplace universitario.`, index: true },
  '/soporte': { title: `Soporte | ${brand}`, description: `Encuentra el canal de soporte de ${brand} y orientación sobre la aplicación y su próximo lanzamiento.`, index: true },
  '/404': { title: `Página no encontrada | ${brand}`, description: `Esta página no está disponible. Regresa al inicio de ${brand}.`, index: false },
} as const;

export type PagePath = keyof typeof pages;
export const canonical = (path: string) => new URL(path, site.url).href;
