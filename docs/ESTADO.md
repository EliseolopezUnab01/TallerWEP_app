# Estado del proyecto — Taller Web

**Última actualización:** 2026-11-01 (plan de mejora integral cerrado. Fase 6, migración 025: el vehículo guarda número de tarjeta y código de serie; las órdenes de trabajo tienen correlativo OT, tareas y repuestos previstos; la línea express o de gastos se enlaza a la orden por `idorden`.)  
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
- Migraciones numeradas en `migrations/` (004–017)
- Datos de la empresa para el PDF de la orden de compra: variables `NEXT_PUBLIC_EMPRESA_NOMBRE`, `_NIT`, `_NRC`, `_DIRECCION`, `_TELEFONO`, `_EMAIL` en `.env.local` (`lib/empresa.ts`). No hay tabla de empresa.
- **Aplicar migraciones con redirección de `cmd`, no con tubería de PowerShell.** PowerShell 5 cambia tildes y ñ por `?` al pasar el texto a `mysql`. Forma correcta:
  `cmd /c "C:\xampp\mysql\bin\mysql.exe -uroot --default-character-set=utf8mb4 taller_web < migrations\0NN_archivo.sql"`
  (El 17/10 se repararon 42 comentarios de tablas y columnas dañados así en 012b–016; ningún ENUM ni dato quedó afectado.)
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
| Compras — Encabezado DTE nacional (Fase 4) | Hecho | Migración 012, ingreso FE/CCFE/NCE/NDE/FSEE en pantalla densa única |
| Compras — nodocto, correlativos, control 2, importador Excel/JSON | Hecho | Migración 014; `ImportarDialog` (Excel A–D y JSON DTE) |
| Cotizaciones y órdenes (solicitud → proforma) + productos temporales | Hecho | Migración 015; `/dashboard/compras/documentos` |
| Proceso de ingreso, DUCA y retaceo | Hecho | Migración 015b; `/dashboard/compras/procesos`; `lib/retaceo.ts` |
| Nota de crédito / sujeto excluido | Hecho | Factura origen, cantidad parcial con tope; resta stock solo de líneas de inventario (28/10) |
| Pulido de Compras (plan 28/10) | Hecho | Migración 017; stock al registrar y al retacear, reabrir retaceo, documentos, globos de stock |
| Aranceles, CxP, Bancos (Fase 7) | Bloqueado | B5, B6, B8, B9 |
| Taller: clientes, empleados, vehículos (tarjeta, partes, revisiones, recordatorios) | Hecho | Migración 016; `/dashboard/taller/*` |
| Órdenes de trabajo | No empezado | Tablas `ordenes_trabajo` y `orden_reparaciones` listas, sin pantalla |

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

**Fecha:** 2026-11-01
**Último trabajo:** fase 6 (migración `025_taller_ordenes.sql`). Vehículo con número de tarjeta y código de serie. Pantalla Taller > Órdenes de trabajo sobre `ordenes_trabajo`, con tareas en `orden_reparaciones` y repuestos previstos en `orden_repuestos`. El correlativo es `OT`. Al guardar una línea express o de gastos, si el número de orden existe se guarda `compras_detalle.idorden`; si no existe, la API rechaza la línea. Lo que se compra sigue en la línea express y no mueve stock por estar en la orden. Se borraron los usuarios de prueba `zz.admin@local` y `zz.consulta@local`. Queda llenar Empresa y el `.env.local` del DTE, arrancar el firmador y registrar el respaldo diario como administrador (`scripts/registrar-respaldo.ps1`).

**Fecha anterior inmediata:** 2026-11-01
**Trabajo:** fase 5 (migración `024_ajuste_inventario.sql`). Nuevo, editar e importar ya no escriben stock; el documento de ajuste suma o resta el contable y el físico. Los `alert` y `confirm` del dashboard pasaron a avisos.

**Fecha anterior inmediata:** 2026-11-01
**Trabajo:** fase 4 de Compras (migración `023_huecos_compras.sql`). El backorder es pedido menos recibido. Lo que está en camino sale de las líneas de inventario de procesos no finalizados que aún no aplicaron stock. El CIF del retaceo suma seguro, flete y gastos declarados.

**Fecha anterior:** 2026-10-28 (tarde)
**Último trabajo:** pulido de Compras implementado completo (fases 0–7 del plan). Migración `017_pulido_compras.sql` aplicada.

