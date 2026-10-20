// Script para verificar la estructura de la base de datos
// Ejecutar con: node scripts/verificar-estructura-db.js

const mysql = require('mysql2/promise');

async function verificarEstructura() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taller_web',
    port: 3306
  });

  console.log('='.repeat(60));
  console.log('VERIFICACIÓN DE ESTRUCTURA DE BASE DE DATOS');
  console.log('='.repeat(60));

  try {
    // 1. Verificar si existe la tabla categorias
    console.log('\n📁 TABLA CATEGORIAS:');
    const [categorias] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'taller_web' AND TABLE_NAME = 'categorias'
    `);
    
    if (categorias.length > 0) {
      console.log('   ✅ Existe');
      categorias.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? '[' + col.COLUMN_KEY + ']' : ''}`);
      });
      
      // Mostrar datos de categorías
      const [catData] = await connection.execute('SELECT * FROM categorias LIMIT 10');
      console.log('\n   Datos actuales:');
      catData.forEach(cat => {
        console.log(`   - ID: ${cat.idcategoria}, Nombre: ${cat.nombre}`);
      });
    } else {
      console.log('   ❌ No existe');
    }

    // 2. Verificar si existe la tabla grupos
    console.log('\n📁 TABLA GRUPOS:');
    const [grupos] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'taller_web' AND TABLE_NAME = 'grupos'
    `);
    
    if (grupos.length > 0) {
      console.log('   ✅ Existe');
      grupos.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? '[' + col.COLUMN_KEY + ']' : ''}`);
      });
      
      const [gruposData] = await connection.execute('SELECT * FROM grupos LIMIT 5');
      if (gruposData.length > 0) {
        console.log('\n   Datos actuales:');
        gruposData.forEach(g => console.log(`   - ${JSON.stringify(g)}`));
      } else {
        console.log('\n   Sin datos');
      }
    } else {
      console.log('   ❌ No existe');
    }

    // 3. Verificar si existe la tabla subgrupos
    console.log('\n📁 TABLA SUBGRUPOS:');
    const [subgrupos] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'taller_web' AND TABLE_NAME = 'subgrupos'
    `);
    
    if (subgrupos.length > 0) {
      console.log('   ✅ Existe');
      subgrupos.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? '[' + col.COLUMN_KEY + ']' : ''}`);
      });
      
      const [subgruposData] = await connection.execute('SELECT * FROM subgrupos LIMIT 5');
      if (subgruposData.length > 0) {
        console.log('\n   Datos actuales:');
        subgruposData.forEach(s => console.log(`   - ${JSON.stringify(s)}`));
      } else {
        console.log('\n   Sin datos');
      }
    } else {
      console.log('   ❌ No existe');
    }

    // 4. Verificar campos en tabla productos
    console.log('\n📁 TABLA PRODUCTOS (campos de categorización):');
    const [prodCols] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'taller_web' 
        AND TABLE_NAME = 'productos'
        AND COLUMN_NAME IN ('idcategoria', 'idgrupo', 'idsubgrupo', 'id_grupo', 'id_subgrupo', 'codigo_jerarquico')
    `);
    
    if (prodCols.length > 0) {
      prodCols.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? '[' + col.COLUMN_KEY + ']' : ''}`);
      });
    } else {
      console.log('   Solo tiene idcategoria básico');
    }

    // 5. Listar todas las tablas
    console.log('\n📋 TODAS LAS TABLAS EN LA BASE DE DATOS:');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'taller_web'
      ORDER BY TABLE_NAME
    `);
    tables.forEach(t => console.log(`   - ${t.TABLE_NAME}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
    console.log('\n' + '='.repeat(60));
  }
}

verificarEstructura();
