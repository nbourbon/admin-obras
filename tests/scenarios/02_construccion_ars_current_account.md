# Escenario 02 — Construcción · Moneda ARS · Solo Aportes a Caja

## Setup

| Dato | Valor |
|------|-------|
| Proyecto | "Construcción Edificio ARS" |
| Moneda | ARS (solo pesos, sin tipo de cambio) |
| Modo de contribución | `current_account` |
| `total_area_m2` | 2.000 m² |
| Usuario 1 | 70% — admin del proyecto |
| Usuario 2 | 30% |

> **Versión ARS-only del Escenario 01.**
> Se usan exactamente los mismos montos en ARS que en el Escenario 01 DUAL.
> No hay tipo de cambio: todos los balances se almacenan y muestran en ARS.
> No hay Paso 7 (el TC es irrelevante en este modo).

---

## Nomenclatura

- **caja** = `total_balance_ars` (suma de saldos ARS de todos los miembros)
- **saldo U1 / U2** = `balance_aportes_ars` (saldo individual en ARS, restando aportes pendientes)
- **gastado** = `total_paid_ars` (lo que ya se le imputó al usuario como gasto proporcional)

Los saldos son **positivos** cuando el usuario tiene crédito y **negativos** cuando tiene deuda.

---

## Pasos y estado esperado

### Paso 0 — Estado inicial

Todo en cero.

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | 0 |
| Caja | 0 |
| U1 saldo | 0 |
| U2 saldo | 0 |

---

### Paso 1 — Gasto 1: ARS 213.750 — Usuario 1 paga

- Gasto ARS 213.750 (equivale al USD 150 del Escenario 01)
- **Pagador**: Usuario 1 → aporte unilateral `is_unilateral=True`, `amount_ars=213.750`
- Auto-pagado en modo `current_account`

**Imputación:**

| Usuario | Crédito | Débito (proporción) | Saldo neto |
|---------|--------:|--------------------:|-----------:|
| U1 | +213.750 | −149.625 (70%) | **+64.125** |
| U2 | 0 | −64.125 (30%) | **−64.125** |
| Caja | | | **0** |

**Total gastos ARS:** 213.750 | **Gasto x m²:** 106,88 ARS/m²

---

### Paso 2 — Gasto 2: ARS 53.000 — Usuario 2 paga

- Gasto ARS 53.000
- **Pagador**: Usuario 2 → aporte unilateral `amount_ars=53.000`

**Imputación:**

| Usuario | Crédito | Débito (proporción) | Saldo neto |
|---------|--------:|--------------------:|-----------:|
| U1 | 0 | −37.100 (70%) | **+27.025** |
| U2 | +53.000 | −15.900 (30%) | **−27.025** |
| Caja | | | **0** |

**Total gastos ARS:** 266.750 | **Gasto x m²:** 133,38 ARS/m²

---

### Paso 3a — Solicitud grupal ARS 500.000 creada

- Admin crea solicitud. Los aportes unilaterales del Paso 1 y 2 se absorben.
- U1 amount_due: 350.000 | offset: 213.750 | **restante: 136.250 ARS**
- U2 amount_due: 150.000 | offset: 53.000 | **restante: 97.000 ARS**

Balance sin cambio (solicitud pendiente descuenta del saldo mostrado):

| Métrica | Valor |
|---------|------:|
| U1 saldo (con pendiente) | +27.025 − 136.250 = **−109.225** |
| U2 saldo (con pendiente) | −27.025 − 97.000 = **−124.025** |

---

### Paso 3b — Usuario 1 paga su cuota neta ARS 136.250 (auto-aprobado como admin)

- `amount_paid=136.250`, `currency_paid=ARS`
- U1.balance_ars += 136.250 → **163.275**

| Métrica | Valor |
|---------|------:|
| Caja | 163.275 + (−27.025) = **136.250** |
| U1 saldo | **+163.275** |
| U2 saldo (pendiente) | −27.025 − 97.000 = **−124.025** |

---

### Paso 3c — Usuario 2 paga ARS 97.000 → admin aprueba

- U2.balance_ars += 97.000 → **69.975**

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | 266.750 |
| Gasto x m² | 133,38 ARS/m² |
| Caja | **233.250** |
| U1 saldo | **+163.275** |
| U2 saldo | **+69.975** |

---

### Paso 4 — Gasto 3: ARS 100.000 desde caja

- Gasto ARS 100.000, sin pagadores (la caja alcanza: 233.250 ≥ 100.000)
- Deducción: U1 −70.000 → 93.275 | U2 −30.000 → 39.975

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | 366.750 |
| Gasto x m² | 183,38 ARS/m² |
| Caja | **133.250** |
| U1 saldo | **+93.275** |
| U2 saldo | **+39.975** |

---

### Paso 5a — Solicitud grupal ARS 700.000 creada

- U1 amount_due: 490.000 | offset: 0 | **restante: 490.000 ARS**
- U2 amount_due: 210.000 | offset: 0 | **restante: 210.000 ARS**

Balance con pendiente (descuenta del saldo mostrado):