- **Decimales y stock.** Montos de compras con 8 decimales; se imprime a 2 o 4. La factura nacional suma stock y actualiza `costos` al registrar (`lib/compras-stock.ts`); anular la revierte. La NC resta solo las líneas que vienen de la factura origen y entraron a inventario (`ajuste_precio = 0`). La importación suma al aplicar el retaceo.
- **Factura nacional dentro de un proceso.** No suma al registrar: entra con el retaceo, igual que la importación. Si se registró antes de vincularla, el retaceo no la vuelve a sumar y solo recalcula el costo.
- **Ingreso nacional y JSON.** Control 2 CONTABLE / EXPRES / GASTOS / OTRO con bloqueos en pantalla y API; express con código EX y OT obligatoria; condición obligatoria. El JSON deja sin destino las líneas sin ficha y no deja registrar hasta clasificarlas.
- **Proceso e importación.**
  - Categorías de vínculo y de gasto libres, con sugerencias.
  - Tabla "Inversión real contra base de Hacienda" y tabla de impuestos (DAI e IVA calculados contra DUCA; VTS e ITS informativos).
  - Grilla con partida, %DAI de la ficha, TLC, CIF del grupo y costo banco.
  - Adjuntos en DUCA, documentos y gastos.
  - "Ingresar factura" desde una orden o proforma del proceso, marcando qué líneas y cuánto salió.
  - %DAI y partida editables en la ficha del producto.
- **Reabrir retaceo.** Botón "Reabrir retaceo" con la contraseña del usuario. El proceso vuelve a borrador (`fecha_reapertura`, `idusuario_reapertura`). Los datos de aduana del DUCA y la partida/DAI de las líneas que ya entraron quedan bloqueados. Al volver a aplicar no se suma otra vez el stock ni se rotan los respaldos; el promedio se recalcula con el stock y promedio guardados la primera vez.
- **Documentos.** Precio objetivo en orden y proforma, "Cargar solicitud" en una cotización, "Generar" con selector de líneas y cantidades, orden de líneas arrastrando, Excel para el proveedor y PDF formal de la orden. Al finalizar una solicitud sin proceso pregunta si se crea el proceso o solo se cotiza.
- **Globos de stock.** `components/ui/globo-stock.tsx` + `/api/productos/disponibilidad`: contable, físico, en camino (pedido pendiente de procesos abiertos) con fecha, y última compra. En el ingreso de compras, el buscador de documentos, Inventario › Administrar y el perfil del producto.

**Verificado (28/10):**
- tsc limpio, salvo el error viejo de `.next/types` por `categorias`.
- 52 pruebas de API con datos de prueba que se borraron después:
  - factura con stock;
  - NC 3 de 10 y tope de la segunda NC;
  - NC de gasto sin tocar stock;
  - JSON con líneas sin ficha;
  - retaceo aplicado, reabierto (clave incorrecta rechazada) y vuelto a aplicar sin duplicar stock, costos ni respaldos;
  - documentos solicitud → proceso → cotización → orden → factura;
  - disponibilidad.
- Revisión en navegador, claro y oscuro, de procesos, documentos, ingreso e inventario. Se corrigió el nombre del producto, que era casi blanco en modo claro en Inventario › Administrar.
- DBML regenerado.

**Pendiente o a revisar con el cliente:**
- En modo claro, Inventario › Administrar tiene botones con poco contraste ("Descargar Catálogo", "Exportar Excel", el selector "Tabla"). Es estilo viejo del módulo, no se tocó.
- "Nuevo proceso" crea el proceso al primer clic, sin confirmación.
- eslint: siguen `no-explicit-any` en rutas viejas (`compras/route.ts`, `compras-detalle/route.ts`, proveedores). Lo nuevo está limpio.
- No hay pantalla para `costo_corregido` por línea.
- Las APIs siguen sin middleware de autenticación. Solo reabrir el retaceo exige el token y la contraseña.

**Menú y diseño (28/10, después del pulido):**
- Sidebar reordenado: Compras (ingreso, cotizaciones y órdenes, procesos), Inventario (productos y ficha; subtítulos "Precios y costos" e "Importar desde Excel"), Taller (vehículos) y el módulo nuevo **Catálogos** (proveedores, clientes, empleados, catálogo contable). Las rutas no cambiaron.
- Ingreso, procesos, documentos y las pantallas de taller usan el lienzo oscuro de fondo (`UI.canvas`), igual que inventario.
- `/dashboard/inventario/precios` ("Editar Precio") es la versión vieja: escribe `precio1`–`precio7` directo en el producto, sin historial. "Ajuste de precios" la reemplaza. Queda fuera del menú; se puede borrar si el cliente confirma que no la usa.

**Siguiente paso:** mostrar el pulido al cliente y ajustar lo que pida. CxP, bancos y aranceles (B5, B6, B9) siguen bloqueados. Taller espera.

---

**Fecha:** 2026-10-28 (mañana)
**Último trabajo:** el cliente cerró decimales y nota de crédito.

