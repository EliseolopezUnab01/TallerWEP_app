# Módulo Compras — Especificación del cliente

**Fuente:** `Modulo Compras.docx` (162 párrafos) + 4 capturas del sistema actual de proveedores
**Analizado:** 01-09-2026
**Nota del cliente:** *"Actualicé información en el documento de compras. Lo de rojo es lo nuevo."*

Los controles se identifican por el número que el cliente usa en su mockup.

---

## 1. Controles sin cambios respecto a la versión anterior

| # | Control | Detalle |
|---|---|---|
| 1 | Tipo de documento | Combo: Crédito Fiscal, Consumidor Final, Importación, Nota de Crédito, Sujeto Excluido, Gastos |
| 4 | Cuenta destino | Módulo *Bancos*: un registro por cuenta bancaria o caja chica. El movimiento de la compra afecta esa cuenta. **Baja prioridad**: *"se puede crear y dejar como una mecha para usar después"*. Sugiere crear solo la tabla para almacenar registros y el módulo de control al final |
| 5, 6, 7 | Datos de factura electrónica | Según el nombre de dato indicado en cada uno |
| 8 | Número de factura | Alfanumérico, hasta **100 caracteres** |
| 9 | Referencia contable | Dato o número de libro que el contador decida guardar. **30 caracteres** |
| 10 | Número de registro de comercio | Para clientes nacionales |
| 10.1 | Búsqueda de proveedores | *"No olvidar poderlos buscar por **alias** y por **ID de proveedor**"* |
| 12 | Condición de compra | CRÉDITO o CONTADO. Si es crédito: cantidad de días (**sugerir 30 por defecto**) y fecha límite de pago calculada desde el inicio del crédito. **Debe registrarse en Cuentas por Pagar** |
| 16 | Importar factura | Botón que abre cuadro de importación desde **Excel o JSON**. Debe permitir **arrastrar y soltar** en la zona 30, o en cualquier zona del módulo |
| 17 | Filtro de productos | Búsqueda/filtración de los productos de inventario que se muestran en la zona 20 |
| 18 | Método de filtrado | Por Referencia de proveedor, Código de sistema, OEM, Alias, etc. *"El método debe ser **filtrado y no selección**"* |
| 20 | Grid de inventario | Muestra: Código, Referencia, OE, Nombre, Costo, Stock, Proveedor, **DAI** y **Código Arancelario**. Además sería *"muy oportuno y útil"* un visor de imágenes |
| 21 | Orden de trabajo | ID de la orden para la cual se compró el artículo. **Habilitada solo con compras nacionales e inventario express** |
| 22 | Referencia del proveedor | La que aparece en la factura de compra. Estrictamente la que el proveedor usa en su sistema |
| 22 bis | Referencia OE | El cliente marcó dos controles con el número 22 (*"ERRORAZO, dos 22 jaja"*). El segundo es la referencia OE |
| 23, 24 | Código y nombre del producto | Según sistema. El cliente los usa como variables temporales para confirmar la carga del producto desde el cuadro 20. Deja a criterio del equipo si son necesarios |
| 26 | Costo sin IVA | Para importaciones será el mismo precio que muestra la factura |

### Controles descartados

| # | Estado |
|---|---|
| 2 | **Se elimina.** Se deja solo un control que haga lo del número 29 |
| 13 | Se elimina |
| 14 | *"Lo trabajaremos después"* |
| 15 | Descartado. Queda solo como encabezado del área donde está ubicado |

---

## 2. Control 25 — Cantidad. **Regla crítica**

Un proveedor puede facturar **el mismo producto dos veces en la misma factura con precio
distinto**, porque el cliente lo pidió en dos órdenes diferentes que se facturaron juntas.

Ejemplo del cliente:

```
Cant.   Nombre                                Precio    Subtotal
2       Pernos Hexagonales de 30x120 mm       5.50      11.00
5       Pernos Hexagonales de 30x120 mm       3.25      16.25
```

Regla textual:

> *"Cuando se guarden los datos en la tabla de los detalles de la compra, **no se sumarán
> los productos con mismo ID ni se promediará el precio**, si no que se guardarán los datos
> en la tabla tal cual la factura del proveedor. También deberá tomarse en cuenta para el
> historial de precio de este producto."*

