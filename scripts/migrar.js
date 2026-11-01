// Aplica las migraciones pendientes de migrations/ en orden y las anota en schema_migraciones.
// Uso:
//   npm run migrate              aplica las pendientes
//   npm run migrate -- --estado  lista aplicadas y pendientes
//   npm run migrate -- --base 017  marca como aplicadas todas hasta ese número (sin ejecutarlas)
// Se ejecuta con cmd /c "mysql ... < archivo" porque la tubería de PowerShell daña tildes y ñ.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

const RAIZ = path.join(__dirname, '..');
const CARPETA = path.join(RAIZ, 'migrations');

function cargarEnv() {
  for (const nombre of ['.env.local', '.env']) {
    const ruta = path.join(RAIZ, nombre);
    if (!fs.existsSync(ruta)) continue;
    for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function config() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taller_web',
  };
}

function numero(archivo) {
  return Number((archivo.match(/^(\d+)/) || [])[1] || 0);
}

function archivos() {
  return fs
    .readdirSync(CARPETA)
    .filter((f) => /^\d+.*\.sql$/i.test(f))
    .sort((a, b) => numero(a) - numero(b) || a.localeCompare(b));
}

function aplicar(archivo, c) {
  const bin = process.env.MYSQL_BIN || 'C:\\xampp\\mysql\\bin\\mysql.exe';
  const clave = c.password ? ` -p${c.password}` : '';
  const comando = `"${bin}" -h${c.host} -P${c.port} -u${c.user}${clave} --default-character-set=utf8mb4 ${c.database} < "${path.join(CARPETA, archivo)}"`;
  execSync(`cmd /c "${comando}"`, { stdio: 'inherit' });
}

async function main() {
  cargarEnv();
  const c = config();
  const conn = await mysql.createConnection(c);
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migraciones (
       archivo VARCHAR(120) NOT NULL PRIMARY KEY,
       aplicado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [filas] = await conn.query('SELECT archivo FROM schema_migraciones');
  const hechas = new Set(filas.map((f) => f.archivo));
  const todas = archivos();
  const args = process.argv.slice(2);

  if (args[0] === '--estado') {
    for (const f of todas) console.log(`${hechas.has(f) ? '[x]' : '[ ]'} ${f}`);
    await conn.end();
    return;
  }

  if (args[0] === '--base') {
    const tope = Number(args[1]);
    if (!tope) throw new Error('Indique el número: --base 017');
    for (const f of todas.filter((f) => numero(f) <= tope && !hechas.has(f))) {
      await conn.query('INSERT INTO schema_migraciones (archivo) VALUES (?)', [f]);
      console.log(`marcada ${f}`);
    }
    await conn.end();
    return;
  }

  const pendientes = todas.filter((f) => !hechas.has(f));
  if (pendientes.length === 0) console.log('Sin migraciones pendientes.');
  for (const f of pendientes) {
    console.log(`aplicando ${f}...`);
    aplicar(f, c);
    await conn.query('INSERT INTO schema_migraciones (archivo) VALUES (?)', [f]);
  }
  await conn.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
