// Script para ejecutar la migración del sistema de categorías jerárquico
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function ejecutarMigracion() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taller_web',
    port: 3306,
    multipleStatements: true
  });

  console.log('='.repeat(60));
  console.log('EJECUTANDO MIGRACIÓN: Sistema de Categorías Jerárquico');
  console.log('='.repeat(60));

  try {
    // Paso 1: Crear tabla categorias_nuevo
    console.log('\n📦 Paso 1: Creando tabla categorias_nuevo...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categorias_nuevo (
        idcategoria INT PRIMARY KEY,
        codigo_antiguo VARCHAR(10) DEFAULT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cat_nombre (nombre),
        INDEX idx_cat_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Tabla categorias_nuevo creada');

    // Paso 2: Insertar categorías
    console.log('\n📦 Paso 2: Insertando categorías...');
    const categorias = [
      [10, 'Motor', 'Motor y componentes'],
      [11, 'Transm. Man.', 'Transmisión Manual'],
      [12, 'Transm. Auto.', 'Transmisión Automática'],
      [13, 'Frenos', 'Sistema de frenos'],
      [14, 'Embrague', 'Sistema de embrague'],
      [15, 'Diferencial', 'Diferencial'],
      [16, 'Caja Transfer', 'Caja de transferencia'],
      [17, 'Eje Delantero', 'Eje delantero'],
      [18, 'Eje Trasero', 'Eje trasero'],
      [19, 'Dirección', 'Sistema de dirección'],
      [20, 'Suspensión', 'Sistema de suspensión'],
      [21, 'Carrocería', 'Carrocería'],
      [22, 'Chasis', 'Chasis'],
      [23, 'Sist. Hidráulico', 'Sistema hidráulico'],
      [24, 'Sist. Eléctrico', 'Sistema eléctrico'],
      [25, 'Sist. Carga', 'Sistema de carga'],
      [26, 'Lubricantes', 'Lubricantes y aceites'],
      [27, 'Filtros', 'Filtros'],
      [99, 'Otro', 'Otros productos']
    ];

    for (const [id, nombre, desc] of categorias) {
      await connection.execute(
        'INSERT INTO categorias_nuevo (idcategoria, nombre, descripcion) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)',
        [id, nombre, desc]
      );
    }
    console.log(`   ✅ ${categorias.length} categorías insertadas`);

    // Paso 3: Crear tabla grupos
    console.log('\n📦 Paso 3: Creando tabla grupos...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS grupos (
        id_grupo INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(3) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        idcategoria INT NOT NULL,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (idcategoria) REFERENCES categorias_nuevo(idcategoria) ON DELETE CASCADE,
        UNIQUE KEY uk_grupo_codigo_cat (codigo, idcategoria),
        INDEX idx_grupo_categoria (idcategoria),
        INDEX idx_grupo_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Tabla grupos creada');

    // Paso 4: Crear tabla subgrupos
    console.log('\n📦 Paso 4: Creando tabla subgrupos...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS subgrupos (
        id_subgrupo INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(3) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        id_grupo INT NOT NULL,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo) ON DELETE CASCADE,
        UNIQUE KEY uk_subgrupo_codigo_grupo (codigo, id_grupo),
        INDEX idx_subgrupo_grupo (id_grupo),
        INDEX idx_subgrupo_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Tabla subgrupos creada');

    // Paso 5: Modificar tabla productos
    console.log('\n📦 Paso 5: Modificando tabla productos...');
    
    // Verificar si las columnas ya existen
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'taller_web' AND TABLE_NAME = 'productos'
    `);
    const existingCols = columns.map(c => c.COLUMN_NAME);

    if (!existingCols.includes('idcategoria_nuevo')) {
      await connection.execute('ALTER TABLE productos ADD COLUMN idcategoria_nuevo INT DEFAULT NULL');
      console.log('   ✅ Columna idcategoria_nuevo agregada');
    }
    if (!existingCols.includes('id_grupo')) {
      await connection.execute('ALTER TABLE productos ADD COLUMN id_grupo INT DEFAULT NULL');
      console.log('   ✅ Columna id_grupo agregada');
    }
    if (!existingCols.includes('id_subgrupo')) {
      await connection.execute('ALTER TABLE productos ADD COLUMN id_subgrupo INT DEFAULT NULL');
      console.log('   ✅ Columna id_subgrupo agregada');
    }
    if (!existingCols.includes('codigo_jerarquico')) {
      await connection.execute('ALTER TABLE productos ADD COLUMN codigo_jerarquico VARCHAR(15) DEFAULT NULL');
      console.log('   ✅ Columna codigo_jerarquico agregada');
    }

    // Paso 6: Insertar grupos de ejemplo
    console.log('\n📦 Paso 6: Insertando grupos de ejemplo...');
    
    // Grupos para Motor (10)
    const gruposMotor = [
      ['000', 'Ensamblado', 10],
      ['001', 'Bomba de Inyección', 10],
      ['002', 'Inyectores', 10],
      ['003', 'Bomba Agua', 10],
      ['004', 'Bomba Aceite', 10],
      ['005', 'TurboCargador', 10],
      ['006', 'Culata de Motor', 10],
      ['007', 'Bloque Inferior', 10],
      ['008', 'Lubricación', 10],
      ['009', 'Filtros', 10],
      ['010', 'Radiador', 10],
      ['011', 'Enfriamiento', 10],
      ['012', 'Ventilador', 10],
      ['013', 'Correas', 10],
      ['014', 'Tuberías', 10],
      ['015', 'Compresor', 10],
      ['016', 'Arrancador', 10],
      ['017', 'Motor de Arranque', 10]
    ];

    // Grupos para Transmisión Manual (11)
    const gruposTransm = [
      ['000', 'Ensamblado', 11],
      ['001', 'Tren Fijo', 11],
      ['002', 'Tren Desplazable', 11],
      ['003', 'Mandos', 11]
    ];

    const todosGrupos = [...gruposMotor, ...gruposTransm];
    for (const [codigo, nombre, idcat] of todosGrupos) {
      await connection.execute(
        'INSERT INTO grupos (codigo, nombre, idcategoria) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)',
        [codigo, nombre, idcat]
      );
    }
    console.log(`   ✅ ${todosGrupos.length} grupos insertados`);

    // Paso 7: Insertar subgrupos de ejemplo
    console.log('\n📦 Paso 7: Insertando subgrupos de ejemplo...');
    
    // Obtener IDs de grupos
    const [gruposDB] = await connection.execute('SELECT id_grupo, codigo, idcategoria FROM grupos');
    
    const subgruposData = [
      // Motor > Ensamblado
      { codigo: '000', nombre: 'Ensamblado', grupoCodigo: '000', catId: 10 },
      // Motor > Bomba de Inyección
      { codigo: '001', nombre: 'Sellos', grupoCodigo: '001', catId: 10 },
      { codigo: '002', nombre: 'Juntas', grupoCodigo: '001', catId: 10 },
      // Transm. Manual > Ensamblado
      { codigo: '000', nombre: 'Ensamblado', grupoCodigo: '000', catId: 11 },
      // Transm. Manual > Tren Fijo
      { codigo: '000', nombre: 'Ensamblado', grupoCodigo: '001', catId: 11 },
      { codigo: '001', nombre: 'Engranajes', grupoCodigo: '001', catId: 11 },
      // Transm. Manual > Tren Desplazable
      { codigo: '002', nombre: 'Sincronizadores', grupoCodigo: '002', catId: 11 },
      // Transm. Manual > Mandos
      { codigo: '003', nombre: 'Sellos y Juntas', grupoCodigo: '003', catId: 11 }
    ];

    let subgruposInsertados = 0;
    for (const sg of subgruposData) {
      const grupo = gruposDB.find(g => g.codigo === sg.grupoCodigo && g.idcategoria === sg.catId);
      if (grupo) {
        await connection.execute(
          'INSERT INTO subgrupos (codigo, nombre, id_grupo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)',
          [sg.codigo, sg.nombre, grupo.id_grupo]
        );
        subgruposInsertados++;
      }
    }
    console.log(`   ✅ ${subgruposInsertados} subgrupos insertados`);

    // Paso 8: Crear vista
    console.log('\n📦 Paso 8: Creando vista v_categorias_jerarquia...');
    await connection.execute(`
      CREATE OR REPLACE VIEW v_categorias_jerarquia AS
      SELECT 
        c.idcategoria,
        c.nombre as categoria_nombre,
        g.id_grupo,
        g.codigo as grupo_codigo,
        g.nombre as grupo_nombre,
        s.id_subgrupo,
        s.codigo as subgrupo_codigo,
        s.nombre as subgrupo_nombre,
        CONCAT(
          LPAD(c.idcategoria, 2, '0'),
          COALESCE(LPAD(g.codigo, 3, '0'), '000'),
          COALESCE(LPAD(s.codigo, 3, '0'), '000')
        ) as codigo_base
      FROM categorias_nuevo c
      LEFT JOIN grupos g ON c.idcategoria = g.idcategoria
      LEFT JOIN subgrupos s ON g.id_grupo = s.id_grupo
      WHERE c.activo = 1
      ORDER BY c.idcategoria, g.codigo, s.codigo
    `);
    console.log('   ✅ Vista creada');

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));

    // Mostrar resumen
    const [catCount] = await connection.execute('SELECT COUNT(*) as total FROM categorias_nuevo');
    const [grupoCount] = await connection.execute('SELECT COUNT(*) as total FROM grupos');
    const [subgrupoCount] = await connection.execute('SELECT COUNT(*) as total FROM subgrupos');
    
    console.log('\n📊 RESUMEN:');
    console.log(`   - Categorías: ${catCount[0].total}`);
    console.log(`   - Grupos: ${grupoCount[0].total}`);
    console.log(`   - Subgrupos: ${subgrupoCount[0].total}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) console.error('   Código:', error.code);
  } finally {
    await connection.end();
  }
}

ejecutarMigracion();