**Consecuencias de diseño:**

1. El detalle de compra necesita **PK propia por línea**. No puede llevar
   `UNIQUE (idcompra, idprod)`.
2. Debe existir un **número de línea** para preservar el orden del documento original.
3. El historial de costos del producto debe admitir **varios precios de la misma factura**.
   La tabla `costos` actual es 1:1 con el producto (`idprod NOT NULL UNIQUE`), así que **no
   sirve** para este historial.

---

## 3. Control 19 (NUEVO) — Condición de IVA

Tipo de impuesto *"tal como viene documentado en la factura del proveedor"*.

| Valor | Definición del cliente |
|---|---|
| `GRAVADA` / `AFECTA` | Todos los productos afectados por el IVA |
| `EXENTO` | El proveedor vende un producto comercial normal, pero la ley lo liberó de IVA. En la factura aparece en la columna "Exentas" |
| `NO SUJETO` | Pagos sin relación con la ley del IVA: tasas municipales, aranceles estatales, etc. |
| `XCOMPROBAR` | *Gasto por comprobar*: pagos que **no alterarán el total FISCAL** de la operación, pero que se necesita documentar por control contable interno |

---

## 4. Control 29 (NUEVO) — Destino o naturaleza del registro

*"¿Qué es esto para la empresa?"*

| Valor | Definición del cliente |
|---|---|
| `INVENTARIO` | Producto que formará parte del inventario |
| `EXPRESS` | Producto que se guarda como registro de compra y venta posterior, **sin formar parte del inventario**, porque no estará en bodega más de un día |
| `ACTIVOS` | Equipo, herramientas y otros bienes duraderos que no se venden como inventario, sino de uso operativo de la empresa |
| `GASTOS` | Artículos de uso o consumo de la empresa. **Despliega opciones adicionales** (control 29.1) |

---

## 5. Control 29.1 (NUEVO) — Clasificación contable

> *"Este listado solo debe activarse o aparecer, y ser obligatorio, si en el Control 29 el
> usuario eligió la opción **Gastos** o **Activos**. Es una lista desplegable conectada a un
> catálogo de gastos contables."*

**Ejemplos para GASTOS:**

- Beneficios a empleados / Uniformes
- Servicios (Agua, Luz, Internet)
- Alquileres / Arrendamientos
- Papelería y Útiles de Oficina
- Mantenimiento y Reparaciones
- Impuestos y Tasas Municipales — *"ideal cuando el Selector 2 sea No Sujeto"*

**Ejemplos para ACTIVOS:**

- Equipo de Cómputo
- Mobiliario y Equipo de Oficina
- Vehículos

Presentación: *"pueden mostrarse en un recuadro flotante como pop-up que permita su
selección o bien un listado desplegable. Considerar la mejor opción."*

> *"Para cada caso habrá que crear una Tabla que contenga respectivamente los catálogos
> contables de compra. Los datos de catálogo se verán más adelante, pero pueden usar los
> ejemplos, por ahora por ser los más comunes."*

---

## 6. Control 30 (NUEVO) — Grid de líneas de la compra

Muestra los productos que ya forman parte de la lista de ingreso pero que aún no se han
guardado en el sistema.

### Columnas

| Columna | Detalle |
|---|---|
| `No.` | Número de línea. *"Es importante indicar en qué ubicación está cada registro de la compra en proceso, para guardar el registro de la manera más fiel posible al documento original"* |
| `Orden` | ID (caracteres) de la orden de trabajo. Viene del control 21. **Editable** |
| `Tipo` | Del control 29. **Editable** |
| `Referencia` | Referencia del proveedor, como él identifica el producto |
| `Descripción` | Nombre del producto tal cual aparece en inventario. **No editable** (ver nota) |
| `Cantidad` | Cantidad en ingreso |
| `Costo` | **Hasta 4 decimales.** Sin IVA para compras nacionales; tal cual la factura para internacionales. Aquí aparecen los valores marcados como AFECTAS/GRAVADAS en el control 19 |
| `Subtotal sin IVA` | |
| `IVA` | IVA del producto unitario |
| `Subtotal con IVA` | Suma del IVA y el costo, por cada producto |
| `Exento` | Valor exento unitario, según control 19 |
| `No sujeto` | Valor no sujeto unitario, según control 19 |
| `Descuento` | Valor del porcentaje del descuento |
| `Afectación` | Tipo de afectación fiscal o contable según control 19. Texto completo o abreviado |
| `Imagen` | Imagen pequeña que se expande al hacer clic y vuelve al estado normal con otro clic |

