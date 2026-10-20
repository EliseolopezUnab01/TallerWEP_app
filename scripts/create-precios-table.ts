import { connectDB } from '../lib/db';

async function createPreciosTable() {
  try {
    console.log('🔄 Creando tabla precios...');
    
    const connection = await connectDB();
    
    // Crear tabla precios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS precios (
        idprod INT PRIMARY KEY,
        precio_manual DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio manual si el usuario lo establece',
        precio_pvr DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio PVR (Precio de Venta Recomendado)',
        precio_lcl DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Precio LCL',
        precio_general DECIMAL(10,2) DEFAULT 0.00 COMMENT 'GENERAL, ALTO. Precio más alto',
        precio_cliente DECIMAL(10,2) DEFAULT 0.00 COMMENT 'CLIENTE. Persona que ya ha rentado algo y nos prefiere',
        precio_mecanico DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MECÁNICO o MINORISTA. Quien compra muy poco',
        precio_minorista DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MAYORISTA. Quien compra por montos considerables',
        precio_mayorista DECIMAL(10,2) DEFAULT 0.00 COMMENT 'MAYORISTA (con contrato). Muy conocida',
        precio_especial DECIMAL(10,2) DEFAULT 0.00 COMMENT 'ESPECIAL. Precio mínimo de venta',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabla precios creada');
    
    // Crear tabla ajuste_precios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ajuste_precios (
        idajuste INT AUTO_INCREMENT PRIMARY KEY,
        idusuario INT COMMENT 'Identificador del usuario que cambia o ajusta un precio',
        idprod INT COMMENT 'Identificador del producto que recibe el cambio',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha del ajuste',
        razon_justificacion TEXT COMMENT 'Razón o justificación del porqué cambió el precio',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idprod) REFERENCES productos(idprod) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabla ajuste_precios creada');
    
    await connection.end();
    
    console.log('✅ Tablas creadas exitosamente!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createPreciosTable();
