import { connectDB } from '../lib/db';

async function initPrecios() {
  try {
    console.log('🔄 Inicializando precios para productos existentes...');
    
    const connection = await connectDB();
    
    // Obtener todos los productos que no tienen precios
    const [productos]: any = await connection.execute(`
      SELECT p.idprod 
      FROM productos p
      LEFT JOIN precios pr ON p.idprod = pr.idprod
      WHERE pr.idprod IS NULL
    `);
    
    console.log(`📦 Encontrados ${productos.length} productos sin precios`);
    
    if (productos.length === 0) {
      console.log('✅ Todos los productos ya tienen precios inicializados');
      await connection.end();
      return;
    }
    
    // Insertar precios en 0 para cada producto
    for (const producto of productos) {
      await connection.execute(`
        INSERT INTO precios (
          idprod, 
          precio_general, 
          precio_mayorista, 
          precio_cliente, 
          precio_mecanico, 
          precio_minorista, 
          precio_especial
        ) VALUES (?, 0, 0, 0, 0, 0, 0)
      `, [producto.idprod]);
      
      console.log(`  ✓ Precios inicializados para producto ID: ${producto.idprod}`);
    }
    
    await connection.end();
    
    console.log('✅ Inicialización completada!');
    console.log(`📊 Total de productos inicializados: ${productos.length}`);
    
  } catch (error: any) {
    console.error('❌ Error al inicializar precios:', error.message);
    console.error(error);
    process.exit(1);
  }
}

initPrecios();
