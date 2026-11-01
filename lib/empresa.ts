/** Datos de la empresa para documentos impresos. Se configuran en `.env.local` (NEXT_PUBLIC_EMPRESA_*). */
export const EMPRESA = {
  nombre: process.env.NEXT_PUBLIC_EMPRESA_NOMBRE || 'Taller',
  nit: process.env.NEXT_PUBLIC_EMPRESA_NIT || '',
  nrc: process.env.NEXT_PUBLIC_EMPRESA_NRC || '',
  direccion: process.env.NEXT_PUBLIC_EMPRESA_DIRECCION || '',
  telefono: process.env.NEXT_PUBLIC_EMPRESA_TELEFONO || '',
  email: process.env.NEXT_PUBLIC_EMPRESA_EMAIL || '',
};