**Fase 1 (migración 014).** Tabla `correlativos` y `lib/correlativos.ts` (`siguienteCorrelativo`, incremento atómico con `LAST_INSERT_ID`). Tipos: NODOCTO (`AA`+6 dígitos), CP, CI, SC, CT, OC, PF (`SC26-000001`), IMP (`IMP-2026-00001`), PT y VH (`VH26-00001`). `compras` ganó `nodocto`, `categoria_operacion` (control 2), `clase_documento` (DTE/IMPORTACION) e `idproceso`. También `catalogo_contable.codigo_oficial`, `ruta_archivos` y `esquemas_dte`.

**Fase 2.** Pantalla de compras según el Word actualizado: control 2 (GASTO bloquea Inventario y Express), Importación habilitada, Pago/BL/Inversión pasan al proceso de ingreso, precio con IVA incluido, filas que se arrastran, búsqueda de proveedor por alias/NIT/NRC/ID, aviso de fecha de la PC y reglas NC resta / ND suma.

**Fase 3.** `ImportarDialog`: Excel por posición A–D (cant., referencia, descripción, precio) con cruce exacto por referencia; lo que no cruza se queda en el flotante. JSON del DTE: llena el encabezado y las líneas, guarda el JSON en `esquemas_dte` y muestra el `apendice` para confirmar la cuenta ajena a mano.

**Fase 4 (migración 015).** `documentos_compras` (+detalle) y `productos_temporales`. Pantalla `/dashboard/compras/documentos`: crear por tipo, "Generar siguiente" copia las líneas al siguiente tipo, finalizar/reabrir/anular, líneas de inventario o escritas a mano (crean un temporal con imágenes). Convertir un temporal pone el `idprod` en todos los documentos y pendientes del proceso y borra sus imágenes.

**Fase 5 (migración 015b).** `proceso_ingreso`, `relacion_documentos`, `datos_duca`, `duca_detalles`, `costos_productos`, `pedido_pendiente` y `gastos_sindocumento`. Pantalla `/dashboard/compras/procesos` con pestañas Documentos, DUCA y retaceo, Pedido pendiente y Gastos sin documento. Reglas del retaceo (`lib/retaceo.ts`):
- CIF por línea = costo en divisa × TC del DUCA × cantidad, más seguro y flete repartidos por valor.
- DAI por línea = % sobre el CIF; si el DUCA trae el DAI pagado, ese total se reparte con los mismos pesos.
- IVA 13 % sobre CIF + DAI, ajustado al IVA pagado del DUCA. Es crédito fiscal y no entra al costo.
- Los gastos a retacear se reparten por CIF. Sugerido = documentos vinculados marcados + gastos sin documento + otros cargos del DUCA.
- Costo destino = costo en divisa × TC pagado al banco + (gastos + DAI) / cantidad. Promedio ponderado con el stock anterior a la compra.
- Al aplicar: rota `costo_previo1/2` y `costolcl_previo1/2`, escribe `costo_local`, `costo_local_promedio`, `costo_proveedor`, `iva_pagado`, `nofactura`, `nodocto`, `dt_compra`. No toca `costo` ni `costo_promedio`.
- Historial por producto (B7): `/api/historial-producto?idprod=` junta cotizaciones, compras, DUCA, costos y pendientes.

**Fase 6 (migración 016).** `clientes` y `empleados` con DUI, NIT, NRC, giro, ISSS, AFP y NUP (fuera RFC, CURP, NSS, código postal). `vehiculos` con los datos de la tarjeta vigente; placa y año de placa separados. Tablas nuevas `cat_sistemas_vehiculo` (15 sistemas sembrados, editable), `vehiculo_partes`, `estado_partes` y `recordatorios_mantenimiento` (próxima fecha y km calculados). Se eliminaron las 5 hojas `orden_*`; `orden_reparaciones` enlaza hasta 3 mecánicos a `empleados`. Pantallas:
- `/dashboard/taller/vehiculos`: ficha y tarjeta (con fotos en `ruta_archivos`, carpeta `vehiculos`), partes por sistema (agregar, editar, reemplazar, retirar), revisiones de entrada/salida por lote (solo se guardan las partes con cambios) con historial, y recordatorios con estado VENCIDO / PRÓXIMO (15 días o 500 km) / AL DÍA.
- `/dashboard/taller/clientes` (con sus vehículos) y `/dashboard/taller/empleados`.
- Un reemplazo deja la pieza vieja RETIRADA con fecha y km, y pasa sus recordatorios a la nueva marcándolos como hechos. El odómetro del vehículo solo avanza con los km que se registran.