**Nota sobre `Descripción`:** el cliente razona que si se permite editar, habría que
propagar el cambio a la ficha del producto y registrarlo en el historial de cambios.
Concluye: *"Quizá lo mejor sería dejarlo sin posibilidad y mantener la fidelidad de lo que
muestre inventario."*

### Funciones del grid

- **Reordenar filas**, preferiblemente por arrastre. Mover la última línea al principio o a
  cualquier posición
- **Eliminar** la fila completa
- **Editar** cualquier dato individual, pero **pidiendo confirmación** para evitar cambios
  por error. *"Podría incluso agregarse un botón que habilite la edición de la celda
  seleccionada solamente, para mayor seguridad"*
- **Arrastrar y soltar** para ingreso rápido, principalmente de facturas electrónicas
- Considerar que algunas celdas tengan 2 o más opciones para aprovechar espacio

---

## 7. Tabla de comportamiento (ejemplo del cliente)

Casos que combinan los controles 19 y 29. IVA de El Salvador = 13%.

| No | Descripción | Cant | Costo | % Desc | Subtotal sin IVA | IVA | Precio c/IVA | Subtotal c/IVA | Condición IVA (19) | Destino (29) | Activo/Gasto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | JGO. DE ANILLOS | 6 | 20.00 | 0 | 120.00 | 2.60 | 22.60 | 135.60 | GRAVADA | INVENTARIO | |
| 2 | Acetaminofén 500 | 1 | 50.00 | 10 | 50.00 | — | — | — | EXENTO | GASTO | Medicamentos |
| 3 | Impuesto Municipal | 1 | 60.00 | 0 | 60.00 | — | — | — | NO SUJETO | GASTO | Imp. y Tasas Municipales |
| 4 | Pago de Flete Internacional | 1 | 1000.00 | 0 | 1000.00 | — | — | — | XCOMPROBAR | GASTO | Transporte de Mercancías |
| 5 | Batería 12V 180Amp | 2 | 100.00 | 5 | 200.00 | 13.00 | 113.00 | 226.00 | GRAVADA | EXPRESS | |
| 6 | Computadora de Escritorio | 1 | 600.00 | 0 | 600.00 | 78.00 | 678.00 | 678.00 | GRAVADA | ACTIVO | Equipo de cómputo |

### Verificación de los cálculos

Las líneas con descuento 0 cuadran perfecto:

- Línea 1: `6 × 20.00 = 120.00` · IVA unitario `20.00 × 13% = 2.60` · `22.60` · `6 × 22.60 = 135.60` ✔
- Línea 6: `600.00 × 13% = 78.00` · `678.00` ✔

### PREGUNTA 1 — el descuento no está aplicado

Las dos líneas con descuento **no lo reflejan** en el subtotal:

| Línea | Cant | Costo | % Desc | Subtotal que pone el cliente | Con descuento aplicado |
|---|---|---|---|---|---|
| 2 Acetaminofén | 1 | 50.00 | **10** | `50.00` | 45.00 |
| 5 Batería 12V | 2 | 100.00 | **5** | `200.00` | 190.00 |

El control 28 dice: *"se podrá indicar el valor porcentual del descuento que se ha aplicado
al valor unitario del producto que se está ingresando"* — el verbo en pasado sugiere que el
**costo ya viene descontado** y el porcentaje es solo informativo.

**A confirmar:** ¿el descuento se resta del subtotal o es informativo? Define si se guarda
solo `descuento_porcentaje`, o también `descuento_monto`, y cómo se calculan los totales.

---

## 8. Reglas fiscales declaradas

