'use client';

import { CatalogoFicha, type ConfigCatalogo } from '../_components/CatalogoFicha';

const CONFIG: ConfigCatalogo = {
  titulo: 'Empleados',
  api: '/api/empleados',
  ruta: '/dashboard/taller/empleados',
  claveLista: 'empleados',
  claveDetalle: 'empleado',
  placeholderBusqueda: 'Nombre, código, DUI o puesto',
  textoNuevo: 'Nuevo empleado',
  textoVacio: (
    <>
      <p className="text-sm text-muted-foreground">Elija un empleado o cree uno nuevo.</p>
      <p className="text-xs text-muted-foreground max-w-md">
        Los mecánicos que se registran aquí son los que firman las revisiones de partes y las reparaciones de cada orden.
      </p>
    </>
  ),
  filaLista: (f) => ({
    principal: `${f.nombre} ${f.apellido}`,
    secundario: String(f.codigo),
    derecha: f.puesto ? String(f.puesto) : undefined,
  }),
  titulo_ficha: (f) => `${f.codigo} · ${f.nombre} ${f.apellido}`,
  secciones: [
    {
      titulo: 'Datos personales',
      campos: [
        { campo: 'nombre', etiqueta: 'Nombre(s)', obligatorio: true },
        { campo: 'apellido', etiqueta: 'Apellido(s)', obligatorio: true },
        { campo: 'codigo', etiqueta: 'Código', placeholder: 'Automático (EMP-00001)' },
        { campo: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
        { campo: 'dui', etiqueta: 'DUI', placeholder: '00000000-0' },
        { campo: 'nit', etiqueta: 'NIT' },
        { campo: 'isss', etiqueta: 'Afiliación ISSS' },
        { campo: 'afp', etiqueta: 'AFP', tipo: 'select', opciones: ['CRECER', 'CONFÍA'] },
        { campo: 'nup', etiqueta: 'NUP' },
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
        { campo: 'departamento_residencia', etiqueta: 'Departamento' },
      ],
    },
    {
      titulo: 'Trabajo',
      campos: [
        { campo: 'puesto', etiqueta: 'Puesto' },
        { campo: 'departamento', etiqueta: 'Área' },
        { campo: 'tipo_contrato', etiqueta: 'Contrato', tipo: 'select', opciones: ['PLANTA', 'TEMPORAL', 'HONORARIOS'] },
        { campo: 'salario', etiqueta: 'Salario ($)', tipo: 'number' },
        { campo: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'date' },
        { campo: 'fecha_baja', etiqueta: 'Fecha de baja', tipo: 'date' },
        { campo: 'activo', etiqueta: 'Activo', tipo: 'check' },
        { campo: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 4 },
      ],
    },
  ],
};

export default function EmpleadosPage() {
  return <CatalogoFicha config={CONFIG} />;
}
