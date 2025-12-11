# 🚀 INSTRUCCIONES PARA ACTUALIZAR LA BASE DE DATOS

## ⚠️ IMPORTANTE - LEE ESTO PRIMERO

Antes de ejecutar la migración, **DEBES HACER UN BACKUP** de tu base de datos actual:

```bash
# Desde la línea de comandos
mysqldump -u root -p tallerweb > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📋 ¿Qué hace esta migración?

Esta migración actualiza completamente la base de datos para incluir todas las funcionalidades del sistema de escritorio:

### ✅ Actualiza la tabla `productos` con:
- 9 tipos de precios diferentes (Manual, PVR, LCL, General, Cliente, Mecánico, Minorista, Mayorista, Especial)
- Información de costos y márgenes (costo, IVA, utilidad, descuentos)
- Campos adicionales (serie, tipo, grupo, subgrupo, aplicaciones, criterios)
- Días de entrega

### ✅ Crea 13 nuevas tablas:
1. **referencias_oem** - Referencias cruzadas OEM y equivalencias
2. **ubicaciones_producto** - Ubicaciones físicas en almacén
3. **clientes** - Gestión de clientes
4. **vehiculos** - Vehículos de los clientes
5. **ordenes_trabajo** - Órdenes de trabajo del taller
6. **orden_motor** - Detalles técnicos del motor
7. **orden_filtros_lubes** - Filtros y lubricantes
8. **orden_traccion** - Sistema de tracción
9. **orden_chasis_electrico** - Chasis y sistema eléctrico
10. **orden_frenos_clutch** - Frenos, clutch y dirección
11. **orden_reparaciones** - Detalle de reparaciones
12. **empleados** - Empleados del taller
13. **proveedores** - Proveedores de repuestos

## 🎯 Método Recomendado - Ejecutar desde Node.js

### Paso 1: Asegúrate de tener las variables de entorno configuradas

Verifica tu archivo `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=tallerweb
```

### Paso 2: Ejecuta el comando de migración

```bash
npm run migrate
```

Verás una salida como esta:

```
╔════════════════════════════════════════╗
║  MIGRACIÓN DE BASE DE DATOS           ║
║  Sistema Taller Web                   ║
╚════════════════════════════════════════╝

🔄 Conectando a la base de datos...
✅ Conexión establecida

📄 Leyendo archivo de migración...
✅ Archivo leído correctamente

🚀 Ejecutando migración...
⏳ Esto puede tomar unos momentos...

✅ Migración completada exitosamente!

📊 RESUMEN DE LA MIGRACIÓN:
═══════════════════════════════════════
✓ Tabla productos actualizada
✓ Tabla referencias_oem creada
✓ Tabla ubicaciones_producto creada
... (y todas las demás tablas)
═══════════════════════════════════════

🎉 ¡Migración completada con éxito!
```

## 🔧 Método Alternativo - Ejecutar desde MySQL

Si prefieres ejecutar manualmente:

### Opción A: MySQL Workbench
1. Abre MySQL Workbench
2. Conecta a tu base de datos
3. Abre el archivo `update_database_complete.sql`
4. Ejecuta el script (⚡ botón de rayo)

### Opción B: Línea de comandos
```bash
mysql -u root -p tallerweb < database/migrations/update_database_complete.sql
```

### Opción C: phpMyAdmin
1. Accede a phpMyAdmin
2. Selecciona la base de datos `tallerweb`
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido de `update_database_complete.sql`
5. Haz clic en "Continuar"

## ✅ Verificación Post-Migración

Después de ejecutar la migración, verifica que todo esté correcto:

```sql
-- Ver todas las tablas
SHOW TABLES;

-- Ver campos de productos
DESCRIBE productos;

-- Ver campos de una orden de trabajo
DESCRIBE ordenes_trabajo;

-- Verificar que no haya errores
SHOW WARNINGS;
```

## 🐛 Solución de Problemas

### Error: "Table 'productos' doesn't exist"
**Solución**: Asegúrate de que la base de datos `tallerweb` existe y tiene la tabla `productos`.

### Error: "Access denied"
**Solución**: Verifica las credenciales en el archivo `.env`.

### Error: "Column already exists"
**Solución**: No te preocupes, el script usa `IF NOT EXISTS` y omitirá las columnas que ya existen.

### Error: "Foreign key constraint fails"
**Solución**: Asegúrate de que las tablas referenciadas existen antes de crear las relaciones.

## 📊 Estructura de Datos Después de la Migración

```
tallerweb/
├── productos (actualizada con 20+ campos nuevos)
├── categorias (existente)
├── imagenes_productos (existente)
├── usuarios (existente)
├── referencias_oem (nueva)
├── ubicaciones_producto (nueva)
├── clientes (nueva)
├── vehiculos (nueva)
├── ordenes_trabajo (nueva)
├── orden_motor (nueva)
├── orden_filtros_lubes (nueva)
├── orden_traccion (nueva)
├── orden_chasis_electrico (nueva)
├── orden_frenos_clutch (nueva)
├── orden_reparaciones (nueva)
├── empleados (nueva)
└── proveedores (nueva)
```

## 🎨 Próximos Pasos

Después de ejecutar la migración exitosamente:

1. ✅ Reinicia el servidor de desarrollo: `npm run dev`
2. ✅ Verifica que el Perfil de Producto muestra los nuevos campos
3. ✅ Prueba crear una orden de trabajo
4. ✅ Agrega algunos clientes y vehículos de prueba
5. ✅ Configura las referencias OEM para tus productos

## 📞 ¿Necesitas Ayuda?

Si encuentras algún problema durante la migración:

1. Revisa los logs de error
2. Verifica las credenciales de la base de datos
3. Asegúrate de tener permisos suficientes
4. Contacta al equipo de desarrollo

## 🎉 ¡Listo!

Una vez completada la migración, tu sistema estará actualizado con todas las funcionalidades del sistema de escritorio. ¡Disfruta de las nuevas características!
