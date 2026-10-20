# Actualización de tablas — Especificación del cliente

**Fuente:** `nuevas tablas para sistemas (3).xlsx` (Hoja1, 199 filas)
**Analizado:** 30-08-2026
**Estado:** pendiente de confirmación del cliente. No se ha modificado código ni base de datos.

---

## Resumen

El archivo contiene la especificación global del sistema (~15 tablas). Tres secciones traen
fecha de actualización y son las novedades reales a implementar:

| Sección | Fecha en el archivo | Tipo | Filas |
|---|---|---|---|
| COSTOS | `01-03-2026` | Renombrado de campos sobre tabla existente | 137-150 |
| Proveedores | `21-07-2026` | Tabla nueva | 151-185 |
| Cuentas bancarias | — | Tabla nueva (auxiliar) | 186-198 |

El resto del documento describe el diseño general: productos, aranceles, materiales,
detalles eléctricos, dimensiones, marcas compatibles, productos relacionados, productos de
intercambio, precios, ajuste de precios, competidores, inventario físico, historial de
inventario e imágenes.

---

## 1. Tabla COSTOS — renombrado de campos

El cliente entrega un mapeo explícito nombre viejo -> nombre nuevo.
Comparación contra el esquema actual (`sql/crear_tabla_costos.sql:9-41`):

| Actual en BD | Pide el cliente | Tipo | Acción |
|---|---|---|---|
| `nofactura VARCHAR(50)` | `referencia_costo` | c(30) | Renombrar. **Reduce 50 -> 30** |
| — | `Nodocto` | — | **Agregar** (no existe) |
| `dt_compra DATE` | `fecha_referencia` | fecha+hora | Renombrar + **`DATE` -> `DATETIME`** |
| `costo` | `costo_usd` | n(12,2) | Renombrar |
| `costo_proveedor` | `costo_cambio_pagado` | n(12,2) | Renombrar |
| `costo_promedio` | `costo_promedio` | n(12,2) | Sin cambio |
| `costo_local` | `costo_local` | n(12,2) | Sin cambio |
| — | `costo_lclpromedio` | n(12,2) | **Agregar** |
| `costo_previo1` | `costo_previo1` | n(12,2) | Sin cambio de nombre |
| `costo_previo2` | `costo_previo2` | n(12,2) | Sin cambio de nombre |
| `costop_previo1` | `costolcl_previo1` | n(12,2) | Renombrar |
| `costop_previo2` | `costolcl_previo2` | n(12,2) | Renombrar |
| `iva_pagado` | *(no aparece en el doc)* | n(12,2) | Mantener |
| `idcosto`, `created_at`, `updated_at` | *(no aparecen)* | — | Mantener |

### Significado de cada campo según el cliente

- `referencia_costo` — número o código de la factura de la que se obtuvo el costo.
- `Nodocto` — número de documento al que pertenece la factura o referencia de costo.
- `fecha_referencia` — fecha **y hora** de la factura o referencia de costo.
- `costo_usd` — costo según la factura de la compra más reciente, siempre en dólares.
  *No confundir con costo promedio.*
- `costo_cambio_pagado` — costo real pagado al proveedor. Se guarda aparte porque el tipo
  de cambio que asigna aduana no suele ser el mismo que se pagó al proveedor.
- `costo_promedio` — resultado de sumar cantidades y costos existentes con los de la compra
  en proceso.
- `costo_local` — costo con todos los gastos y cargos de compra y transporte hasta bodega.
- `costo_lclpromedio` — igual que el costo promedio, pero calculado sobre el costo local.

### Regla de rotación de respaldos

El cliente describe una rotación en cascada: al registrar una compra, el valor vigente pasa
a `_previo1`, y el que estaba en `_previo1` pasa a `_previo2`.

### PREGUNTA 1 (bloqueante) — contradicción en los respaldos

Las filas 147 y 149 se contradicen. Ambas dicen respaldar `costo_local`:

- **Fila 147**, `costo_previo1`: *"servirán como posible respaldo ante un fallo del campo
  costo local. Almacenará el costo anterior que tenía costo local antes de la compra más
  reciente y pasará su valor a costo_previo2."*
- **Fila 149**, `costolcl_previo1`: *"Harán lo mismo que los campos costo_previo1 y
  costo_previo2, pero con los valores respectivos del costo local."*

Si ambos pares respaldan `costo_local`, entonces `costo_usd` queda sin respaldo y los dos
pares quedan duplicados.

**Interpretación probable** (a confirmar, NO implementada):

- `costo_previo1` / `costo_previo2` -> respaldo de **`costo_usd`**
- `costolcl_previo1` / `costolcl_previo2` -> respaldo de **`costo_local`**

Motivo: los nombres lo sugieren (`lcl` = local) y así cada costo tiene su propio historial.
Se presume que la fila 147 dice "costo local" por un error de copiado.

> No se implementa hasta confirmación: son datos contables y cruzarlos invalidaría el
> historial de costos.

