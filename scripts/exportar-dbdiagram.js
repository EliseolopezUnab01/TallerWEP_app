/**
 * Genera un archivo DBML (dbdiagram.io) a partir del esquema vivo de taller_web.
 * Uso: node scripts/exportar-dbdiagram.js
 * Salida: docs/taller_web.dbml
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const EXCLUIR = new Set(['proveedores_legacy_backup']);

/** Agrupa las tablas para que el diagrama se lea por módulo. */
const GRUPOS = [
  { nombre: 'Usuarios', tablas: ['usuarios'] },
  {
    nombre: 'Inventario',
    tablas: [
      'categorias_nuevo',
      'grupos',
      'subgrupos',
      'productos',
      'producto_imagenes',
      'referencias_oem',
      'ubicaciones_producto',
    ],
  },
  { nombre: 'Precios', tablas: ['costos', 'precios', 'ajuste_precios'] },
  { nombre: 'Proveedores', tablas: ['proveedores', 'proveedor_contactos', 'cuentas_bancarias'] },
  { nombre: 'Catalogos_DTE', tablas: ['cat_tipos_dte', 'cat_formas_pago', 'cat_tributos', 'configuracion_impuestos'] },
  { nombre: 'Contabilidad', tablas: ['catalogo_contable'] },
  {
    nombre: 'Compras',
    tablas: ['compras', 'compras_detalle', 'compras_pagos', 'compras_documentos_rel', 'esquemas_dte', 'correlativos', 'ruta_archivos'],
  },
  {
    nombre: 'Cotizaciones',
    tablas: ['documentos_compras', 'documentos_compras_detalle', 'productos_temporales'],
  },
  {
    nombre: 'Importacion',
    tablas: [
      'proceso_ingreso',
      'relacion_documentos',
      'datos_duca',
      'duca_detalles',
      'costos_productos',
      'pedido_pendiente',
      'gastos_sindocumento',
    ],
  },
  {
    nombre: 'Taller',
    tablas: [
      'clientes',
      'vehiculos',
      'empleados',
      'cat_sistemas_vehiculo',
      'vehiculo_partes',
      'estado_partes',
      'recordatorios_mantenimiento',
      'ordenes_trabajo',
      'orden_reparaciones',
    ],
  },
];

/** El código las usa, pero MySQL no tiene la llave foránea creada. */
const REFS_LOGICAS = [
  ['productos', 'idcategoria_nuevo', 'categorias_nuevo', 'idcategoria'],
  ['productos', 'id_grupo', 'grupos', 'id_grupo'],
  ['productos', 'id_subgrupo', 'subgrupos', 'id_subgrupo'],
];

function tipoDbml(col) {
  const t = String(col.DATA_TYPE).toLowerCase();
  const mapa = {
    int: 'int',
    bigint: 'bigint',
    tinyint: 'tinyint',
    smallint: 'smallint',
    mediumint: 'int',
    decimal: 'decimal',
    float: 'float',
    double: 'double',
    varchar: 'varchar',
    char: 'char',
    text: 'text',
    mediumtext: 'text',
    longtext: 'text',
    tinytext: 'text',
    date: 'date',
    datetime: 'datetime',
    timestamp: 'timestamp',
    time: 'time',
    json: 'json',
    enum: 'varchar',
    blob: 'blob',
    mediumblob: 'blob',
    longblob: 'blob',
  };
  let base = mapa[t] || 'varchar';
  if ((t === 'varchar' || t === 'char' || t === 'decimal') && col.CHARACTER_MAXIMUM_LENGTH) {
    base += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
  }
  if (t === 'decimal' && col.NUMERIC_PRECISION) {
    base = `decimal(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE || 0})`;
  }
  return base;
}

