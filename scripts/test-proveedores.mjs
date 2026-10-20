// Prueba funcional del módulo Proveedores contra el servidor de desarrollo.
// Uso: node scripts/test-proveedores.mjs
// Requiere: npm run dev activo y MySQL/MariaDB encendido.

const BASE = 'http://localhost:3000/api/proveedores';

let fallos = 0;

function ok(msg) { console.log('  OK   ' + msg); }
function fail(msg) { console.log('  FALLA ' + msg); fallos++; }
function paso(n, t) { console.log(`\n[${n}] ${t}`); }

function check(cond, msg) { cond ? ok(msg) : fail(msg); }

async function api(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function post(url, cuerpo) {
  return api(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

async function put(url, cuerpo) {
  return api(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

async function main() {
  const marca = Date.now();
  let idLocal, idExt, codLocal, codExt, idCuenta;

  // ---------------------------------------------------------------
  paso(1, 'Sugerencia de código según tipo');
  {
    const a = await api(`${BASE}?sugerir_codigo=LOCAL`);
    const b = await api(`${BASE}?sugerir_codigo=EXTRANJERO`);
    check(a.data.codigo?.startsWith('PL'), `local usa prefijo PL -> ${a.data.codigo}`);
    check(b.data.codigo?.startsWith('PE'), `extranjero usa prefijo PE -> ${b.data.codigo}`);
  }

  // ---------------------------------------------------------------
  paso(2, 'Crear proveedor local con 2 contactos');
  {
    const { status, data } = await post(BASE, {
      tipo_proveedor: 'LOCAL',
      nombre_legal: `LA CASA DEL REPUESTO ${marca}`,
      nombre_comercial: 'La Casa del Repuesto',
      alias: `LCR${marca}`,
      direccion: 'Blvd. Los Próceres #123',
      ciudad: 'San Salvador',
      pais: 'EL SALVADOR',
      telefono: '2222-3333',
      email: 'ventas@lcr.com.sv',
      nit: `0614-${marca}-001-2`,
      nrc: '123456',
      giro: 'Venta de repuestos automotrices',
      categoria_contribuyente: 'GRAN_CONTRIBUYENTE',
      que_provee: 'PRODUCTO_Y_GASTO',
      incluir_en_catalogo: true,
      limite_credito_usd: 5000.5,
      dias_credito: 45,
      contactos: [
        { orden: 1, nombre: 'Juan Pérez', puesto_cargo: 'Gerente de Ventas', telefono: '2222-3334', movil: '7777-8888', email: 'jperez@lcr.com.sv' },
        { orden: 2, nombre: 'Ana López', puesto_cargo: 'Cobros', movil: '7777-9999', email: 'alopez@lcr.com.sv' },
        // Bloque vacío: debe ignorarse
        { orden: 3, nombre: '', puesto_cargo: '', telefono: '', movil: '', email: '' },
      ],
    });
    check(status === 200 && data.success, `creado (status ${status})`);
    check(data.codigo?.startsWith('PL'), `código autogenerado -> ${data.codigo}`);
    idLocal = data.idproveedor;
    codLocal = data.codigo;
  }

  // ---------------------------------------------------------------
  paso(3, 'Los contactos vacíos no se guardan');
  {
    const { data } = await api(`${BASE}?id=${idLocal}`);
    check(data.contactos?.length === 2, `se guardaron 2 de 3 contactos -> ${data.contactos?.length}`);
    check(data.contactos?.[0]?.puesto_cargo === 'Gerente de Ventas', 'puesto/cargo persistido');
    check(Number(data.proveedor.limite_credito_usd) === 5000.5, `límite de crédito -> ${data.proveedor.limite_credito_usd}`);
    check(Number(data.proveedor.dias_credito) === 45, `días de crédito -> ${data.proveedor.dias_credito}`);
    check(!!data.proveedor.incluir_en_catalogo, 'incluir_en_catalogo = true');
    check(data.proveedor.categoria_contribuyente === 'GRAN_CONTRIBUYENTE', 'categoría de contribuyente');
    check(Number(data.proveedor.saldo_actual) === 0, 'saldo_actual arranca en 0 (lo llenará Cuentas por Pagar)');
  }

  // ---------------------------------------------------------------
  paso(4, 'Crear proveedor extranjero');
  {
    const { data } = await post(BASE, {
      tipo_proveedor: 'EXTRANJERO',
      nombre_legal: `RICAMBI ITALIA SRL ${marca}`,
      alias: `RIC${marca}`,
      pais: 'ITALIA',
      moneda: 'EUR',
    });
    check(data.success && data.codigo?.startsWith('PE'), `código extranjero -> ${data.codigo}`);
    idExt = data.idproveedor;
    codExt = data.codigo;
  }

  // ---------------------------------------------------------------
  paso(5, 'Agregar cuenta bancaria con IBAN y SWIFT');
  {
    const { data } = await post(`${BASE}/cuentas`, {
      idproveedor: idExt,
      numero_cuenta: 'IT13 A010 0536 5900 0000 0000 044',
      beneficiario: 'RICAMBI ITALIA SRL',
      banco: 'BNL BANCA NAZIONALE',
      direccion_banco: 'Via Roma 1, Milano',
      moneda: 'EURO',
      codigo_swift: 'BNLIITRR',
      codigo_iban: 'IT13A0100536590000000000044',
      comentarios: 'Transferencia solo en euros',
    });
    check(data.success, `cuenta creada idcuenta=${data.idcuenta}`);
    idCuenta = data.idcuenta;
  }

  paso(6, 'Segunda cuenta al mismo proveedor (varias por titular)');
  {
    const { data } = await post(`${BASE}/cuentas`, {
      idproveedor: idExt,
      numero_cuenta: 'US-9988776655',
      banco: 'CITIBANK NA',
      moneda: 'USD',
      codigo_aba: '021000089',
    });
    check(data.success, 'segunda cuenta creada');

    const ficha = await api(`${BASE}?id=${idExt}`);
    check(ficha.data.cuentas?.length === 2, `el proveedor tiene 2 cuentas -> ${ficha.data.cuentas?.length}`);
  }

  // ---------------------------------------------------------------
  paso(7, 'Búsqueda por alias, código y NIT (requisito 10.1)');
  {
    const porAlias = await api(`${BASE}?q=LCR${marca}`);
    check(porAlias.data.proveedores?.length === 1, `por alias -> ${porAlias.data.proveedores?.length}`);

    const porCodigo = await api(`${BASE}?q=${codExt}`);
    check(porCodigo.data.proveedores?.length === 1, `por código/ID -> ${porCodigo.data.proveedores?.length}`);

    const porNit = await api(`${BASE}?q=0614-${marca}`);
    check(porNit.data.proveedores?.length === 1, `por NIT -> ${porNit.data.proveedores?.length}`);

    const porNombre = await api(`${BASE}?q=RICAMBI`);
    check(porNombre.data.proveedores?.length >= 1, `por nombre -> ${porNombre.data.proveedores?.length}`);
  }

  // ---------------------------------------------------------------
  paso(8, 'Conteos de la vista v_proveedores_resumen');
  {
    const { data } = await api(`${BASE}?q=RIC${marca}`);
    const p = data.proveedores[0];
    check(Number(p.total_cuentas) === 2, `total_cuentas -> ${p.total_cuentas}`);

    const l = await api(`${BASE}?q=LCR${marca}`);
    check(Number(l.data.proveedores[0].total_contactos) === 2, `total_contactos -> ${l.data.proveedores[0].total_contactos}`);
  }

  // ---------------------------------------------------------------
  paso(9, 'Actualizar proveedor y reemplazar contactos');
  {
    const { data: antes } = await api(`${BASE}?id=${idLocal}`);
    const { data } = await put(BASE, {
      ...antes.proveedor,
      nombre_comercial: 'LCR Repuestos',
      limite_credito_usd: 9999.99,
      contactos: [{ orden: 1, nombre: 'Carlos Nuevo', puesto_cargo: 'Compras', movil: '7000-0000' }],
    });
    check(data.success, 'actualizado');

    const { data: despues } = await api(`${BASE}?id=${idLocal}`);
    check(despues.proveedor.nombre_comercial === 'LCR Repuestos', 'nombre comercial actualizado');
    check(Number(despues.proveedor.limite_credito_usd) === 9999.99, `límite actualizado -> ${despues.proveedor.limite_credito_usd}`);
    check(despues.contactos.length === 1, `contactos reemplazados: 2 -> ${despues.contactos.length}`);
    check(despues.contactos[0].nombre === 'Carlos Nuevo', 'contacto nuevo correcto');
  }

  // ---------------------------------------------------------------
  paso(10, 'Validaciones');
  {
    const sinNombre = await post(BASE, { tipo_proveedor: 'LOCAL', nombre_legal: '  ' });
    check(sinNombre.status === 400, `nombre legal vacío rechazado (${sinNombre.status})`);

    const dup = await post(BASE, { codigo: codLocal, nombre_legal: 'OTRO DISTINTO' });
    check(dup.status === 409, `código duplicado rechazado con 409 (${dup.status})`);

    const cuentaSinNumero = await post(`${BASE}/cuentas`, { idproveedor: idExt, banco: 'X' });
    check(cuentaSinNumero.status === 400, `cuenta sin número rechazada (${cuentaSinNumero.status})`);

    const inexistente = await api(`${BASE}?id=99999999`);
    check(inexistente.status === 404, `proveedor inexistente da 404 (${inexistente.status})`);
  }

  // ---------------------------------------------------------------
  paso(11, 'Baja lógica y filtro de activos');
  {
    const { data } = await api(`${BASE}?id=${idLocal}`, { method: 'DELETE' });
    const del = await api(`${BASE}?id=${idLocal}`, { method: 'DELETE' });
    check(del.data.success, 'baja lógica aplicada');

    const ficha = await api(`${BASE}?id=${idLocal}`);
    check(!ficha.data.proveedor.activo, 'quedó inactivo pero el registro sigue existiendo');

    const activos = await api(`${BASE}?q=LCR${marca}&activo=true`);
    check(activos.data.proveedores?.length === 0, 'no aparece al filtrar solo activos');
  }

  // ---------------------------------------------------------------
  paso(12, 'Limpieza de los datos de prueba');
  {
    const a = await api(`${BASE}?id=${idLocal}&permanente=true`, { method: 'DELETE' });
    const b = await api(`${BASE}?id=${idExt}&permanente=true`, { method: 'DELETE' });
    check(a.data.success && b.data.success, 'proveedores de prueba eliminados');

    const cuenta = await api(`${BASE}/cuentas?idcuenta=${idCuenta}`);
    check(cuenta.status === 404, 'las cuentas cayeron por ON DELETE CASCADE');
  }

  console.log('\n' + '='.repeat(50));
  console.log(fallos === 0
    ? 'TODAS LAS PRUEBAS PASARON'
    : `${fallos} PRUEBA(S) FALLARON`);
  console.log('='.repeat(50));
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nError inesperado:', e.message);
  process.exit(1);
});
