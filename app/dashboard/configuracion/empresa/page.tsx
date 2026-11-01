'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { BarraPantalla } from '@/components/barra-pantalla';
import { Formulario, Toast, aValores, pedir, useAviso, type Seccion, type Valores } from '@/app/dashboard/taller/_components/comun';
import { obtenerEmpresa } from '@/lib/empresa-cliente';
import { AMBIENTES, DEPARTAMENTOS, TIPOS_DOCUMENTO_ID, TIPOS_ESTABLECIMIENTO } from '@/lib/hacienda-catalogos';
import { useSesion } from '@/lib/sesion-cliente';
import { UI } from '@/lib/ui';

const op = (lista: { codigo: string | number; nombre: string }[]) =>
  lista.map((x) => ({ valor: String(x.codigo), etiqueta: `${x.codigo} · ${x.nombre}` }));

const SECCIONES: Seccion[] = [
  {
    titulo: 'Datos generales',
    campos: [
      { campo: 'nombre', etiqueta: 'Razón social', ancho: 2, obligatorio: true },
      { campo: 'nombre_comercial', etiqueta: 'Nombre comercial', ancho: 2 },
      { campo: 'nit', etiqueta: 'NIT (sin guiones)', placeholder: '06141234567890' },
      { campo: 'nrc', etiqueta: 'NRC (sin guiones)' },
      { campo: 'cod_actividad', etiqueta: 'Código de actividad (CAT-019)' },
      { campo: 'desc_actividad', etiqueta: 'Actividad económica' },
      { campo: 'departamento', etiqueta: 'Departamento', tipo: 'select', opciones: op(DEPARTAMENTOS) },
      { campo: 'municipio', etiqueta: 'Municipio (código CAT-013)', placeholder: '14' },
      { campo: 'direccion', etiqueta: 'Dirección', ancho: 2 },
      { campo: 'telefono', etiqueta: 'Teléfono' },
      { campo: 'correo', etiqueta: 'Correo' },
    ],
  },
  {
    titulo: 'Tributario',
    campos: [
      {
        campo: 'categoria_contribuyente',
        etiqueta: 'Categoría de contribuyente',
        tipo: 'select',
        opciones: [
          { valor: 'GRAN_CONTRIBUYENTE', etiqueta: 'Gran contribuyente' },
          { valor: 'CONTRIBUYENTE', etiqueta: 'Mediano' },
          { valor: 'PEQUENO', etiqueta: 'Pequeño' },
          { valor: 'OTRO', etiqueta: 'Otro' },
        ],
      },
      { campo: 'agente_retencion', etiqueta: 'Agente de retención de IVA (1 %)', tipo: 'check' },
      {
        campo: 'descuento_modo',
        etiqueta: 'Descuento en compras (por defecto)',
        tipo: 'select',
        opciones: [
          { valor: 'INFORMATIVO', etiqueta: 'Informativo: el costo es el precio antes del descuento' },
          { valor: 'COSTO', etiqueta: 'Baja el costo: el costo es el precio con descuento' },
        ],
        ancho: 2,
      },
    ],
  },
  {
    titulo: 'Hacienda: facturación electrónica',
    campos: [
      { campo: 'dte_ambiente', etiqueta: 'Ambiente', tipo: 'select', opciones: Object.entries(AMBIENTES).map(([v, e]) => ({ valor: v, etiqueta: `${v} · ${e}` })) },
      { campo: 'dte_usuario_api', etiqueta: 'Usuario de la API (NIT)' },
      { campo: 'tipo_establecimiento', etiqueta: 'Tipo de establecimiento', tipo: 'select', opciones: op(TIPOS_ESTABLECIMIENTO) },
      { campo: 'prefijo_control', etiqueta: 'Prefijo del número de control', placeholder: 'M001P001' },
      { campo: 'cod_estable_mh', etiqueta: 'Cód. establecimiento MH' },
      { campo: 'cod_estable', etiqueta: 'Cód. establecimiento interno' },
      { campo: 'cod_punto_venta_mh', etiqueta: 'Cód. punto de venta MH' },
      { campo: 'cod_punto_venta', etiqueta: 'Cód. punto de venta interno' },
      { campo: 'responsable_nombre', etiqueta: 'Responsable de invalidaciones', ancho: 2 },
      { campo: 'responsable_tipo_doc', etiqueta: 'Tipo de documento', tipo: 'select', opciones: op(TIPOS_DOCUMENTO_ID) },
      { campo: 'responsable_num_doc', etiqueta: 'Número de documento' },
    ],
  },
];

interface EstadoHacienda {
  api_clave: boolean;
  cert_clave: boolean;
  firmador_url: string;
}

function Indicador({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? UI.textStockOk : UI.textStockBad}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {texto}
    </span>
  );
}

export default function EmpresaPage() {
  const { aviso, notificar } = useAviso();
  const { puede } = useSesion();
  const editable = puede('configuracion.editar');
  const [valores, setValores] = useState<Valores>({});
  const [hacienda, setHacienda] = useState<EstadoHacienda | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await pedir('/api/empresa');
      setValores(aValores(d.empresa, SECCIONES));
      setHacienda(d.hacienda);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    try {
      const d = await pedir('/api/empresa', 'PUT', valores);
      setValores(aValores(d.empresa, SECCIONES));
      obtenerEmpresa(true);
      notificar('ok', d.mensaje);
    } catch (e) {
      notificar('error', (e as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div className={`${UI.canvas} flex flex-col gap-2 lg:h-[calc(100vh-3rem)]`}>
        <BarraPantalla modulo="Configuración" titulo="Empresa">
          {editable && (
            <button type="button" className={UI.denseBtnPrimary} onClick={guardar}>
              <Save className="h-3.5 w-3.5" /> Guardar
            </button>
          )}
        </BarraPantalla>

        <div className={`${UI.densePanel} min-h-0 flex-1 overflow-auto`}>
          <fieldset disabled={!editable}>
            <Formulario secciones={SECCIONES} valores={valores} onCambio={(c, v) => setValores((x) => ({ ...x, [c]: v }))} />
          </fieldset>
          {hacienda && (
            <div className="border-t border-border p-3 text-xs">
              <div className={UI.denseLabel}>Credenciales en .env.local (no se guardan en la base)</div>
              <div className="mt-1 flex flex-wrap gap-4">
                <Indicador ok={hacienda.api_clave} texto="DTE_API_CLAVE (clave de la API)" />
                <Indicador ok={hacienda.cert_clave} texto="DTE_CERT_CLAVE (clave privada del certificado)" />
                <span className={UI.textMuted}>Firmador: {hacienda.firmador_url}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <Toast aviso={aviso} />
    </DashboardLayout>
  );
}