**Verificado:** tsc limpio (solo un error viejo de `.next/types` por la ruta `categorias` borrada). eslint limpio en todos los módulos nuevos; los errores que quedan son `any` en rutas viejas de compras/proveedores, `require()` en scripts y `setState` en effect en `sidebar.tsx`, todos anteriores. Pruebas de API de cada fase. Proceso de prueba: CIF del grupo 304.20, costo destino 31.2192 y 11.4737, igual al cálculo a mano. Capturas en Edge sin ventana a 1024x480 y 1366x768, claro y oscuro. DBML regenerado (45 tablas, todas agrupadas).

**Pendiente o no cubierto:**
- ~~Reabrir un retaceo ya aplicado no está soportado.~~ Hecho el 28/10 (ver arriba).
- No hay pantalla para `costo_corregido` por línea (la columna existe y el cálculo la usa).
- Órdenes de trabajo sin pantalla; `estado_partes.idorden` ya enlaza con ellas.
- Las APIs nuevas siguen sin middleware de autenticación, igual que las anteriores.

**Siguiente paso (28/10, análisis cerrado, sin dudas abiertas):** pulir Compras cuando se pida implementar. CxP, bancos y la tabla de aranceles quedan para cuando él mande esas tablas. El diagrama de backorder que compartió sigue sin editar; se usa la regla que dijo en el video. Transcripciones en `docs/fuentes/videos/transcripciones/`. No crear CxP, bancos ni módulo de aranceles: si el dato ya vive en la ficha del producto (partida, %DAI) se muestra; si no tiene tabla, se captura igual. Taller queda para después.

Pantallas distintas que aparecen: el formulario Fox "Registro y Control de Compras", el PDF de un DUCA real, el dbdiagram, la bitácora "Consulta Mensual" de compras y, de paso, la de ventas. No hay una pantalla nueva de solicitud, cotización ni orden: ese flujo lo explica sobre el diagrama.

Plan de pulido (implementado el 28/10 por la tarde, ver arriba):

1. **Ingreso nacional.** El segundo combo de la pantalla se llama CONTABLE / EXPRES / GASTOS / OTRO (no Fiscal / Gasto / Mixto). CONTABLE solo inventario, EXPRES solo express, GASTOS solo gastos, OTRO cualquiera de los tres. El documento (crédito fiscal, consumidor final) es otro combo y sigue siendo fiscal para el IVA. No se puede pasar una línea escrita a inventario. Express exige orden de trabajo para finalizar; el gasto puede llevarla. Al agregar, express recibe código incremental (en el video, 1212000) y gasto el rubro (500). Cambiar la categoría con líneas que no coinciden debe avisar y no dejar seguir. Avisos que sí muestra: "Debe elegir la condición de compra", "Es obligatorio que elija una opción para el tipo de producto", "¿Está seguro de hacer cambios?" y "Seguro de eliminar este ítem". Al registrar, la ficha muestra última compra, stock y la factura como referencia de costo. El totalizador lleva sumas, descuento, subtotal, IVA, IVA percibido, IVA retenido, cuenta ajena, no sujetas, exentas, total inversión y compra total.
2. **JSON.** Soltar el archivo con el tipo ya elegido. Cada línea sin ficha se clasifica express o gasto antes de finalizar. La condición de pago se pide aunque el JSON no la traiga. El sello puede venir vacío.
3. **Proceso e importación.** Varias facturas de flete y gastos, sumadas por categoría, no un solo campo. En pantalla cada concepto de inversión tiene dos cajas: lo pagado de verdad y la base de Hacienda (en el ejemplo, FOB 32,534 contra 19,826.78). Cada línea conserva su proveedor: el DAI depende del país, el IVA 13% es para todos. Express no entra en un DUCA. El %DAI sale de la ficha; la grilla también muestra partida, ¿TLC?, CIF del grupo y costo banco. Dos tipos de cambio: el pagado al proveedor (costo real; en el diagrama, `tipo_cambio_pagado`) y el de aduana (impuestos). El PDF del DUCA trae además VTS e ITS; se comparan, no se recalculan. Al reabrir un retaceo ya aplicado, con una confirmación, se agrega el documento olvidado y se actualizan los costos existentes. No se toca lo que ya pasó por aduana (número, fecha, datos del DUCA).
4. **Documentos.** Solicitud con precio en cero, exportar Excel para el proveedor y un PDF de la orden. Al finalizar la solicitud, preguntar si se crea el proceso o si solo está cotizando. De la cotización se arma la orden (cantidades y precio objetivo distintos). La proforma puede cambiar cantidad, precio y fecha. El voucher sin factura va a gastos sin documento, con su foto. Al facturar se marcan solo las líneas que sí salieron y se actualiza el pedido pendiente. En inventario, además del stock, mostrar lo que viene en camino y la fecha.
5. **Globos de stock.** Ejemplo del cliente: el carrito de MS Motorservice (cuenta HECTOR ARGUETA). Junto al producto hay un ícono; al pasar el mouse se abre una ventana chica. En su nota dice "suministrable el martes, 1 de septiembre de 2026" y "Notification of availability". Lo quiere para el stock: el ícono dice si hay o no, y el globo muestra stock contable, stock físico, lo que viene en camino y la fecha en que se puede entregar. No hace falta una pantalla nueva.