| Métrica | Valor |
|---------|------:|
| U1 saldo (con pendiente) | 93.275 − 490.000 = **−396.725** |
| U2 saldo (con pendiente) | 39.975 − 210.000 = **−170.025** |

---

### Paso 5x — Gasto 4: ARS 30.000 desde caja

- Caja previa: 133.250 ≥ 30.000 ✓ — sin pagadores
- Deducción: U1 −21.000 → 72.275 | U2 −9.000 → 30.975

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | 396.750 |
| Gasto x m² | 198,38 ARS/m² |
| Caja | **103.250** |
| U1 saldo (con pendiente) | 72.275 − 490.000 = **−417.725** |
| U2 saldo (con pendiente) | 30.975 − 210.000 = **−179.025** |

---

### Paso 5b — Usuario 1 paga ARS 490.000 (auto-aprobado como admin)

- U1.balance_ars += 490.000 → **562.275**

| Métrica | Valor |
|---------|------:|
| Caja | **593.250** |
| U1 saldo | **+562.275** |
| U2 saldo (con pendiente) | 30.975 − 210.000 = **−179.025** |

---

### Paso 5c — Usuario 2 paga ARS 210.000 → admin aprueba

- U2.balance_ars += 210.000 → **240.975**

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | 396.750 |
| Gasto x m² | 198,38 ARS/m² |
| Caja | **803.250** |
| U1 saldo | **+562.275** |
| U2 saldo | **+240.975** |

---

### Paso 6 — Gasto 5: ARS 142.500 con pagadores parciales

- Gasto ARS 142.500 (equivale al USD 100 del Escenario 01)
- Pagadores: U1 paga ARS 114.000 | U2 paga ARS 14.250 | caja paga ARS 14.250

**Flujo:**

| Paso | U1.balance_ars | U2.balance_ars |
|------|---------------:|---------------:|
| Antes | 562.275 | 240.975 |
| Unilateral U1 +114.000 | 676.275 | 240.975 |
| Unilateral U2 +14.250 | 676.275 | 255.225 |
| Deducción U1 −99.750 (70%) | 576.525 | 255.225 |
| Deducción U2 −42.750 (30%) | 576.525 | 212.475 |

| Métrica | Valor |
|---------|------:|
| Gastos totales ARS | **539.250** |
| Gasto x m² | **269,63 ARS/m²** |
| Caja | **789.000** |
| U1 saldo | **+576.525** |
| U2 saldo | **+212.475** |
| U1 gastado | **377.475** ARS |
| U2 gastado | **161.775** ARS |

*(No hay Paso 7: el tipo de cambio no existe en modo ARS.)*

---

## Tabla resumen de estados

| Paso | Acción | Caja (ARS) | U1 saldo (ARS) | U1 gastado (ARS) | U2 saldo (ARS) | U2 gastado (ARS) |
|------|--------|----------:|---------------:|-----------------:|---------------:|-----------------:|
| 0  | Estado inicial                              | 0         | 0          | 0       | 0          | 0       |
| 1  | Gasto 1 ARS 213.750 (U1 paga)               | 0         | +64.125    | 149.625 | −64.125    | 64.125  |
| 2  | Gasto 2 ARS 53.000 (U2 paga)                | 0         | +27.025    | 186.725 | −27.025    | 80.025  |
| 3a | Solicitud grupal ARS 500.000 creada         | 0         | −109.225⚠  | 186.725 | −124.025⚠  | 79.025  |
| 3b | U1 paga cuota neta ARS 136.250              | 136.250   | +163.275   | 186.725 | −124.025⚠  | 79.025  |
| 3c | U2 paga cuota neta ARS 97.000               | 233.250   | +163.275   | 186.725 | +69.975    | 79.025  |
| 4  | Gasto 3 ARS 100.000 desde caja              | 133.250   | +93.275    | 256.725 | +39.975    | 110.025 |
| 5a | Solicitud grupal ARS 700.000 creada         | 133.250   | −396.725⚠  | 256.725 | −170.025⚠  | 109.025 |
| 5x | Gasto 4 ARS 30.000 desde caja              | 103.250   | −417.725⚠  | 277.725 | −179.025⚠  | 119.025 |
| 5b | U1 paga ARS 490.000                         | 593.250   | +562.275   | 277.725 | −179.025⚠  | 119.025 |
| 5c | U2 paga ARS 210.000                         | 803.250   | +562.275   | 277.725 | +240.975   | 119.025 |
| 6  | Gasto 5 ARS 142.500 (U1 $114K, U2 $14,25K) | 789.000   | +576.525   | 377.475 | +212.475   | 161.775 |

> ⚠ Saldo negativo = deuda (solicitud de aporte pendiente de pago)

---

## Notas de redondeo

- No hay redondeo por tipo de cambio: todos los montos son ARS exactos.
- El campo `total_paid_ars` acumula la porción proporcional de cada gasto imputada a cada usuario (no lo que pagan en efectivo sino su cuota).
- `balance_aportes_ars` = `member.balance_ars` − (suma de cuotas de solicitudes pendientes sin pagar).
