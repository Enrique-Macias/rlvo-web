export const priceMxn = (n: number) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0, minimumFractionDigits: 0,
}).format(n) + ' MXN';