**Cerrado por el cliente (28/10):**

1. **Decimales.** Estándar del sistema: guardar hasta 8 decimales. Así los cálculos no varían. Compras alimenta la contabilidad con esos números. Al imprimir se redondea a 4 o a 2, según el documento, y lo guardado no se modifica. Hoy las columnas siguen en 4 (compras) y 2 (`costos`); el cambio de columnas va con el pulido.
2. **Nota de crédito.** Puede bajar el precio de la compra (un descuento), anular toda la factura o solo algunas líneas, y de una línea solo una parte de la cantidad. Ejemplo: compró 10 y la nota es por 3; el inventario baja 3 y el resto de la factura no se toca. Busca en inventario únicamente los artículos que en la factura original entraron a inventario, y resta la cantidad de la nota. Express, transporte, limpieza, gastos y cualquier línea no inventariable no se buscan en inventario: se anulan según la clasificación y el destino con que se ingresó la factura. Esa clasificación es la guía.

---

**Fecha:** 2026-10-09  
**Último trabajo:** pantalla de compras nacionales rehecha con el layout denso del sistema actual del cliente (captura del Word `dudas - Modulo Compras.docx`). Una sola ventana en 4 franjas:

1. Barra DTE: tipo (01/03/05/06/14), fecha emisión, cuenta (placeholder deshabilitado, B9), No. control, código de generación, sello, estado y acciones (nuevo, abrir, guardar, registrar, anular, eliminar borrador).
2. Izquierda: proveedor (código/alias/nombre/NIT), NRC/NIT, factura, ref. contable, condición/plazo/vencimiento (crédito = 30 días por defecto), recepción; pestañas de docs. relacionados (obligatorio NCE/NDE), pagos y notas. Derecha: inventario con filtro + método (referencia, código, OEM, alias/descripción) + IVA por defecto, y fila de captura de línea (Enter agrega, Esc limpia; gasto/activo exige rubro).
3. Detalle (control 30): editar al hacer clic, borrar, reordenar, líneas repetidas permitidas.
4. Totales: gravado, exento, no sujeto, X comprobar, descuentos, IVA, retenciones editables, **total fiscal** (sin X comprobar) y **total contable**. Atajos F2 registrar, F3 proveedor, F4 anular, Ctrl+S guardar.

Código en `app/dashboard/compras/ingreso/_components/` (`useCompra.ts`, `BarraDte`, `PanelProveedor`, `PanelInventario`, `GrillaDetalle`, `BarraTotales`, `DialogoAbrirCompra`, `tipos.ts`). Tokens densos `dense*` en `lib/ui.ts`. `/dashboard/compras/lineas` redirige a ingreso (acepta `?idcompra=`); sidebar con una sola entrada "Ingreso de Compras". `/api/productos` acepta filtros `referencia` e `idprod`. Sin migraciones nuevas.

Verificado en navegador (claro y oscuro): CCFE #2 registrado con línea X comprobar (fiscal 49.16 / contable 54.16) y NCE #6 registrada con documento relacionado; registrar sin docs en NCE muestra el error esperado.

**Segunda pasada (mismo día): corrección de errores y fidelidad al sistema del cliente.**

