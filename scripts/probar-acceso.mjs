// Prueba rápida del proxy: sin sesión, con rol Consulta y con Administrador.
// Uso: node scripts/probar-acceso.mjs [http://localhost:3000]
const BASE = process.argv[2] || 'http://localhost:3000';

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  return { status: r.status, cookie };
}

async function pedir(ruta, cookie, metodo = 'GET', cuerpo) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return `${r.status}${r.headers.get('location') ? ` -> ${r.headers.get('location')}` : ''}`;
}

const casos = [
  ['GET', '/api/productos?limit=1'],
  ['GET', '/api/usuarios'],
  ['PUT', '/api/proveedores', {}],
  ['GET', '/api/costos'],
  ['GET', '/dashboard'],
  ['GET', '/dashboard/configuracion/usuarios'],
  ['GET', '/uploads/no-existe.png'],
  ...(process.env.RUTAS_EXTRA || '').split(',').filter(Boolean).map((r) => ['GET', r]),
];

const sesiones = {
  'sin sesión': '',
  consulta: (await login(process.env.USUARIO_CONSULTA || 'zz.consulta@local', process.env.CLAVE || 'prueba123')).cookie,
  admin: (await login(process.env.USUARIO_ADMIN || 'zz.admin@local', process.env.CLAVE || 'prueba123')).cookie,
};

for (const [nombre, cookie] of Object.entries(sesiones)) {
  console.log(`\n== ${nombre} ${cookie ? '(cookie ok)' : ''}`);
  for (const [metodo, ruta, cuerpo] of casos) console.log(`${metodo.padEnd(4)} ${ruta.padEnd(40)} ${await pedir(ruta, cookie, metodo, cuerpo)}`);
}
