// Prueba de la escalera de respaldos: tres correcciones seguidas sobre un producto.
// Uso: node scripts/probar-costos.mjs IDPROD            (servidor en BASE, por defecto http://localhost:3000)
//      node scripts/probar-costos.mjs precios IDPROD    → calcula y guarda dos niveles, muestra el historial
//      node scripts/probar-costos.mjs compra   → crea un borrador, muestra descuento_afecta_costo y lo borra
const modo = process.argv[2];
const idprod = Number(modo);
const BASE = process.env.BASE || 'http://localhost:3000';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.USUARIO_ADMIN || 'zz.admin@local', password: process.env.CLAVE || 'prueba123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

if (modo === 'compra') {
  const r = await fetch(`${BASE}/api/compras`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clase_documento: 'DTE', tipo_dte: '03' }),
  });
  const { idcompra } = await r.json();
  const g = await (await fetch(`${BASE}/api/compras?id=${idcompra}`, { headers: { cookie } })).json();
  console.log('borrador', idcompra, 'descuento_afecta_costo =', (g.compra ?? g).descuento_afecta_costo);
  const d = await fetch(`${BASE}/api/compras?id=${idcompra}`, { method: 'DELETE', headers: { cookie } });
  console.log('borrado', d.status);
  process.exit(0);
}
if (modo === 'precios') {
  const id = Number(process.argv[3]);
  const calc = await fetch(`${BASE}/api/ajuste-precios`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ idprod: id, modo: 'precio', tipoPrecio: 'inversor', valor: 20 }),
  });
  console.log('calculo', calc.status, JSON.stringify((await calc.json()).resultado));
  const put = await fetch(`${BASE}/api/ajuste-precios`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idprod: id,
      razon: 'prueba automática',
      precios: [
        { tipoPrecio: 'general_alto', precio: 25.123456789, porcentaje: 10, ganancia: 3 },
        { tipoPrecio: 'inversor', precio: 20, porcentaje: 5, ganancia: 1 },
      ],
    }),
  });
  console.log('guardar', put.status, (await put.json()).message || '');
  const g = await (await fetch(`${BASE}/api/ajuste-precios?idprod=${id}`, { headers: { cookie } })).json();
  console.log('precio1..7', [1, 2, 3, 4, 5, 6, 7].map((n) => g.producto[`precio${n}`]).join(' | '));
  const h = await (await fetch(`${BASE}/api/ajuste-precios/historial?idprod=${id}`, { headers: { cookie } })).json();
  const f = h.historial[0];
  console.log('historial nuevo', [1, 2, 3, 4, 5, 6, 7].map((n) => f[`precio${n}_nuevo`]).join(' | '), '| usuario', f.usuario_nombre);
  process.exit(0);
}
if (!idprod) throw new Error('Indique el idprod, "compra" o "precios IDPROD"');

async function corregir(cuerpo) {
  const r = await fetch(`${BASE}/api/costos`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ idprod, ...cuerpo }),
  });
  console.log('POST', JSON.stringify(cuerpo), r.status, (await r.json()).message || '');
}

await corregir({ costo: 10, costo_local: 11 });
await corregir({ costo: 12, costo_local: 14 });
await corregir({ costo: 15, costo_local: 16 });
const r = await fetch(`${BASE}/api/costos?idprod=${idprod}`, { headers: { cookie } });
const { costo: c } = await r.json();
for (const k of ['costo', 'costo_previo1', 'costo_previo2', 'costo_local', 'costolcl_previo1', 'costolcl_previo2', 'costo_promedio', 'costop_previo1', 'costop_previo2']) {
  console.log(k.padEnd(18), c[k]);
}
