# Estado del proyecto — Taller Web

**Última actualización:** 2026-09-22  
**Propósito:** documento vivo para que Cursor (y cualquier chat nuevo) sepa en qué va el sistema sin depender del historial de Windsurf.

---

## Qué es este sistema

- **Nombre:** Taller Web (`TallerWEP_app`)
- **Stack:** Next.js 16, React 19, TypeScript, Tailwind, MySQL (`mysql2`), JWT en `localStorage`
- **Dominio:** inventario de taller automotriz, El Salvador, IVA 13%
- **Arranque:** `npm run dev` desde `TallerWEP_app/` → `http://localhost:3000`

### Convenciones técnicas

- BD: `lib/db.ts` — conexión MySQL
- Auth: `lib/auth.ts` — JWT 7 días; login en `/`; dashboard exige token en cliente (APIs sin middleware aún)
- Migraciones numeradas en `migrations/` (004–012)
- Docs de especificación en `docs/`; fuentes originales del cliente en `docs/fuentes/`

---

## Módulos — resumen

| Módulo | Estado | Notas |
|---|---|---|
| Login / dashboard shell | Hecho | Tema claro/oscuro, sidebar |
| Inventario (CRUD, importar, costos, precios, categorías) | Hecho | Módulo más maduro |
| Compras — Proveedores (Fase 1) | Casi listo | 3 pestañas, APIs, migración 009, Excel/PDF |
| Compras — Catálogo contable (Fase 2) | Hecho | Migración 010, API, pestañas Gastos/Activos |
| Compras — Detalle de líneas (Fase 3) | Hecho | Migración 011, APIs, grid control 30 |
| Compras — Encabezado DTE nacional (Fase 4) | Hecho | Migración 012, ingreso FE/CCFE/NCE/NDE/FSEE |
| Retaceo importaciones (Fase 5) | Bloqueado | B3 — el cliente lo trabaja por su lado |
| Nota de crédito / sujeto excluido | Hecho (parcial) | Tipos DTE 05/06/14 en ingreso; no revierte inventario aún |
| Aranceles, CxP, Bancos (Fase 7) | Bloqueado | B5–B9 |
| Clientes, vehículos, órdenes de trabajo | No empezado | Schema parcial en migración antigua |

---

## Último lote del cliente (fuente de verdad)

Archivos originales en [`docs/fuentes/`](fuentes/):

| Archivo | Contenido |
|---|---|
| `captura-1-general.png` | Ficha GENERAL: código `275`, ACOSA, Ir a, Contribuyente, Qué provee |
| `captura-2-contactos.png` | Pestaña CONTACTOS: 2 bloques (contacto, puesto, tel, móvil, email) |
| `captura-3-cuentas-vacia.png` | Pestaña CUENTAS vacía: No cuenta, +/editar/borrar, SWIFT, IBAN |
| `captura-4-cuenta-italiana.png` | Cuenta real: EURO, SWIFT `BNLIITRR`, IBAN italiano |
| `nuevas tablas para sistemas (3).xlsx` | Especificación global de tablas (~199 filas) |
| `Modulo Compras.docx` | Especificación del módulo Compras (rojo = lo nuevo) |

### Análisis ya hecho (no re-analizar desde cero)

| Fuente | Análisis en repo | Fecha |
|---|---|---|
| Excel de tablas | [`actualizacion-tablas-cliente.md`](actualizacion-tablas-cliente.md) | 2026-08-30 |
| Word + 4 capturas | [`modulo-compras.md`](modulo-compras.md) §11 y checklist | 2026-09-01 |
| Cambios de BD | [`migrations/009_proveedores_el_salvador.sql`](../migrations/009_proveedores_el_salvador.sql) | 2026-09-01 |

### Decisiones ya tomadas (no reabrir sin confirmar con el cliente)

- 2 direcciones en línea dentro de `proveedores` (no 3)
- Contactos en tabla `proveedor_contactos` (captura muestra 2; Excel dice “hasta 2 o 3”)
- Cuentas bancarias en tabla aparte `cuentas_bancarias` (varias por proveedor)
- Código autogenera `PL####` / `PE####` pero admite numérico del sistema viejo (`275`)
- “Ir a” con autocompletado del sistema viejo: **no** replicado; el buscador cubre la función
- Saldos CxP: campos en 0, solo lectura, hasta que exista Cuentas por Pagar
- Catálogo contable: **una** tabla con columna `tipo` (GASTO/ACTIVO), no dos tablas gemelas. El cliente pidió "una tabla para cada caso"; se dejaron las vistas `v_catalogo_gastos` y `v_catalogo_activos` para esa lectura separada
- `condicion_iva_sugerida` en el catálogo: inferido de la nota del cliente sobre Impuestos y Tasas Municipales ("ideal cuando el Selector 2 sea No Sujeto"). Es sugerencia, el usuario puede cambiarla
- Encabezado `compras`: campos DTE nacionales (migración 012). Estados `BORRADOR` / `REGISTRADA` / `ANULADA`
- Descuento en líneas: se guarda el porcentaje pero no se resta del subtotal (PREGUNTA 1 pendiente)
- Tipos DTE de compras nacionales: 01 FE, 03 CCFE, 05 NCE, 06 NDE, 14 FSEE (código oficial CAT-002)
- Formas de pago y documentos relacionados se capturan ahora; CxP no genera movimientos todavía