- Sin parpadeo al entrar: `useCompra` carga la compra inicial (`?id=` o primer borrador) y expone `cargandoInicial`; la página muestra un esqueleto y el estado "no hay compra" solo si de verdad no hay ninguna.
- Layout: la página hace scroll y nada se corta (probado 1024x480); totales fijos abajo. Dos columnas desde 1300 px; por debajo, los bloques izquierdos van lado a lado y el inventario a todo el ancho.
- Barra DTE en dos filas como el cliente: título de documento en color, combo con nombres del cliente (Crédito Fiscal, Consumidor Final, Nota de Crédito/Débito, Sujeto Excluido; Importación y Gastos visibles pero deshabilitados), "Cargar a cuenta" pendiente (B9), botones de icono.
- Izquierda en 3 bloques: Proveedor y condiciones (8–12, Registro = NRC, Nombre = buscador, Fecha límite); Ref. documentos (14) con Pago/Pago1/Pago2 sobre `compras_pagos`, BL/Seguro/DUCA pendientes y grilla de docs relacionados; Inversión importación completa pero deshabilitada (B3).
- Inventario: Importar (16) pendiente, "Ir a", método, IVA por defecto; grid 20 con DAI y Cód. arancelario en "—" (B5); captura 21–29 con Orden solo para Express, Costo c/IVA calculado y destino en radios.
- Detalle: barra CIF total/Existencia/Artículos/Subtotal $/Subtotal € (CIF y € pendientes), columnas del control 30, miniatura de imagen ampliable, columnas de importación en gris, confirmación al actualizar una línea.
- Bug corregido: al cambiar a NC/ND sin guardar, agregar documento relacionado fallaba (el API valida el tipo en BD); ahora se guarda el encabezado antes.
- Pendientes visibles marcados con la etiqueta "Pendiente" (`UI.densePending` / `densePendingTag`).

Verificado con Edge headless (1024x480, 1366x768, 1600x900; claro y oscuro): flujo en borrador de prueba (proveedor, línea Express con orden, pago, cambio a NCE + doc relacionado, guardar, editar línea, visor de imagen), borrador eliminado después. tsc y eslint limpios en el módulo.

**Base de datos:** `012` aplicada. MySQL local es el de XAMPP (si la API da `ECONNREFUSED`, arrancar MySQL desde XAMPP).

**Siguiente paso:** revisar la pantalla con el cliente y conectar cada control "Pendiente" cuando él defina su parte. Pendiente opcional: importar el JSON del DTE (control 16) para llenar la misma pantalla. Importaciones/retaceo cuando el cliente termine sus tablas (B3). CxP y bancos siguen pendientes.

**Sigue pendiente del cliente:** PREGUNTA 1 (descuento informativo vs aplicado), B3 retaceo, B5–B9.

**Diagrama para el cliente:** el flujograma corto es `docs/taller_web_flujo.dbml` (pegar en dbdiagram.io). El esquema completo sigue en `docs/taller_web.dbml`, regenerable con `node scripts/exportar-dbdiagram.js`. Migración `013` eliminó la tabla vieja `categorias` (9 filas que ningún producto usaba). Queda `categorias_nuevo`. `productos.idcategoria` se conservó: son códigos de importación sueltos, y ningún producto tiene `idcategoria_nuevo` todavía. El costo además se guarda en `productos` y en `costos`. Las 6 tablas `orden_*` no son copias: son hojas de inspección distintas.

**2026-10-12. Nuevo lote del cliente, solo analizado (nada implementado):**

- 12 tablas nuevas para compras internacionales (DBML en dbdiagram `New-Sys`): `documentos_compras` (+detalle), `proceso_ingreso`, `relacion_documentos`, `pedido_pendiente`, `datos_duca`, `duca_detalles`, `costos_prodcutos`, `cat_contable_gastos`, `ruta_archivos`, `esquemas_dte`, `gastos_sindocumento`. El cliente pide no tocar `compras`/`compras_detalle` (son para las compras nacionales con DTE) y solo agregar.
- Vehículos: reemplazar las hojas `orden_*` por `vehiculos` + `vehiculo_partes` + `estado_partes` (historial). Ninguna tabla del taller tiene datos ni código.
- Word `Modulo Compras actualizado.docx`: control 2 FISCAL/GASTO/MIXTO; los controles 13–14 pasan a un formulario aparte "Proceso de ingreso"; control 16 importa desde Excel/JSON; el control 27 puede desaparecer; el historial de precios se resuelve con una consulta (B7).
- Audio del video (3 min): el formulario flotante existe para revisar antes de enviar. El Excel debe seguir el ejemplo que muestra el formulario. Cuenta las filas (106 con encabezado = 105). Lo que no cruza por referencia se queda en el flotante: el caso del video es `078.065` sin guion contra `078.065-01` en inventario, y esa línea se agrega a mano (cant. 8, precio 6.25). Luego compara la suma (19,826.78 contra 19,827.38). Cada línea sigue pudiendo ser inventario, express o gasto, en cualquier tipo de documento. No explica la casilla "Actualizar" ni el botón JSON.
- Ejemplo CFE 910 (BFI): fiscal 197.75 + cuenta ajena 86.43 (en `apendice`) = 284.18 a pagar.
- Preguntas abiertas para el cliente (ID global de documentos, enlace por línea, DUCA por proceso, backorders, etc.): ver el chat del 12/10.

**2026-10-16. Respuestas en `docs/fuentes/preguntas-importantes_extraido.txt`. Nada implementado. Listo para el plan, con un desajuste del Excel.**

