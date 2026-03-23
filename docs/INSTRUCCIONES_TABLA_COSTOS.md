# Instrucciones para Implementar la Tabla COSTOS

## Resumen

Se ha creado una nueva tabla `costos` separada de la tabla `productos` para mayor seguridad y organización de los datos de costos.

## Archivos Creados

1. **`sql/crear_tabla_costos.sql`** - Script SQL para crear la tabla y migrar datos
2. **`app/api/costos/route.ts`** - API REST para manejar costos

---

## Paso 1: Crear la Tabla en phpMyAdmin

1. Abrir phpMyAdmin: `http://localhost/phpmyadmin`
2. Seleccionar la base de datos del sistema
3. Ir a la pestaña **SQL**
4. Copiar y ejecutar el contenido de `sql/crear_tabla_costos.sql`

### Estructura de la Tabla COSTOS:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| idcosto | INT | ID único del registro |
| idprod | INT | FK a productos (relación 1:1) |
| nofactura | VARCHAR(50) | Número de factura de la compra |
| dt_compra | DATE | Fecha de la última compra |
| costo | DECIMAL(12,2) | Costo de la última compra |
| costo_proveedor | DECIMAL(12,2) | Costo pagado al proveedor |
| costo_promedio | DECIMAL(12,2) | Promedio de todas las compras |
| costo_local | DECIMAL(12,2) | Costo en moneda local |
| iva_pagado | DECIMAL(12,2) | IVA pagado |
| costo_previo1 | DECIMAL(12,2) | Respaldo 1 del costo_local |
| costo_previo2 | DECIMAL(12,2) | Respaldo 2 del costo_local |
| costop_previo1 | DECIMAL(12,2) | Respaldo 1 del costo_promedio |
| costop_previo2 | DECIMAL(12,2) | Respaldo 2 del costo_promedio |

---

## Paso 2: Migrar Datos Existentes

El script SQL incluye una migración automática que copia los costos actuales de la tabla `productos` a la nueva tabla `costos`.

```sql
INSERT INTO costos (idprod, costo, costo_local, iva_pagado, costo_promedio)
SELECT 
    idprod,
    COALESCE(costo, 0),
    COALESCE(costo_local, costo, 0),
    COALESCE(iva_pagado, 0),
    COALESCE(costo_local, costo, 0)
FROM productos
WHERE idprod NOT IN (SELECT idprod FROM costos);
```

---

## Paso 3: Usar la API de Costos

### Endpoints Disponibles:

#### GET - Obtener costos
```
GET /api/costos?idprod=123  → Costo de un producto específico
GET /api/costos             → Todos los costos
```

#### POST - Crear/Actualizar costo (con rotación de respaldos)
```json
POST /api/costos
{
  "idprod": 123,
  "costo": 100.00,
  "costo_proveedor": 95.00,
  "iva_pagado": 13.00,
  "nofactura": "FAC-001",
  "dt_compra": "2026-03-12"
}
```
**Nota:** Este endpoint rota automáticamente los respaldos:
- `costo_previo2` = valor anterior de `costo_previo1`
- `costo_previo1` = valor anterior de `costo_local`

#### PUT - Actualizar costo (sin rotación)
```json
PUT /api/costos
{
  "idprod": 123,
  "costo_local": 105.00
}
```

#### DELETE - Eliminar costo
```
DELETE /api/costos?idprod=123
```

---

## Lógica de Respaldos

Cuando se registra una nueva compra (usando POST):

```
ANTES:
  costo_local = 100
  costo_previo1 = 90
  costo_previo2 = 85

Nueva compra con costo = 110

DESPUÉS:
  costo_local = 110 (nuevo valor)
  costo_previo1 = 100 (valor anterior de costo_local)
  costo_previo2 = 90 (valor anterior de costo_previo1)
```

Esto permite recuperar los últimos 2 valores de costo en caso de error.

---

## Integración Pendiente

Para completar la integración, se necesita:

1. **Modificar `ajuste-precios`** para leer costos de la tabla `costos` en lugar de `productos`
2. **Modificar formularios de edición** para actualizar la tabla `costos`
3. **Opcional:** Eliminar campos de costo de la tabla `productos` después de verificar que todo funciona

---

## Notas Importantes

- La tabla tiene un **trigger** que crea automáticamente un registro de costo cuando se inserta un nuevo producto
- La relación es **1:1** (un registro de costo por producto)
- Los campos `costo_previo1/2` y `costop_previo1/2` son respaldos automáticos
- El `costo_promedio` se recalcula con cada nueva compra

---

## Próximos Pasos (cuando el cliente confirme)

1. Ejecutar el SQL en la base de datos
2. Verificar que la migración de datos fue exitosa
3. Integrar la API con el módulo de ajuste de precios
4. Probar el flujo completo de actualización de costos
