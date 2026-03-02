# Escenario 03 — Construcción · Moneda USD · Solo Aportes a Caja

## Setup

| Dato | Valor |
|------|-------|
| Proyecto | "Construcción Edificio USD" |
| Moneda | USD (solo dólares, sin tipo de cambio) |
| Modo de contribución | `current_account` |
| `total_area_m2` | 2.000 m² |
| Usuario 1 | 70% — admin del proyecto |
| Usuario 2 | 30% |

> **Versión USD-only del Escenario 01.**
> Los montos en USD son los equivalentes del Escenario 01 DUAL con TC=1.425:
> - Montos originalmente en USD → mismo valor
> - Montos originalmente en ARS → divididos por 1.425 y redondeados a 2 decimales
> No hay tipo de cambio: todos los balances se almacenan y muestran en USD.
> No hay Paso 7 (el TC es irrelevante en este modo).

---

## Equivalencias de montos

| Monto original (S01) | Monto en USD-only |
|---------------------|------------------:|
| USD 150 (G1) | USD 150,00 |
| ARS 53.000 (G2) ÷ 1.425 | USD 37,19 |
| ARS 500.000 (Solicitud 1) ÷ 1.425 | USD 350,88 |
| ARS 100.000 (G3) ÷ 1.425 | USD 70,18 |
| ARS 700.000 (Solicitud 2) ÷ 1.425 | USD 490,88 |
| ARS 30.000 (G4) ÷ 1.425 | USD 21,05 |
| USD 100 (G5) | USD 100,00 |

---

## Nomenclatura

- **caja** = `total_balance_usd` (suma de saldos USD de todos los miembros)
- **saldo U1 / U2** = `balance_aportes_usd` (saldo individual en USD, restando aportes pendientes)
- **gastado** = `total_paid_usd` (lo que ya se le imputó al usuario como gasto proporcional)

Los saldos son **positivos** cuando el usuario tiene crédito y **negativos** cuando tiene deuda.

---

## Pasos y estado esperado

### Paso 0 — Estado inicial

Todo en cero.

---

### Paso 1 — Gasto 1: USD 150,00 — Usuario 1 paga

- **Pagador**: Usuario 1 → aporte unilateral `is_unilateral=True`, `amount_usd=150`

| Usuario | Crédito | Débito (proporción) | Saldo neto |
|---------|--------:|--------------------:|-----------:|
| U1 | +150,00 | −105,00 (70%) | **+45,00** |
| U2 | 0 | −45,00 (30%) | **−45,00** |
| Caja | | | **0** |

**Total gastos USD:** 150,00 | **Gasto x m²:** 0,08 USD/m²

---

### Paso 2 — Gasto 2: USD 37,19 — Usuario 2 paga

- **Pagador**: Usuario 2 → aporte unilateral `amount_usd=37.19`
- Deducción U1 (70%): 37,19 × 0,70 = 26,033 → **26,03** USD
- Deducción U2 (30%): 37,19 × 0,30 = 11,157 → **11,16** USD
- Suma: 26,03 + 11,16 = 37,19 ✓

| U1.balance_usd | U2.balance_usd |
|---------------:|---------------:|
| 45 − 26,03 = **+18,97** | (−45 + 37,19) − 11,16 = **−18,97** |

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | 187,19 |
| Gasto x m² | 0,09 USD/m² |
| Caja | **0** |
| U1 saldo | **+18,97** |
| U2 saldo | **−18,97** |

---

### Paso 3a — Solicitud grupal USD 350,88 creada

- U1 amount_due_usd = 350,88 × 0,70 = 245,616 → **245,62**
- U2 amount_due_usd = 350,88 × 0,30 = 105,264 → **105,26**
- Suma: 245,62 + 105,26 = 350,88 ✓

Absorción:
- U1: offset=150,00 (unilateral G1) | **restante: 95,62 USD**
- U2: offset=37,19 (unilateral G2) | **restante: 68,07 USD**

Con solicitud pendiente:
- U1 saldo = 18,97 − 95,62 = **−76,65**
- U2 saldo = −18,97 − 68,07 = **−87,04**

---

### Paso 3b — Usuario 1 paga su cuota neta USD 95,62 (auto-aprobado como admin)

- U1.balance_usd += 95,62 → **114,59**

| Caja | U1 saldo | U2 saldo (pendiente) |
|-----:|--------:|---------------------:|
| 114,59 + (−18,97) = **95,62** | **+114,59** | −18,97 − 68,07 = **−87,04** |

---

### Paso 3c — Usuario 2 paga USD 68,07 → admin aprueba

- U2.balance_usd += 68,07 → **49,10**

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | 187,19 |
| Gasto x m² | 0,09 USD/m² |
| Caja | **163,69** |
| U1 saldo | **+114,59** |
| U2 saldo | **+49,10** |

---

### Paso 4 — Gasto 3: USD 70,18 desde caja

- Caja previa: 163,69 ≥ 70,18 ✓ — sin pagadores
- Deducción U1 (70%): 70,18 × 0,70 = 49,126 → **49,13**
- Deducción U2 (30%): 70,18 × 0,30 = 21,054 → **21,05**
- Suma: 49,13 + 21,05 = 70,18 ✓

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | 257,37 |
| Gasto x m² | 0,13 USD/m² |
| Caja | **93,51** |
| U1 saldo | **+65,46** |
| U2 saldo | **+28,05** |

---

### Paso 5a — Solicitud grupal USD 490,88 creada

