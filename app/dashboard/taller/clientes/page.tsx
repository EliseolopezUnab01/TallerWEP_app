'use client';

import Link from 'next/link';
import { Car } from 'lucide-react';
import { UI } from '@/lib/ui';
import { CatalogoFicha, type ConfigCatalogo } from '../_components/CatalogoFicha';
import type { Fila } from '../_components/comun';

const CONFIG: ConfigCatalogo = {
  titulo: 'Clientes',
  api: '/api/clientes',
  ruta: '/dashboard/taller/clientes',
  claveLista: 'clientes',
  claveDetalle: 'cliente',
  placeholderBusqueda: 'Nombre, código, DUI, NIT o teléfono',
  textoNuevo: 'Nuevo cliente',
  textoVacio: (
    <>
      <p className="text-sm text-muted-foreground">Elija un cliente o cree uno nuevo.</p>
      <p className="text-xs text-muted-foreground max-w-md">
        Personas con DUI; empresas con NIT, NRC y giro si son contribuyentes. Los vehículos del cliente se ven abajo de su ficha.
      </p>
    </>
  ),
  filaLista: (f) => ({
    principal: String(f.nombre),
    secundario: String(f.dui || f.nit || f.codigo),
    derecha: Number(f.vehiculos) ? `${f.vehiculos} veh.` : undefined,
  }),
  titulo_ficha: (f) => `${f.codigo} · ${f.nombre}`,
  secciones: [
    {
      titulo: 'Identificación',
      campos: [
        { campo: 'nombre', etiqueta: 'Nombre o razón social', ancho: 2, obligatorio: true },
        { campo: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: ['PERSONA', 'EMPRESA'] },
        { campo: 'codigo', etiqueta: 'Código', placeholder: 'Automático (CLI-00001)' },
        { campo: 'dui', etiqueta: 'DUI', placeholder: '00000000-0' },
        { campo: 'nit', etiqueta: 'NIT', placeholder: '0000-000000-000-0' },
        { campo: 'nrc', etiqueta: 'NRC' },
        { campo: 'giro', etiqueta: 'Giro o actividad' },
      ],
    },
    {
      titulo: 'Contacto',
      campos: [
        { campo: 'telefono', etiqueta: 'Teléfono' },
        { campo: 'telefono2', etiqueta: 'Teléfono 2' },
        { campo: 'email', etiqueta: 'Correo', ancho: 2 },
        { campo: 'direccion', etiqueta: 'Dirección', ancho: 2 },
        { campo: 'municipio', etiqueta: 'Municipio' },
        { campo: 'departamento', etiqueta: 'Departamento' },
      ],
    },
    {
      titulo: 'Crédito',
      campos: [
        { campo: 'limite_credito', etiqueta: 'Límite de crédito ($)', tipo: 'number' },
        { campo: 'dias_credito', etiqueta: 'Días de crédito', tipo: 'number' },
        { campo: 'descuento_general', etiqueta: 'Descuento general (%)', tipo: 'number' },
        { campo: 'activo', etiqueta: 'Activo', tipo: 'check' },
        { campo: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 4 },
      ],
    },
  ],
  extra: (detalle) => {
    const vehiculos = (detalle.vehiculos as Fila[]) ?? [];
    const id = (detalle.cliente as Fila).id;
    return (
      <div className={`${UI.densePanel} shrink-0`}>
        <div className={`${UI.densePanelTitle} flex items-center justify-between`}>
          <span>Vehículos ({vehiculos.length})</span>
          <Link href={`/dashboard/taller/vehiculos?nuevo=${id}`} className="normal-case tracking-normal text-primary hover:underline">
            + Agregar vehículo
          </Link>
        </div>
        {vehiculos.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Sin vehículos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={UI.denseTable}>
              <thead>
                <tr>
                  <th className={UI.denseTh}>Código</th>
                  <th className={UI.denseTh}>Placa</th>
                  <th className={UI.denseTh}>Vehículo</th>
                  <th className={UI.denseTh}>Color</th>
                  <th className={UI.denseTh} />
                </tr>
              </thead>
              <tbody>
                {vehiculos.map((v) => (
                  <tr key={String(v.id)} className={Number(v.activo) ? '' : 'opacity-60'}>
                    <td className={`${UI.denseTd} ${UI.denseMono}`}>{String(v.codigo ?? '')}</td>
                    <td className={`${UI.denseTd} ${UI.denseMono} font-semibold`}>
                      {String(v.placa ?? '—')}
                      {v.anio_placa ? <span className="text-muted-foreground font-normal"> / {String(v.anio_placa)}</span> : null}
                    </td>
                    <td className={UI.denseTd}>
                      {String(v.marca)} {String(v.modelo)} {v.anio_modelo ? String(v.anio_modelo) : ''}
                    </td>
                    <td className={UI.denseTd}>{String(v.color ?? '')}</td>
                    <td className={`${UI.denseTd} text-right`}>
                      <Link href={`/dashboard/taller/vehiculos?id=${v.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Car className="h-3.5 w-3.5" /> Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
};

export default function ClientesPage() {
  return <CatalogoFicha config={CONFIG} />;
}