> *"Los registros que no sean GRAVADOS, no tendrán IVA obviamente. Los que se indiquen como
> **XCOMPROBAR, no serán parte de un total que afecte el IVA**. Formarán parte del total del
> documento, pero no deberán afectar el total fiscal que se presenta cada mes en hacienda.
> Esto queda pendiente de explicar mejor…"*

Esto implica **dos totales distintos** por documento: un **total fiscal** y un **total
contable**. El control 30 lo confirma: *"según cada caso habrá una afectación en el total
fiscal y el total contable"*.

---

## 9. Pendientes declarados por el cliente

Textual, en mayúsculas en el documento original:

> *"QUEDA PENDIENTE LOS TOTALES A MOSTRAR, EN QUÉ TABLAS SE GUARDARÁN LOS REGISTROS DE CADA
> DOCUMENTO Y EL ÁREA DE RETACEO Y USO PARA IMPORTACIONES, NOTA DE CRÉDITO Y SUJETO
> EXCLUIDO."*

Su idea inicial de estructura:

> *"Guardar lo que se usa mes a mes para el tema del IVA, Fiscalizable, en 2 tablas,
> **Compras1** para encabezados, fechas y datos de proveedor y **Compras2** para los detalles
> de los registros. Sin embargo se debe considerar no mezclar los datos que se usarán en
> «pagos por cuenta ajena» (XCOMPROBAR) para no sumar 2 veces mismos valores y que se
> afecten los totales finales de mes o de año en la contabilidad."*

---

## 10. Análisis de brechas para la base de datos

### Se puede definir al 100% con la información actual

| Tabla | Fuente |
|---|---|
| `proveedores` | Excel + capturas 1-4 |
| `proveedor_cuentas_bancarias` | Capturas 3-4 |
| `proveedor_contactos` | Captura 2 |
| `catalogo_contable` | Control 29.1 + ejemplos |
| `compras_detalle` (Compras2) | Control 30: las 15 columnas están completas |
| Condición IVA / Destino | Controles 19 y 29: valores cerrados |

### Bloqueantes

**B1. El encabezado (Compras1) nunca se especificó.** Solo dice *"encabezados, fechas y
datos de proveedor"*. Se infiere de los controles 1 a 12, pero faltan:

- **Fechas.** No menciona ninguna. ¿Fecha de emisión de la factura, de recepción, de ingreso
  al sistema? Al menos la de emisión es obligatoria para el control fiscal mensual.
- **Estados del documento.** El control 30 describe productos *"que aún no se ha ingresado"*,
  lo que implica un estado previo (borrador). Sin estados **no se sabe en qué momento la
  compra afecta inventario, costos y cuentas por pagar**. Es la decisión estructural más
  importante y no está definida.
- **Moneda y tipo de cambio.** Crítico para importaciones. La tabla `costos` ya tiene
  `costo_cambio_pagado` (costo real pagado al proveedor, distinto al tipo de cambio de
  aduana), así que ese dato tiene que nacer en la compra.

**B2. Totales.** Pendiente declarado. Falta la lista exacta a persistir en el encabezado:
total gravado, total exento, total no sujeto, total XCOMPROBAR, total IVA, total descuentos,
retenciones, total documento, **total fiscal** y **total contable**.

**B3. Retaceo de importaciones.** Pendiente declarado. Es el proceso que **produce
`costo_local`**. Falta definir:

- Qué gastos se prorratean: flete, seguro, aranceles/DAI, almacenaje, transporte interno
- Criterio de prorrateo: por valor FOB, por peso, por cantidad o por volumen
- Si se guardan en tabla aparte (ej. `compras_gastos_importacion`)

Dato relevante: el Excel de productos indica que el peso *"se guardará siempre en libras"*,
lo que sugiere que el prorrateo por peso es un criterio contemplado.

**B4. Nota de Crédito y Sujeto Excluido.** Son tipos de documento del control 1, pendientes.
La nota de crédito normalmente resta (devolución) y debe **revertir** inventario y costos.

**B5. Aranceles: no existe nada.** Verificado en todo el proyecto: **no hay campo
`codarancel` ni tabla `aranceles`**. El grid 20 pide mostrar **DAI y Código Arancelario**,
así que hoy esas dos columnas no tienen origen de datos. La tabla `Aranceles` está
especificada en el Excel del cliente (SAC de Aduana de El Salvador) pero no implementada.