- U1 amount_due_usd = 490,88 × 0,70 = 343,616 → **343,62**
- U2 amount_due_usd = 490,88 × 0,30 = 147,264 → **147,26**
- Suma: 343,62 + 147,26 = 490,88 ✓
- Sin absorción (no hay unilaterales recientes)

Con solicitud pendiente:
- U1 saldo = 65,46 − 343,62 = **−278,16**
- U2 saldo = 28,05 − 147,26 = **−119,21**

---

### Paso 5x — Gasto 4: USD 21,05 desde caja

- Caja previa: 93,51 ≥ 21,05 ✓ — sin pagadores
- Deducción U1 (70%): 21,05 × 0,70 = 14,735 → **14,74** → corrección: **14,73** (suma 14,73+6,32=21,05 ✓)
- Deducción U2 (30%): 21,05 × 0,30 = 6,315 → **6,32**

> **Corrección de redondeo**: 14,74 + 6,32 = 21,06 ≠ 21,05 → U1 pierde 0,01 → **14,73**

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | 278,42 |
| Gasto x m² | 0,14 USD/m² |
| Caja | **72,46** |
| U1 saldo (con pendiente) | 50,73 − 343,62 = **−292,89** |
| U2 saldo (con pendiente) | 21,73 − 147,26 = **−125,53** |

---

### Paso 5b — Usuario 1 paga USD 343,62 (auto-aprobado como admin)

- U1.balance_usd += 343,62 → **394,35**

| Métrica | Valor |
|---------|------:|
| Caja | **416,08** |
| U1 saldo | **+394,35** |
| U2 saldo (pendiente) | 21,73 − 147,26 = **−125,53** |

---

### Paso 5c — Usuario 2 paga USD 147,26 → admin aprueba

- U2.balance_usd += 147,26 → **168,99**

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | 278,42 |
| Gasto x m² | 0,14 USD/m² |
| Caja | **563,34** |
| U1 saldo | **+394,35** |
| U2 saldo | **+168,99** |

---

### Paso 6 — Gasto 5: USD 100,00 con pagadores parciales

- Pagadores: U1 paga USD 80 | U2 paga USD 10 | caja paga USD 10

**Flujo:**

| Paso | U1.balance_usd | U2.balance_usd |
|------|---------------:|---------------:|
| Antes | 394,35 | 168,99 |
| Unilateral U1 +80 | 474,35 | 168,99 |
| Unilateral U2 +10 | 474,35 | 178,99 |
| Deducción U1 −70 (70%) | 404,35 | 178,99 |
| Deducción U2 −30 (30%) | 404,35 | 148,99 |

| Métrica | Valor |
|---------|------:|
| Gastos totales USD | **378,42** |
| Gasto x m² | **0,19 USD/m²** |
| Caja | **553,34** |
| U1 saldo | **+404,35** |
| U2 saldo | **+148,99** |
| U1 gastado | **264,89** USD |
| U2 gastado | **113,53** USD |

*(No hay Paso 7: el tipo de cambio no existe en modo USD.)*

---

## Tabla resumen de estados

| Paso | Acción | Caja (USD) | U1 saldo (USD) | U1 gastado (USD) | U2 saldo (USD) | U2 gastado (USD) |
|------|--------|----------:|---------------:|-----------------:|---------------:|-----------------:|
| 0  | Estado inicial                              | 0       | 0        | 0      | 0        | 0      |
| 1  | Gasto 1 USD 150 (U1 paga)                   | 0       | +45,00   | 105,00 | −45,00   | 45,00  |
| 2  | Gasto 2 USD 37,19 (U2 paga)                 | 0       | +18,97   | 131,03 | −18,97   | 56,16  |
| 3a | Solicitud USD 350,88 creada                 | 0       | −76,65⚠  | 131,03 | −87,04⚠  | 56,16  |
| 3b | U1 paga cuota neta USD 95,62                | 95,62   | +114,59  | 131,03 | −87,04⚠  | 56,16  |
| 3c | U2 paga cuota neta USD 68,07                | 163,69  | +114,59  | 131,03 | +49,10   | 56,16  |
| 4  | Gasto 3 USD 70,18 desde caja                | 93,51   | +65,46   | 180,16 | +28,05   | 77,21  |
| 5a | Solicitud USD 490,88 creada                 | 93,51   | −278,16⚠ | 180,16 | −119,21⚠ | 77,21  |
| 5x | Gasto 4 USD 21,05 desde caja               | 72,46   | −292,89⚠ | 194,89 | −125,53⚠ | 83,53  |
| 5b | U1 paga USD 343,62                          | 416,08  | +394,35  | 194,89 | −125,53⚠ | 83,53  |
| 5c | U2 paga USD 147,26                          | 563,34  | +394,35  | 194,89 | +168,99  | 83,53  |
| 6  | Gasto 5 USD 100 (U1 $80, U2 $10, caja $10) | 553,34  | +404,35  | 264,89 | +148,99  | 113,53 |

> ⚠ Saldo negativo = deuda (solicitud de aporte pendiente de pago)

---

## Notas de redondeo

- **Corrección en Gasto 4 (USD 21,05)**: U1 recibe 14,73 (no 14,74) para que la suma sea exacta.
- Los balances `caja`, `U1 saldo` y `U2 saldo` difieren ligeramente respecto al Escenario 01 DUAL (±0,30 USD) por la diferencia entre operar directamente en USD vs operar en ARS y dividir por TC.
- Los campos `total_paid_usd` y `total_expenses_usd` son **idénticos** al Escenario 01, ya que los gastos en USD se almacenan directamente con los mismos valores.
