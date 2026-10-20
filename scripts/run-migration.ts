import { connectDB } from '../lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración 004_create_precios_tables.sql...');
    
    const connection = await connectDB();
    
    // Leer el archivo SQL
    const sqlFile = join(process.cwd(), 'migrations', '004_create_precios_tables.sql');
    const sql = readFileSync(sqlFile, 'utf-8');
    
    // Dividir por punto y coma para ejecutar cada statement por separado
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Ejecutando ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`  ${i + 1}/${statements.length} Ejecutando...`);
        await connection.execute(statement);
      }
    }
    
    await connection.end();
    
    console.log('✅ Migración completada exitosamente!');
    console.log('📊 Tablas creadas:');
    console.log('   - precios (7 tipos de precios por producto)');
    console.log('   - ajuste_precios (historial de cambios)');
    
  } catch (error: any) {
    console.error('❌ Error al ejecutar migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
