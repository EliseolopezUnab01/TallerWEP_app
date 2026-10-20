# Migración de Base de Datos - Sistema Taller Web

## 📋 Descripción

Este archivo contiene la migración completa para actualizar la base de datos del Sistema Taller Web según las especificaciones del cliente.

## 🗂️ Tablas Creadas/Actualizadas

### Actualizaciones a Tablas Existentes:
1. **productos** - Se agregan 20+ campos nuevos para precios, costos, aplicaciones, etc.

### Nuevas Tablas Creadas:
1. **referencias_oem** - Referencias cruzadas OEM y equivalencias
2. **ubicaciones_producto** - Ubicaciones físicas en almacén
3. **clientes** - Información de clientes
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

## 🚀 Cómo Ejecutar la Migración

### Opción 1: Desde MySQL Workbench o phpMyAdmin
1. Abre el archivo `update_database_complete.sql`
2. Copia todo el contenido
3. Pégalo en la consola SQL
4. Ejecuta el script

### Opción 2: Desde línea de comandos
```bash
mysql -u root -p tallerweb < update_database_complete.sql
```

### Opción 3: Desde el proyecto Next.js
Ejecuta el script de migración:
```bash
npm run migrate
```

## ⚠️ IMPORTANTE - Antes de Ejecutar

1. **HACER BACKUP** de la base de datos actual:
   ```bash
   mysqldump -u root -p tallerweb > backup_antes_migracion.sql
   ```

2. **Verificar conexión** a la base de datos

3. **Revisar** que no haya conflictos con datos existentes

## 📊 Campos Agregados a `productos`

### Precios (9 tipos diferentes):
- precio_manual
- precio_pvr
- precio_lcl
- precio_general
- precio_cliente
- precio_mecanico
- precio_minorista
- precio_mayorista
- precio_especial

### Información del Producto:
- serie
- tipo
- grupo
- subgrupo
- aplicacion_marcas
- aplicacion_modelos
- criterios

### Costos y Márgenes:
- costo
- aplica_imp (IVA)
- utilidad
- descuento
- descuento_maximo
- dias_entrega

## 🔗 Relaciones Principales

```
clientes (1) -----> (N) vehiculos
clientes (1) -----> (N) ordenes_trabajo
vehiculos (1) -----> (N) ordenes_trabajo
ordenes_trabajo (1) -----> (1) orden_motor
ordenes_trabajo (1) -----> (1) orden_filtros_lubes
ordenes_trabajo (1) -----> (1) orden_traccion
ordenes_trabajo (1) -----> (1) orden_chasis_electrico
ordenes_trabajo (1) -----> (1) orden_frenos_clutch
ordenes_trabajo (1) -----> (N) orden_reparaciones
productos (1) -----> (N) referencias_oem
productos (1) -----> (N) ubicaciones_producto
```

## 📝 Notas

- Todos los campos nuevos tienen valores por defecto
- Se usan `IF NOT EXISTS` para evitar errores si ya existen
- Las claves foráneas tienen `ON DELETE CASCADE` donde corresponde
- Se incluyen índices para optimizar consultas
- Los campos JSON permiten almacenar arrays complejos

## 🐛 Solución de Problemas

Si encuentras errores:

1. **Error de sintaxis**: Verifica la versión de MySQL (debe ser 5.7+)
2. **Tabla no existe**: Asegúrate de que la tabla `productos` existe
3. **Clave foránea falla**: Verifica que las tablas referenciadas existan
4. **Columna duplicada**: Algunos campos ya pueden existir, el script los omitirá

## ✅ Verificación Post-Migración

Ejecuta estas consultas para verificar:

```sql
-- Ver campos agregados a productos
DESCRIBE productos;

-- Ver nuevas tablas
SHOW TABLES;

-- Contar registros en nuevas tablas
SELECT COUNT(*) FROM referencias_oem;
SELECT COUNT(*) FROM ubicaciones_producto;
SELECT COUNT(*) FROM clientes;
SELECT COUNT(*) FROM vehiculos;
SELECT COUNT(*) FROM ordenes_trabajo;
```

## 📞 Soporte

Si necesitas ayuda con la migración, contacta al equipo de desarrollo.
