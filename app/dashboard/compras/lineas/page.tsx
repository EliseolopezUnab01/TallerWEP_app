import { redirect } from 'next/navigation';

export default async function LineasCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ idcompra?: string; id?: string }>;
}) {
  const { idcompra, id } = await searchParams;
  const destino = idcompra || id;
  redirect(destino ? `/dashboard/compras/ingreso?id=${encodeURIComponent(destino)}` : '/dashboard/compras/ingreso');
}