- `nodocto`: ID global único (compras y ventas). Formato de ejemplo `26015120` (año `26` + correlativo). Además, un número visible por tipo (CF, CT, IMP). Sí se agrega a `compras`. Hace falta una tabla de correlativos.
- Enlace por línea: sí. El cliente además quiere consultar cada producto a través de compras, impuestos, cotizaciones y backorders. El ID temporal se reemplaza por el de inventario cuando se crea la ficha.
- Un proceso tiene varias facturas y un solo DUCA.
- Backorder: reservado, en proceso, total = suma de esos dos, pagado y por pagar (el mismo pendiente partido por si ya se pagó).
- Producto temporal: se escribe a mano, con imagen en otra carpeta. No se crea ficha hasta que se compra.
- Pago, Pago1 y Pago2 eran documentos vinculados. Salen de esta pantalla y pasan al formulario de proceso de ingreso. No son las formas de pago del DTE.
- Nota de débito se queda. El control 2 se guarda en `compras` y en `documentos_compras`.
- La casilla Actualizar del video se descarta. La edición de líneas del grid se mantiene: al soltar un JSON hay que poder indicar destino (inventario, express, gasto).
- `duca_detalles` y `costos_prodcutos` pueden quedar separadas. En Fox estaban juntas dentro del detalle.
- Vehículos: no es prioridad. Si se avanza, una fila solo cuando la pieza cambia. Estado visual 1–10, estado en texto y comentario, por separado. Fotos de la tarjeta en `docs/fuentes/`.
- Excel: la imagen del ejemplo trae Referencia, Descripción, Arancel y DAI. El archivo del video trae cantidad, referencia, precio, total y %DAI (105 filas). No son el mismo formato.

**Vehículos entran al plan (decisión del usuario, 16/10).** Las tablas del taller no tienen código ni datos. Propuesta:

- `vehiculos`: se amplía con los datos de la tarjeta de circulación (clase, ejes, tara, capacidades, tracción, dominio, propietario, fechas de la tarjeta).
- `vehiculo_partes`: se le agrega el nombre de la pieza, que la lista del cliente no traía, y si está instalada o fue retirada.
- `estado_partes`: estado visual 1–10, estado en texto, orden, empleado, kilometraje y comentario.
- Las 5 hojas `orden_*` de inspección se eliminan. Se quedan `ordenes_trabajo` y `orden_reparaciones`.
- `clientes` y `empleados` tienen campos mexicanos (RFC, CURP, NSS) que hay que pasar a los de El Salvador.

**Repaso de las fuentes (16/10). Respuestas encontradas sin preguntar al cliente:**

- Excel: el importador de Fox lee A–D por posición: cantidad, referencia, descripción, precio. Es lo que muestra el formulario del video (Cant/Referencia/Descripción/Precio/Subtotal). G = cant × precio en las 105 filas, con suma 19,826.78. H (%DAI) y J no se leen. La imagen con Referencia/Descripción/Arancel/DAI dice que C y D son números, pero en el Excel real C es texto. Encaja con el modo "Actualizar" descartado. J tiene 4 códigos (filas 2, 47, 93 y 104) que parten la lista en bloques, y la fila 47 repite el producto de la fila 3. Parecen números de factura o proforma.
- El combo 1 del Word incluye Importación: la factura extranjera se captura en `compras`. `documentos_compras` queda para solicitud, cotización, orden y proforma.
- JSON: sí se quiere (aclaración del control 30). `esquemas_dte.version` resuelve el problema de versiones que el cliente temía. La cuenta ajena del apéndice es texto libre: se confirma a mano.
- Forma de pago: viene en `pagos` del JSON y `compras_pagos` se queda.
- Control 2: solo GASTO bloquea (Inventario y Express). FISCAL y MIXTO, libres.
- Retaceo: reparto proporcional al valor CIF (`total_grupo_cif`). Un DUCA por proceso; si se corrige, se reemplaza.
- Stock al registrar la factura; el costo se recalcula con el retaceo después (control 27).
- Producto temporal: el reemplazo de ID va en todo el proceso. Se pueden cotizar productos de inventario. La imagen se borra al crear la ficha.
- `pedido_pendiente`: una fila por producto y proceso. Las cantidades salen de los documentos.
- Vehículos: nota visual 1–10, estado en texto (que hace de recomendación) y comentario. Sistemas en catálogo editable. El propietario de la tarjeta es el propio dueño del negocio (mismo nombre que el receptor del CFE), así que va aparte del cliente.

**Respondidas por el usuario (16/10):**