**B6. Cuentas por Pagar: dependencia circular.** El control 12 exige registrar la condición
de crédito en Cuentas por Pagar. A su vez, el Excel pide que `saldo_actual` y `saldo_vencido`
del proveedor *"se traerán de Cuentas por Pagar"*. Ese módulo no existe ni está
especificado. **Mitigación aplicada:** los campos de saldo se crean en `proveedores` pero
quedan en 0 y solo de lectura hasta que exista el módulo.

**B7. Historial de costos con precios múltiples.** El control 25 exige guardar el mismo
producto dos veces con precios distintos y llevarlo al historial. `costos` es 1:1 con el
producto, así que no sirve. Se necesita una tabla de historial por línea de compra. Además,
la migración de `costos` sigue bloqueada por la contradicción de las filas 147/149 del Excel
(ver `actualizacion-tablas-cliente.md`).

**B8. Decimales inconsistentes.** El control 30 pide costo con **4 decimales**; `costos` usa
`DECIMAL(12,2)`. Hay que decidir dónde se redondea: probablemente el detalle de compras usa
`DECIMAL(14,4)` y se redondea a 2 al consolidar en `costos`.

**B9. Bancos / cajas chicas.** Control 4. El cliente ofrece crear solo la tabla. Faltan sus
campos.

### Módulos referenciados que no existen

| Referencia | Origen | Estado |
|---|---|---|
| Cuentas por Pagar | Control 12, saldos de proveedor | No existe ni especificado |
| Bancos / cajas chicas | Control 4 | No existe, campos sin definir |
| Aranceles (SAC) | Control 20 (DAI, cód. arancelario) | No existe |
| Órdenes de trabajo | Control 21 | **Sí existe**: `ordenes_trabajo.numero_orden VARCHAR(50)` |

---

## 11. Proveedores — especificación consolidada

Las 4 capturas del sistema actual del cliente cierran los huecos que dejó el Excel.
**Resuelven tres dudas abiertas:** usa solo **2 direcciones** (no 3), **2 contactos** fijos,
y las cuentas bancarias **sí** son tabla aparte.

### Pestaña GENERAL

Código (numérico, ej. `275`), Nombre, País, Dirección + Ciudad, Dirección 2 + Ciudad 2,
Teléfono, Fax, E-mail, Sitio Web, Términos/Comentarios (multilínea), Giro,
Reg. Fiscal (= NRC), NIT.

### Pestaña CONTACTOS

Dos bloques idénticos: Contacto, Puesto/Cargo, Tel, Móvil, Email.

### Pestaña CUENTAS

Selector `No CUENTA` con botones agregar / editar / eliminar — **varias cuentas por
proveedor**. Campos: Beneficiario, Moneda, Dirección, Banco, Dirección Banco,
Cód. ABA (USA), Cód. SWIFT/BIC, Cód. IBAN (Europa), Comentarios/Instrucciones.

Ejemplo real de la captura 4: proveedor italiano, moneda EURO, SWIFT `BNLIITRR`,
IBAN `IT13 A010 0536 5900 0000 0000 044`.

### Barra inferior (común a las 3 pestañas)

- **Proveedor aplica a:** Contribuyente / Gran Contribuyente
- **Límite** de crédito
- **¿Qué provee?:** Producto / Gasto / Prod. y Gasto
- **Incluir en catálogo** (casilla)

### Funciones de la ventana

| Función del sistema actual | Estado |
|---|---|
| Búsqueda por código, alias, nombre y NIT | Implementada (control 10.1) |
| Filtros por tipo (local/extranjero) y estado | Implementada |
| Navegación primero / anterior / siguiente / último | Implementada, con contador `n/total` |
| Enviar a Excel | Implementada con `xlsx`, exporta la lista filtrada |
| Imprimir | Implementada con `jspdf` + `jspdf-autotable`: ficha en PDF con generales, contactos y cuentas |
| Nuevo / Modificar / Eliminar | Implementada. Eliminar es baja lógica |
| Aviso de cambios sin guardar | Agregado (no estaba en el sistema original, evita perder ediciones) |
| "Ir a" con autocompletado | No implementado. El buscador con filtrado en vivo cumple la misma función |

