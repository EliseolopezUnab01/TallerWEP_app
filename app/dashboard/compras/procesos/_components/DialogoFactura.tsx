'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DialogoLineas, type Seleccion } from '../../documentos/_components/DialogoLineas';
import type { LineaDocumento } from '../../documentos/_components/tipos';
import { UI } from '@/lib/ui';
import { pedir, type DetalleProceso } from './comun';

interface Props {
  detalle: DetalleProceso;
  onCerrar: () => void;
  onError: (texto: string) => void;
}

/** Crea la factura del proveedor desde la proforma (u orden) con solo las líneas que sí salieron. */
export function DialogoFactura({ detalle, onCerrar, onError }: Props) {
  const router = useRouter();
  const candidatos = detalle.documentos.filter(
    (d) => (d.tipo_documento === 'PROFORMA' || d.tipo_documento === 'ORDEN') && d.estado_documento !== 'ANULADO'
  );
  const inicial = [...candidatos].reverse().find((d) => d.tipo_documento === 'PROFORMA') ?? candidatos[candidatos.length - 1];
  const [iddocumento, setIddocumento] = useState<number | null>(inicial ? Number(inicial.iddocumento) : null);
  const [lineas, setLineas] = useState<LineaDocumento[]>([]);
  const [numero, setNumero] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!iddocumento) return;
    let vigente = true;
    pedir(`/api/documentos-compras?id=${iddocumento}`)
      .then((data) => vigente && setLineas(data.lineas))
      .catch((e: Error) => vigente && onError(e.message));
    return () => {
      vigente = false;
    };
  }, [iddocumento, onError]);

  const elegir = (id: number) => {
    setLineas([]);
    setIddocumento(id);
  };

  const crear = async (seleccion: Seleccion) => {
    if (!iddocumento || enviando) return;
    setEnviando(true);
    try {
      const data = await pedir('/api/procesos', 'POST', {
        accion: 'ingresar_factura',
        idproceso: detalle.proceso.idproceso,
        iddocumento,
        numero_factura: numero,
        lineas: seleccion,
      });
      router.push(`/dashboard/compras/ingreso?id=${data.idcompra}`);
    } catch (e) {
      onError((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <DialogoLineas
      titulo="Ingresar factura del proveedor"
      lineas={lineas}
      textoConfirmar={enviando ? 'Creando…' : 'Crear factura en borrador'}
      encabezado={
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>Tomar líneas de</span>
            <select className={UI.denseSelect} value={iddocumento ?? ''} onChange={(e) => elegir(Number(e.target.value))}>
              {candidatos.map((d) => (
                <option key={String(d.iddocumento)} value={String(d.iddocumento)}>
                  {String(d.id_documento)} ({d.tipo_documento === 'PROFORMA' ? 'proforma' : 'orden'})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={UI.denseLabel}>N.º de factura del proveedor</span>
            <input className={`${UI.denseInput} w-40`} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </label>
          <p className="basis-full text-[11px] text-muted-foreground">
            Desmarque lo que no salió o baje la cantidad. La factura queda en borrador, vinculada como FACTURA y con el pedido pendiente al día.
          </p>
        </div>
      }
      onConfirmar={crear}
      onCerrar={onCerrar}
    />
  );
}
