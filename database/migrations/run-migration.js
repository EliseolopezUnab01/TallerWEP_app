const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taller_web',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida\n');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'update_database_complete.sql');
    console.log('📄 Leyendo archivo de migración...');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ Archivo leído correctamente\n');

    // Ejecutar la migración
    console.log('🚀 Ejecutando migración...');
    console.log('⏳ Esto puede tomar unos momentos...\n');
    
    const [results] = await connection.query(sql);
    
    console.log('✅ Migración completada exitosamente!\n');
    
    // Mostrar resumen
    console.log('📊 RESUMEN DE LA MIGRACIÓN:');
    console.log('═══════════════════════════════════════');
    console.log('✓ Tabla productos actualizada');
    console.log('✓ Tabla referencias_oem creada');
    console.log('✓ Tabla ubicaciones_producto creada');
    console.log('✓ Tabla clientes creada');
    console.log('✓ Tabla vehiculos creada');
    console.log('✓ Tabla ordenes_trabajo creada');
    console.log('✓ Tabla orden_motor creada');
    console.log('✓ Tabla orden_filtros_lubes creada');
    console.log('✓ Tabla orden_traccion creada');
    console.log('✓ Tabla orden_chasis_electrico creada');
    console.log('✓ Tabla orden_frenos_clutch creada');
    console.log('✓ Tabla orden_reparaciones creada');
    console.log('✓ Tabla empleados creada');
    console.log('✓ Tabla proveedores creada');
    console.log('═══════════════════════════════════════\n');

    // Verificar las tablas
    console.log('🔍 Verificando tablas creadas...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ Total de tablas en la base de datos: ${tables.length}\n`);

    // Verificar campos agregados a productos
    console.log('🔍 Verificando campos en tabla productos...');
    const [columns] = await connection.query('DESCRIBE productos');
    console.log(`✅ Total de campos en productos: ${columns.length}\n`);

    console.log('🎉 ¡Migración completada con éxito!');
    console.log('💡 Puedes comenzar a usar las nuevas funcionalidades del sistema.');
    
  } catch (error) {
    console.error('❌ Error durante la migración:');
    console.error(error.message);
    console.error('\n💡 Sugerencias:');
    console.error('1. Verifica que la base de datos existe');
    console.error('2. Verifica las credenciales de conexión');
    console.error('3. Asegúrate de tener permisos suficientes');
    console.error('4. Revisa el archivo .env para las variables de entorno');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
console.log('╔════════════════════════════════════════╗');
console.log('║  MIGRACIÓN DE BASE DE DATOS           ║');
console.log('║  Sistema Taller Web                   ║');
console.log('╚════════════════════════════════════════╝\n');

runMigration();