function nota(col) {
  const partes = [];
  if (col.COLUMN_COMMENT) partes.push(String(col.COLUMN_COMMENT).replace(/'/g, "\\'"));
  if (col.COLUMN_TYPE && String(col.COLUMN_TYPE).startsWith('enum')) {
    partes.push(String(col.COLUMN_TYPE).replace(/'/g, ''));
  }
  return partes.length ? `note: '${partes.join(' · ')}'` : '';
}

(async () => {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taller_web',
  });

  const [tablas] = await c.query(
    `SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = 'taller_web'
     ORDER BY TABLE_NAME`
  );
  const [columnas] = await c.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
            COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = 'taller_web'
     ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );
  const conteos = new Map();
  for (const t of tablas.filter((x) => x.TABLE_TYPE === 'BASE TABLE' && !EXCLUIR.has(x.TABLE_NAME))) {
    const [rows] = await c.query(`SELECT COUNT(*) AS n FROM \`${t.TABLE_NAME}\``);
    conteos.set(t.TABLE_NAME, Number(rows[0].n));
  }

  const [fks] = await c.query(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE k
     WHERE k.TABLE_SCHEMA = 'taller_web' AND k.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY k.TABLE_NAME, k.ORDINAL_POSITION`
  );

  await c.end();

  const bases = tablas.filter((t) => t.TABLE_TYPE === 'BASE TABLE' && !EXCLUIR.has(t.TABLE_NAME));
  const vistas = tablas.filter((t) => t.TABLE_TYPE === 'VIEW');
  const porTabla = new Map();
  for (const col of columnas) {
    if (!porTabla.has(col.TABLE_NAME)) porTabla.set(col.TABLE_NAME, []);
    porTabla.get(col.TABLE_NAME).push(col);
  }

  const asignadas = new Set(GRUPOS.flatMap((g) => g.tablas));
  const sueltas = bases.map((t) => t.TABLE_NAME).filter((n) => !asignadas.has(n));

  const lineas = [];
  lineas.push('// Taller Web — esquema de taller_web');
  lineas.push('// Generado desde MySQL para pegar en https://dbdiagram.io (Import > DBML)');
  lineas.push(`// Fecha: ${new Date().toISOString().slice(0, 10)}`);
  lineas.push('// No incluye proveedores_legacy_backup (respaldo de migración).');
  lineas.push('');
  lineas.push('Project taller_web {');
  lineas.push("  database_type: 'MySQL'");
  lineas.push("  Note: 'Inventario de taller, El Salvador. IVA 13%.'");
  lineas.push('}');
  lineas.push('');

  const emitirTabla = (nombre) => {
    const meta = bases.find((t) => t.TABLE_NAME === nombre);
    if (!meta) return;
    const cols = porTabla.get(nombre) || [];
    const filas = conteos.get(nombre);
    const comentario = [meta.TABLE_COMMENT, filas === 0 ? 'sin registros' : `${filas} registros`]
      .filter(Boolean)
      .join(' · ');
    if (comentario) lineas.push(`// ${comentario}`);
    lineas.push(`Table ${nombre} {`);
    for (const col of cols) {
      const attrs = [];
      if (col.COLUMN_KEY === 'PRI') attrs.push('pk');
      if (col.COLUMN_KEY === 'UNI') attrs.push('unique');
      if (col.IS_NULLABLE === 'NO' && col.COLUMN_KEY !== 'PRI') attrs.push('not null');
      if (String(col.EXTRA || '').includes('auto_increment')) attrs.push('increment');
      const n = nota(col);
      if (n) attrs.push(n);
      const attr = attrs.length ? ` [${attrs.join(', ')}]` : '';
      lineas.push(`  ${col.COLUMN_NAME} ${tipoDbml(col)}${attr}`);
    }
    lineas.push('}');
    lineas.push('');
  };

  for (const grupo of GRUPOS) {
    const presentes = grupo.tablas.filter((n) => bases.some((t) => t.TABLE_NAME === n));
    if (!presentes.length) continue;
    lineas.push(`TableGroup ${grupo.nombre.replace(/ /g, '_')} {`);
    for (const n of presentes) lineas.push(`  ${n}`);
    lineas.push('}');
    lineas.push('');
  }
  if (sueltas.length) {
    lineas.push('TableGroup Otras {');
    for (const n of sueltas) lineas.push(`  ${n}`);
    lineas.push('}');
    lineas.push('');
  }

  for (const grupo of GRUPOS) {
    lineas.push(`// --- ${grupo.nombre} ---`);
    for (const n of grupo.tablas) emitirTabla(n);
  }
  if (sueltas.length) {
    lineas.push('// --- Otras (no agrupadas) ---');
    for (const n of sueltas) emitirTabla(n);
  }

  lineas.push('// Relaciones que MySQL sí obliga');
  const vistasFk = [];
  for (const fk of fks) {
    if (EXCLUIR.has(fk.TABLE_NAME) || EXCLUIR.has(fk.REFERENCED_TABLE_NAME)) continue;
    const esVista = vistas.some((v) => v.TABLE_NAME === fk.TABLE_NAME);
    const ref = `Ref: ${fk.TABLE_NAME}.${fk.COLUMN_NAME} > ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`;
    if (esVista) vistasFk.push(`// ${ref}`);
    else lineas.push(ref);
  }
  lineas.push('');
  lineas.push('// Relaciones que usa la app, sin llave foránea en MySQL');
  for (const [tabla, col, refTabla, refCol] of REFS_LOGICAS) {
    lineas.push(`Ref: ${tabla}.${col} > ${refTabla}.${refCol}`);
  }
  lineas.push('');
  if (vistas.length) {
    lineas.push('// Vistas (no se dibujan como tablas; son consultas sobre las de arriba)');
    for (const v of vistas) lineas.push(`// VIEW ${v.TABLE_NAME}`);
  }

  const salida = path.join(__dirname, '..', 'docs', 'taller_web.dbml');
  fs.writeFileSync(salida, lineas.join('\n'), 'utf8');

  console.log('Tablas:', bases.length);
  console.log('Vistas:', vistas.map((v) => v.TABLE_NAME).join(', ') || '(ninguna)');
  console.log('Sin agrupar:', sueltas.join(', ') || '(ninguna)');
  console.log('Conteos:');
  for (const [n, cant] of conteos) console.log(`  ${n}: ${cant}`);
  console.log('FKs:', fks.length);
  console.log('Escrito:', salida);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
