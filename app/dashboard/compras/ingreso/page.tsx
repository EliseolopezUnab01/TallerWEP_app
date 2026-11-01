'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FilePlus2, FolderOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { UserDropdown } from '@/components/user-dropdown';
import { UI } from '@/lib/ui';
import { useCompra } from './_components/useCompra';
import { BarraDte } from './_components/BarraDte';
import { PanelProveedor } from './_components/PanelProveedor';
import { PanelInventario } from './_components/PanelInventario';
import { GrillaDetalle, lineaAForm } from './_components/GrillaDetalle';
import { BarraTotales } from './_components/BarraTotales';
import { DialogoAbrirCompra } from './_components/DialogoAbrirCompra';
import { ImportarDialog, type FilaImportada } from './_components/ImportarDialog';
import { PendientesImportacion } from './_components/PendientesImportacion';
import { formLineaVacia, type FormLinea } from './_components/tipos';

function Esqueleto() {
  const bloque = 'rounded-lg border border-border bg-card animate-pulse';
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando compra">
      <div className={`${bloque} h-24`} />
      <div className="grid gap-2 min-[1300px]:grid-cols-[minmax(23rem,27rem)_1fr]">
        <div className={`${bloque} h-[26rem]`} />
        <div className={`${bloque} h-[26rem]`} />
      </div>
      <div className={`${bloque} h-48`} />
    </div>
  );
}

export default function IngresoCompraPage() {
  const ctx = useCompra();
  const { compra, aviso, cargandoInicial } = ctx;
  const [dialogo, setDialogo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [archivoSoltado, setArchivoSoltado] = useState<File | null>(null);
  const [pendientes, setPendientes] = useState<FilaImportada[]>([]);
  const [usadas, setUsadas] = useState<Set<number>>(new Set());
  const [ivaDefault, setIvaDefault] = useState('GRAVADA');
  const [form, setForm] = useState<FormLinea>(() => formLineaVacia());
  const [existencia, setExistencia] = useState<number | null>(null);
  const refProveedor = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(formLineaVacia(ivaDefault));
    setExistencia(null);
    setPendientes([]);
    setUsadas(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compra?.idcompra]);

  const puedeImportar = Boolean(compra && ctx.esBorrador);
  const alSoltarArchivo = (e: React.DragEvent) => {
    if (!puedeImportar || importando || !e.dataTransfer.files?.length) return;
    e.preventDefault();
    setArchivoSoltado(e.dataTransfer.files[0]);
    setImportando(true);
  };

  const atajos = useCallback(
    (e: KeyboardEvent) => {
      if (dialogo || importando) return;
      if (e.key === 'F2') {
        e.preventDefault();
        if (ctx.esBorrador && confirm('¿Registrar esta compra? Ya no se podrá editar.')) ctx.registrar();
      } else if (e.key === 'F3') {
        e.preventDefault();
        refProveedor.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (compra?.estado === 'REGISTRADA' && confirm('¿Anular esta compra registrada?')) ctx.anular();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (ctx.esBorrador) ctx.guardar();
      }
    },
    [ctx, compra?.estado, dialogo, importando]
  );

  useEffect(() => {
    window.addEventListener('keydown', atajos);
    return () => window.removeEventListener('keydown', atajos);
  }, [atajos]);

  return (
    <DashboardLayout>
      <div
        className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}
        onDragOver={(e) => {
          if (puedeImportar && !importando && e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={alSoltarArchivo}
      >
        <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className={`${UI.navbar} shrink-0`}>
            <div className="flex items-center gap-3">
              <span className={UI.navLabel}>Compras</span>
              <span className={UI.navDivider} />
              <span className={UI.navTitle}>Registro y control de compras</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <UserDropdown />
            </div>
          </div>

          {cargandoInicial ? (
            <Esqueleto />
          ) : (
            <>
              <div className="shrink-0">
                <BarraDte ctx={ctx} onAbrir={() => setDialogo(true)} />
              </div>

              {compra ? (
                <>
                  <div className="grid gap-2 min-[1300px]:grid-cols-[minmax(23rem,27rem)_1fr] shrink-0">
                    <PanelProveedor ref={refProveedor} ctx={ctx} />
                    <PanelInventario
                      ctx={ctx}
                      form={form}
                      setForm={setForm}
                      ivaDefault={ivaDefault}
                      setIvaDefault={setIvaDefault}
                      onExistencia={setExistencia}
                      onImportar={() => setImportando(true)}
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-h-[16rem]">
                    <GrillaDetalle
                      ctx={ctx}
                      editandoId={form.iddetalle}
                      existencia={existencia}
                      onEditar={(l) => {
                        setForm(lineaAForm(l));
                        setExistencia(null);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className={`${UI.densePanel} flex-1 flex flex-col items-center justify-center gap-3 py-16 text-center`}>
                  <p className="text-sm text-muted-foreground">
                    No hay una compra abierta. Cree un borrador nuevo o abra una compra existente.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className={UI.denseBtnPrimary} onClick={ctx.crear}>
                      <FilePlus2 className="w-3.5 h-3.5" /> Nueva compra
                    </button>
                    <button type="button" className={UI.denseBtn} onClick={() => setDialogo(true)}>
                      <FolderOpen className="w-3.5 h-3.5" /> Abrir compra
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!cargandoInicial && compra && (
          <div className="shrink-0">
            <BarraTotales ctx={ctx} />
          </div>
        )}
      </div>

      <ImportarDialog
        abierto={importando}
        archivoInicial={archivoSoltado}
        ctx={ctx}
        onCerrar={() => {
          setImportando(false);
          setArchivoSoltado(null);
        }}
        onPendientes={(filas) => {
          setPendientes(filas);
          setUsadas(new Set());
        }}
        onApendice={(item) =>
          setForm({
            ...formLineaVacia('XCOMPROBAR'),
            destino: 'GASTOS',
            descripcion: item.etiqueta,
            costo_unitario: String(item.monto ?? ''),
          })
        }
      />

      {pendientes.length > 0 && (
        <PendientesImportacion
          filas={pendientes}
          usadas={usadas}
          onCargar={(f) => {
            setForm({
              ...formLineaVacia(ivaDefault),
              referencia_proveedor: f.referencia,
              descripcion: f.descripcion,
              cantidad: String(f.cantidad),
              costo_unitario: String(f.precio),
            });
            setUsadas(new Set(usadas).add(f.fila));
          }}
          onCerrar={() => setPendientes([])}
        />
      )}

      <DialogoAbrirCompra
        abierto={dialogo}
        idActual={compra?.idcompra ?? null}
        onCerrar={() => setDialogo(false)}
        onElegir={(id) => {
          setDialogo(false);
          ctx.abrir(id);
        }}
      />

      {aviso && (
        <div
          className={`fixed bottom-24 right-6 z-50 max-w-md px-3 py-2 flex items-center gap-2 text-xs shadow-lg ${
            aviso.tipo === 'ok' ? UI.avisoOk : UI.avisoError
          }`}
        >
          {aviso.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {aviso.texto}
        </div>
      )}
    </DashboardLayout>
  );
}