### PREGUNTA 2 — formato del código de proveedor

| Fuente | Formato |
|---|---|
| Captura 1 | `275` — numérico correlativo |
| Excel | `PE0001` (extranjero) / `PL0005` (local) — tipado por origen |

**Decisión aplicada:** `codigo VARCHAR(20) UNIQUE` + campo `tipo_proveedor`
(`LOCAL` / `EXTRANJERO`). Se autogenera en formato `PL####` / `PE####` pero el campo admite
edición manual, de modo que los códigos numéricos actuales del cliente siguen siendo
válidos al migrar. **A confirmar con el cliente.**

### Decisiones de diseño aplicadas (a confirmar)

| Tema | Decisión | Motivo |
|---|---|---|
| Contactos | Tabla `proveedor_contactos` con campo de orden | La captura muestra 2, pero el Excel dice *"a veces tienen hasta 2 o tres números"*. La tabla cubre ambos casos sin migrar de nuevo |
| Direcciones | 2 bloques en línea dentro de `proveedores` | Es lo que el cliente usa realmente. La tabla estructurada de direcciones que sugiere el Excel (calle/número/ciudad/estado/país) queda diferida |
| Teléfonos y giros | Campos fijos, sin tablas aparte | El Excel lo plantea como duda, no como requisito. Se puede normalizar después sin romper nada |
| Saldos | Campos presentes, solo lectura, en 0 | Dependen de Cuentas por Pagar (B6) |
| Encabezado compras | Tabla `compras` mínima con estado `BORRADOR` | Fase 4 bloqueada (B1). Las líneas necesitan FK; se expandirá con fechas, totales y estados |
| Descuento en líneas | Se guarda `descuento_porcentaje` pero **no** se resta del subtotal | PREGUNTA 1 pendiente al cliente |

---

## 12. Orden de implementación

| Fase | Alcance | Estado |
|---|---|---|
| 1 | `proveedores` + contactos + cuentas bancarias, y su módulo con 3 pestañas | **En curso.** No depende de ningún pendiente |
| 2 | `catalogo_contable` (gastos y activos) con los datos de ejemplo | **Hecho** (02-09-2026). Migración `010`, API `/api/catalogo-contable`, módulo con pestañas Gastos/Activos |
| 3 | `compras_detalle` con PK por línea y `DECIMAL(14,4)` | **Hecho** (migración 011, APIs, UI líneas) |
| 4 | Encabezado, totales, estados | **Bloqueado** por B1 y B2 |
| 5 | Retaceo de importaciones | **Bloqueado** por B3 |
| 6 | Nota de crédito y sujeto excluido | **Bloqueado** por B4 |
| 7 | Aranceles, Cuentas por Pagar, Bancos | **Bloqueado**, sin especificación |

---

## Checklist de preguntas para el cliente

- [ ] **1.** ¿El descuento se resta del subtotal o es solo informativo? En su ejemplo no está aplicado
- [ ] **2.** ¿Código de proveedor numérico (`275`) o tipado (`PE0001`/`PL0005`)?
- [ ] **3.** ¿Qué fechas lleva el encabezado de la compra: emisión, recepción, ingreso?
- [ ] **4.** ¿Qué estados tiene una compra? ¿En qué momento afecta inventario, costos y cuentas por pagar?
- [ ] **5.** ¿Dónde se capturan moneda y tipo de cambio para importaciones?
- [ ] **6.** Lista exacta de totales a guardar, y la diferencia entre total fiscal y total contable
- [ ] **7.** Retaceo: ¿qué gastos se prorratean y con qué criterio (valor, peso, cantidad)?
- [ ] **8.** Reglas de Nota de Crédito y Sujeto Excluido
- [ ] **9.** ¿Se implementa la tabla de Aranceles (SAC) para poder mostrar DAI y código arancelario en el grid 20?
- [ ] **10.** Campos de la tabla de Bancos / cajas chicas
- [ ] **11.** ¿Costo con 4 decimales solo en compras, redondeando a 2 al pasar a `costos`?
