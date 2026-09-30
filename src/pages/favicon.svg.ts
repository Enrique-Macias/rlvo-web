import { site } from '../config/site';
export const GET = () => new Response(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#F3F0EA"/><text x="12" y="49" font-family="Georgia,serif" font-size="49" font-weight="bold" fill="#221F1C">${site.brand.charAt(0)}</text><circle cx="53" cy="48" r="4" fill="#C1440E"/></svg>`,
  { headers: { 'Content-Type': 'image/svg+xml' } },
);