### PREGUNTA 2 — `referencia_costo` de 50 a 30 caracteres

El campo actual `nofactura` es `VARCHAR(50)`; el cliente pide 30. Reducirlo truncaría
facturas ya registradas que superen 30 caracteres.

**Verificar antes de migrar:**

```sql
SELECT COUNT(*) FROM costos WHERE CHAR_LENGTH(nofactura) > 30;
```

Si devuelve 0, la reducción es segura. Si no, conviene dejarlo en 50.

### PREGUNTA 3 — tipo de `Nodocto`

El cliente no indica tipo ni tamaño. Por la descripción ("referencia del número de
documento") se asume texto. **Falta definir longitud.**

### PREGUNTA 4 — `iva_pagado`

Existe en la BD pero no aparece en la especificación nueva. Se asume que se mantiene.
Confirmar que no se eliminó a propósito.

### Impacto en código

| Archivo | Detalle |
|---|---|
| `app/api/costos/route.ts` | Usa los nombres viejos en ~25 puntos (líneas 61-134) |
| `app/dashboard/inventario/costos/page.tsx` | Formulario y visualización de costos |
| `app/api/importar-costos/` | Importación masiva desde Excel |
| `sql/crear_tabla_costos.sql` | Definición, trigger `tr_productos_after_insert_costos`, procedimiento `sp_actualizar_costo`, vista `v_costos_productos` |

El procedimiento `sp_actualizar_costo` y la vista `v_costos_productos` deben recrearse
después del renombrado.

---

## 2. Tabla Proveedores (nueva) — `21-07-2026`

### Identificación

| Campo | Notas del cliente |
|---|---|
| ID o código | Prefiere ID tipado por clase de proveedor: `PE0001` (extranjero), `PL0005` (local/nacional). Acepta incremental. |
| Nombre Legal | Nombre inscrito en su país |
| Nombre Comercial | A veces distinto del legal |
| Alias | Para búsquedas. Ej: `LCR` = La Casa del Repuesto |

### Contacto y ubicación

| Campo | Notas |
|---|---|
| Dirección | Ver PREGUNTA 5 |
| Teléfono principal oficinas | Mínimo 20 caracteres |
| Teléfono secundario | |
| Correo electrónico | Principal |
| Giro | Ver PREGUNTA 6 |

### Datos fiscales

| Campo | Notas |
|---|---|
| Número de registro tributario o comercial (NIT) | *"No deben estar condicionados ni limitados a los únicos documentos que usamos en el país, como el NIT"* — debe admitir formatos extranjeros |
| NRC | Dato típico solo para proveedores del país |
| Categoría de contribuyente nacional | Grande / Mediano / otro. Ligado al cálculo de retenciones en compras |

### Contactos

Dos bloques repetidos (1 y 2), cada uno con: nombre, número telefónico, email, puesto/cargo.

### Financiero

| Campo | Notas |
|---|---|
| Saldo actual | Saldo de crédito del mes. Se actualiza desde Cuentas por Pagar |
| Límite de crédito USD | Siempre en dólares |
| Saldo vencido | Monto vencido según fecha de pago. También viene de Cuentas por Pagar |

### Otros

| Campo | Notas |
|---|---|
| Comentarios | Texto con saltos de línea y tabulaciones. *"Posiblemente se requieran más de 1000 caracteres"* |
| ¿Parte de inventario? | Indica si los productos de este proveedor entran al catálogo de productos a ofrecer. Sirve para reportes de catálogos |

### PREGUNTA 5 — tabla de direcciones aparte

El cliente lo plantea como duda abierta (filas 156-165):

> *"Algunos proveedores suelen tener hasta 3 direcciones: dirección de facturación,
> dirección de entrega, dirección de almacén. Quizá sea considerable crear una tabla de
> direcciones para proveedores y clientes, por si acaso. La misma tabla podría servir para
> ambos."*

Estructura que pide para direcciones modernas (sitios de compra y envíos):

- Calle — calles, avenidas, edificios, colonias
- Número — casa, apartamento, bodega
- Ciudad
- Estado — en El Salvador, departamento
- País

Nota del cliente: *"No sé si vecindario o cantón sea necesario, creo que queda en la columna de calle."*

**A decidir:** ¿tabla `direcciones` compartida proveedores/clientes con tipo de dirección, o
3 bloques de campos fijos dentro de `proveedores`?

### PREGUNTA 6 — tabla de teléfonos y tabla de giros

El cliente sugiere ambas pero no decide:

- *"Consideren una tabla de números telefónicos de proveedores y clientes también."*
- *"No sé si van a crear una tabla de los giros para solo llamar y mostrar y asignar el giro
  a clientes y proveedores solamente."*

Además, sobre los contactos: *"no sé si sería mejor crear una tabla adicional para este tipo
de datos también. Contactos de proveedores o de empresas. A veces tienen hasta 2 o tres
números."*

**A decidir:** normalizar (tablas `telefonos`, `giros`, `contactos`) o mantener campos fijos.

---

## 3. Tabla Cuentas bancarias (nueva, auxiliar)

Regla explícita del cliente (fila 198):

> *"Un mismo proveedor o cliente puede tener muchas cuentas diferentes, por eso debe ser una
> tabla que las registre y vincule."*

| Campo | Notas |
|---|---|
| ID de cuenta | Puede ser solo incremental |
| Número de cuenta | *"Es una cadena de texto casi siempre más números, pero suelen haber países que usan de todo"* — debe ser texto |
| Nombre del beneficiario | Nombre de la empresa según registro en su banco |
| Dirección | La del beneficiario |
| Nombre del banco | |
| Dirección de banco | |
| Código ABA | Mínimo 20 caracteres. Casi solo para USA |
| Código SWIFT / BIC | Mínimo 20 caracteres. Mundial |
| Código IBAN | *"Casi siempre es el mismo número de cuenta, pero suelen agregarle caracteres antes"* |
| Moneda | Indicativo de la moneda en que se recibe dinero |
| Comentarios | Texto abierto, como en proveedores |

### PREGUNTA 7 — vínculo polimórfico

La tabla debe vincularse tanto a **proveedores** como a **clientes**.

**A decidir:** ¿`tipo_entidad` + `id_entidad` (polimórfico), o dos FK nullables
(`idproveedor`, `idcliente`)? La segunda permite integridad referencial real.

---

## 4. Campos marcados con `*` en la tabla PRODUCTOS

En la sección de productos el cliente marcó varios campos con `*`, algunos con instrucción
de renombrar. **No traen fecha**, así que no está claro si son parte de esta actualización o
del diseño original.

| Fila | Campo | Instrucción |
|---|---|---|
| 7 | `nombre *` | varchar(60) |
| 16 | `estilo * tipo` | — |
| 20 | `idcategoria *` | **verificar tamaño, aumentar a 10** (hoy c(6)) |
| 21 | `codigo barras o qr *` | Cualquiera de los dos que sirva para identificar |
| 22 | `info acerca del item *` | **renombrar a `Observa2`** — info reservada, multilínea |
| 23 | `info publica del item *` | Igual que anterior pero mostrable al cliente (tienda en línea) |
| 24 | `info referencias directas *` | **renombrar a `Observa`** — OE, OEMs, números originales de fabricantes |
| 25 | `info referencias indirectas *` | Referencias de reemplazo. *Puede anularse si se usa la tabla "productos intercambio"* |
| 27 | `stock contable *` | alias `existencia` |
| 28 | `stock fisico *` | alias `stock2` |

### PREGUNTA 8

¿Los campos marcados con `*` en productos entran en esta actualización o quedan para
después? En particular:

- `idcategoria` de 6 a 10 caracteres: afecta el sistema jerárquico
  categoría/grupo/subgrupo ya implementado en `migrations/007_sistema_categorias_jerarquico.sql`.
- Los renombrados a `Observa` / `Observa2` van en dirección contraria a nombres
  descriptivos. Confirmar que el cliente realmente los quiere así.

---

## Orden de implementación propuesto

1. **COSTOS** — resolver PREGUNTAS 1-4, luego migración `009` + adaptar
   `app/api/costos/route.ts`, `costos/page.tsx`, `importar-costos`, y recrear
   `sp_actualizar_costo` y `v_costos_productos`.
2. **Proveedores** — resolver PREGUNTAS 5-6 (normalizar o no) antes de crear la tabla, para
   no migrar dos veces.
3. **Cuentas bancarias** — resolver PREGUNTA 7. Depende de que exista `proveedores`.
4. **Productos** — resolver PREGUNTA 8.

Las tablas sin fecha del documento (aranceles, materiales, marcas compatibles, productos
relacionados/intercambio, competidores, inventario físico, historial de inventario,
imágenes) quedan fuera de este alcance hasta que el cliente las priorice.

---

## Checklist de preguntas para el cliente

- [ ] **1.** ¿`costo_previo1/2` respalda `costo_usd` y `costolcl_previo1/2` respalda `costo_local`? *(bloqueante)*
- [ ] **2.** ¿Reducir `referencia_costo` a 30 caracteres, o mantener 50?
- [ ] **3.** ¿Tipo y longitud de `Nodocto`?
- [ ] **4.** ¿Se mantiene `iva_pagado` en la tabla costos?
- [ ] **5.** ¿Tabla `direcciones` compartida proveedores/clientes, o campos fijos?
- [ ] **6.** ¿Tablas aparte para teléfonos, giros y contactos, o campos fijos?
- [ ] **7.** ¿Cómo se vincula `cuentas_bancarias` a proveedores y clientes?
- [ ] **8.** ¿Los campos `*` de productos entran ahora? ¿Confirma `Observa` / `Observa2`?
- [ ] **9.** ¿Los IDs de proveedor son tipados (`PE0001` / `PL0005`) o incrementales?