- Pieza reemplazada = pieza nueva; la vieja queda como retirada.
- El estado se guarda de entrada y de salida.
- Tarjeta: solo la vigente, con la foto en `ruta_archivos`.
- El próximo cambio funciona como recordatorio por fecha y kilometraje.
- Placa: `C79371` es la placa y `2011` el año, en campos separados.

**Manual de Hacienda** (`Manual Funcional del Sistema de Transmisión V 2.0.pdf`, 80 págs.):

- Pág. 41–42: la devolución de productos, un descuento que no se aplicó y una baja de precio (25 → 22) se ajustan con **nota de crédito**. Lo que describió el cliente es una NC. La NDE queda para los ajustes que suben el monto. Regla del sistema: NC resta y ND suma.
- Págs. 31–32, campo "Cargos/Abonos que no afectan la base imponible" (`noGravado` / `totalNoGravado`): es el lugar oficial para cargos que suman o restan al total a pagar sin IVA. Corresponde a `compras.total_cargos_no_afectos`. BFI no lo usó: puso la cuenta ajena en `apendice`. Al importar el JSON, `noGravado` se lee solo y el `apendice` se confirma a mano.

**Cerrada (27/10, mensaje del cliente):** los códigos de la columna J son el número de factura de ese proveedor. El Excel le sirve a la vez de archivo de ingreso y de registro personal: el importador solo debe leer las primeras cuatro columnas (A–D). El resto puede traer más datos y se ignora. No hace falta un Excel distinto por cada uso.

**Siguiente paso (de entonces):** armar el plan. Hecho el 17/10, ver arriba.

---

## Bloqueantes activos (B1–B9)

Resumen; detalle completo en [`modulo-compras.md`](modulo-compras.md) §10:

| ID | Tema | Impacto |
|---|---|---|
| B1 | Encabezado Compras1 sin especificar (fechas, estados) | **Resuelto (parcial)** con estándar DTE. Falta confirmar descuento (P1) |
| B2 | Totales fiscal vs contable sin definir | **Resuelto (parcial)**: gravado/exento/no sujeto + XCOMPROBAR aparte |
| B3 | Retaceo de importaciones | **Resuelto**: proceso de ingreso + DUCA, reparto por CIF (17/10) |
| B4 | Nota de crédito y sujeto excluido | **Resuelto (28/10)**: la NC resta en inventario solo las líneas que entraron como inventario, y solo la cantidad de la nota. Express, servicios y gastos no se buscan ahí |
| B5 | Tabla aranceles / DAI inexistente | Grid 20 sin datos de arancel |
| B6 | Cuentas por Pagar no existe | Saldos proveedor en 0 |
| B7 | Historial costos 1:1 no sirve para líneas duplicadas | **Resuelto**: `costos_productos` por línea + `/api/historial-producto` (17/10) |
| B8 | Decimales | **Resuelto (28/10)**: guardar hasta 8. Imprimir redondea a 4 o 2 sin alterar lo guardado |
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
| Ingreso de compra UI (encabezado + líneas) | `app/dashboard/compras/ingreso/page.tsx` + `_components/` |
| Líneas de compra (redirección) | `app/dashboard/compras/lineas/page.tsx` |
| API compras / detalle | `app/api/compras/route.ts`, `app/api/compras-detalle/route.ts` |
| API catálogos DTE / pagos / docs rel | `app/api/catalogos-dte/route.ts`, `app/api/compras-pagos/route.ts`, `app/api/compras-documentos-rel/route.ts` |
| Cálculos línea / resumen | `lib/compras-detalle.ts`, `lib/compras-resumen.ts`, `lib/compras-constantes.ts` |
| Correlativos y nodocto | `lib/correlativos.ts` |
| Archivos (imágenes, tarjetas, PDFs) | `lib/archivos.ts`, `app/api/archivos/route.ts` (carpetas en `public/uploads/`) |
| Cotizaciones y órdenes UI / API | `app/dashboard/compras/documentos/`, `app/api/documentos-compras*/`, `app/api/productos-temporales/` |
| Procesos de ingreso UI / API | `app/dashboard/compras/procesos/`, `app/api/procesos/route.ts`, `app/api/historial-producto/route.ts` |
| Retaceo y procesos (servidor) | `lib/retaceo.ts`, `lib/procesos.ts`, `lib/documentos-compras.ts` |
| Constantes para componentes cliente | `lib/documentos-compras-constantes.ts`, `lib/procesos-constantes.ts`, `lib/taller-constantes.ts` |
| Taller UI | `app/dashboard/taller/{vehiculos,clientes,empleados}/`, componentes comunes en `app/dashboard/taller/_components/` |
| Taller API | `app/api/{clientes,empleados,vehiculos,vehiculo-partes,estado-partes,recordatorios,sistemas-vehiculo}/`, `lib/taller.ts` |
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