---

## Dónde me quedé

**Fecha:** 2026-09-22  
**Último trabajo:** Fase 4 de Compras nacionales — encabezado DTE. Migración `012_compras_dte_nacional.sql` (catálogos CAT-002/015/017, ALTER `compras` + `compras_detalle`, tablas `compras_pagos` y `compras_documentos_rel`). UI en `/dashboard/compras/ingreso`. APIs `/api/catalogos-dte`, `/api/compras-pagos`, `/api/compras-documentos-rel`. Totales en `lib/compras-resumen.ts`.

**Base de datos:** ejecutar `012` en `taller_web` si aún no está aplicada.

**Siguiente paso:** importaciones/retaceo cuando el cliente termine sus tablas (B3). CxP y bancos siguen pendientes.

**Sigue pendiente del cliente:** PREGUNTA 1 (descuento informativo vs aplicado), B3 retaceo, B5–B9.

---

## Bloqueantes activos (B1–B9)

Resumen; detalle completo en [`modulo-compras.md`](modulo-compras.md) §10:

| ID | Tema | Impacto |
|---|---|---|
| B1 | Encabezado Compras1 sin especificar (fechas, estados) | **Resuelto (parcial)** con estándar DTE. Falta confirmar descuento (P1) |
| B2 | Totales fiscal vs contable sin definir | **Resuelto (parcial)**: gravado/exento/no sujeto + XCOMPROBAR aparte |
| B3 | Retaceo de importaciones | No se calcula `costo_local` |
| B4 | Nota de crédito y sujeto excluido | **Resuelto (parcial)**: tipos y docs relacionados. No revierte inventario |
| B5 | Tabla aranceles / DAI inexistente | Grid 20 sin datos de arancel |
| B6 | Cuentas por Pagar no existe | Saldos proveedor en 0 |
| B7 | Historial costos 1:1 no sirve para líneas duplicadas | Control 25 |
| B8 | Decimales: compras 4 vs costos 2 | Redondeo por definir |
| B9 | Bancos / cajas chicas sin campos | Control 4 |

---

## Archivos clave del código

| Área | Ruta |
|---|---|
| Proveedores UI | `app/dashboard/compras/proveedores/page.tsx` |
| API proveedores | `app/api/proveedores/route.ts` |
| API cuentas bancarias | `app/api/proveedores/cuentas/route.ts` |
| Catálogo contable UI | `app/dashboard/compras/catalogo-contable/page.tsx` |
| API catálogo contable | `app/api/catalogo-contable/route.ts` |
| Líneas de compra UI | `app/dashboard/compras/lineas/page.tsx` |
| Ingreso de compra UI | `app/dashboard/compras/ingreso/page.tsx` |
| API compras / detalle | `app/api/compras/route.ts`, `app/api/compras-detalle/route.ts` |
| API catálogos DTE / pagos / docs rel | `app/api/catalogos-dte/route.ts`, `app/api/compras-pagos/route.ts`, `app/api/compras-documentos-rel/route.ts` |
| Cálculos línea / resumen | `lib/compras-detalle.ts`, `lib/compras-resumen.ts`, `lib/compras-constantes.ts` |
| Sidebar / menú | `components/sidebar.tsx` |
| Inventario | `app/dashboard/inventario/*` |
| Conexión BD | `lib/db.ts` |
| Auth | `lib/auth.ts`, `app/api/auth/login/route.ts` |

---

## Cómo actualizar este documento

Al cerrar un chat o terminar una sesión de trabajo:

1. Cambiar **Última actualización** arriba.
2. Actualizar la sección **Dónde me quedé** (fecha, último trabajo, siguiente paso).
3. Si llegó material nuevo del cliente, copiarlo a `docs/fuentes/` y anotarlo en **Último lote del cliente**.
4. Si se resolvió un bloqueante, marcarlo y mover la fase correspondiente en la tabla de módulos.

En chats nuevos de Cursor: mencionar `@docs/ESTADO.md` si hace falta más contexto.
