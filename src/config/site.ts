import legalCurrent from './legal-current.json';

const brand = 'RLVO';
const domain = 'rlvo.com.mx';
const url = `https://www.${domain}`;

export const site = {
  brand,
  previousBrand: 'Relevo',
  domain,
  url,
  locale: 'es-MX',
  ogLocale: 'es_MX',
  brandAssets: {
    logo: '/brand/07_logo_horizontal_verde_transparente.svg',
    logoInverse: '/brand/09_logo_horizontal_blanco_transparente.svg',
    favicon: '/favicon.svg',
  },
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
    deletion: '[[POR CONFIRMAR: fecha de actualización de la información de eliminación]]',
  },
  legal: { current: legalCurrent },
  seo: {
    title: `${brand} — Compra y vende entre estudiantes`,
    description: 'Un marketplace móvil para comprar y vender entre estudiantes de tu comunidad universitaria, con verificación por correo universitario. Próximamente.',
    image: '/og/rlvo-paleta-06.png',
    imageAlt: `Logotipo oficial de ${brand} sobre fondo verde.`,
    imageWidth: 1200,
    imageHeight: 630,
    themeColor: '#F5FAF8',
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
export interface PageMetadata { title: string; description: string; index: boolean; path: string }
export const canonical = (path: string) => new URL(path, site.url).href;
