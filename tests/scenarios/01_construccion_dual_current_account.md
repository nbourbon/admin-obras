# Escenario 01 — Construcción · Moneda DUAL · Solo Aportes a Caja

## Configuración del proyecto

| Parámetro | Valor |
|-----------|-------|
| Tipo | construccion |
| Moneda | DUAL |
| Modalidad aportes | current_account |
| Superficie | 2.000 m² |
| TC fijo (override en todos los gastos) | 1.425 ARS/USD |

## Participantes

| Usuario | Participación |
|---------|:-------------:|
| Usuario 1 | 70% |
| Usuario 2 | 30% |

## Estado inicial

| Indicador | Valor |
|-----------|------:|
| Total gastos | USD 0 |
| Caja general | USD 0 |
| Saldo Usuario 1 | USD 0 |
| Saldo Usuario 2 | USD 0 |

---

## PASO 1 — Gasto USD 150, paga Usuario 1

**Acción:**
El admin crea un gasto de USD 150. La caja tiene saldo 0 → el sistema requiere indicar quién paga.
Se indica que **Usuario 1 paga USD 150 en su totalidad**.

**Lógica interna:**
1. Se crea aporte unilateral automático para Usuario 1: **USD 150** (ARS 213.750)
2. La caja queda en USD 150 suficiente para cubrir el gasto
3. El gasto se distribuye proporcionalmente y se deduce de cada balance:
   - Usuario 1 (70%): −USD 105,00
   - Usuario 2 (30%): −USD 45,00

**Cálculo de saldos:**

| | Usuario 1 | Usuario 2 |
|-|----------:|----------:|
| Aporte unilateral | +150,00 | 0 |
| Cuota del gasto | −105,00 | −45,00 |
| **Saldo resultante** | **+45,00** | **−45,00** |
| Gastado acumulado | 105,00 | 45,00 |

**Dashboard esperado después del Paso 1:**

| Indicador | Valor |
|-----------|------:|
| Total gastos | USD 150,00 |
| Gasto x m² | USD 0,08 |
| Caja general | USD 0,00 |
| Saldo Usuario 1 | USD +45,00 |
| Gastado Usuario 1 | USD 105,00 |
| Saldo Usuario 2 | USD −45,00 |
| Gastado Usuario 2 | USD 45,00 |

---

## PASO 2 — Gasto ARS 53.000, paga Usuario 2

**Acción:**
El admin crea un gasto de ARS 53.000 (= USD 37,19 al TC 1.425). La caja tiene saldo 0 →
se indica que **Usuario 2 paga ARS 53.000 en su totalidad**.

**Lógica interna:**
1. Se crea aporte unilateral automático para Usuario 2: **ARS 53.000** (= USD 37,19)
2. La caja queda en USD 37,19 suficiente para cubrir el gasto
3. Distribución del gasto:
   - Usuario 1 (70%): −USD 26,03
   - Usuario 2 (30%): −USD 11,16

**Cálculo de saldos (acumulado desde inicio):**

| | Usuario 1 | Usuario 2 |
|-|----------:|----------:|
| Saldo previo (Paso 1) | +45,00 | −45,00 |
| Aporte unilateral | 0 | +37,19 |
| Cuota del gasto | −26,03 | −11,16 |
| **Saldo resultante** | **+18,96** | **−18,96** |
| Gastado acumulado | 131,03 | 56,16 |

> **Nota:** La caja vuelve a 0 porque el aporte de U2 (37,19) y el gasto (37,19) se compensan.

**Dashboard esperado después del Paso 2:**

| Indicador | Valor |
|-----------|------:|
| Total gastos | USD 187,19 |
| Gasto x m² | USD 0,09 |
| Caja general | USD 0,00 |
| Saldo Usuario 1 | USD +18,96 |
| Gastado Usuario 1 | USD 131,03 |
| Saldo Usuario 2 | USD −18,96 |
| Gastado Usuario 2 | USD 56,16 |

---

## PASO 3a — Crear solicitud grupal de aporte ARS 500.000

**Acción:**
El admin crea una solicitud grupal de ARS 500.000 (= USD 350,88 al TC 1.425).
Al crearla, absorbe los aportes unilaterales previos de cada participante.

**Distribución de cuotas:**

| Participante | Cuota (ARS) | Cuota (USD) |
|-------------|------------:|------------:|
| Usuario 1 (70%) | 350.000 | 245,61 |
| Usuario 2 (30%) | 150.000 | 105,26 |
| **Total** | **500.000** | **350,88** |

**Absorciones de aportes unilaterales previos:**

| Participante | Aporte unilateral | Absorbido | Cuota neta a pagar (ARS) | Cuota neta a pagar (USD) |
|-------------|------------------:|----------:|-------------------------:|-------------------------:|
| Usuario 1 | ARS 213.750 (= USD 150) | ARS 213.750 | 136.250 | 95,61 |
| Usuario 2 | ARS 53.000 (= USD 37,19) | ARS 53.000 | 97.000 | 68,07 |

> La absorción usa el monto original del aporte unilateral (no el balance actual).
> Toda la plata que pusieron para financiar los gastos se "acredita" contra su cuota de la solicitud.

Los saldos en la base de datos NO cambian todavía. La solicitud queda pendiente de pago.

---

## PASO 3b — Usuario 1 paga su cuota neta (ARS 136.250 = USD 95,61)

**Acción:**
Usuario 1 paga ARS 136.250. El admin aprueba.

**Lógica interna:**
- U1.balance_db += 95,61 → 18,96 + 95,61 = **114,57 ≈ 114,58**
- U2 todavía no pagó → su saldo MOSTRADO incluye la deuda pendiente:
  - U2 balance_db = −18,96 (sin cambio)
  - U2 pendiente neto = −68,07
  - U2 saldo mostrado = −18,96 − 68,07 = **−87,03 ≈ −87,04**
- Caja general = suma de balance_db = 114,58 + (−18,96) = **95,62 ≈ 95,61**

**Dashboard esperado después de que Usuario 1 paga:**

| Indicador | Valor |
|-----------|------:|
| Total gastos | USD 187,19 |
| Gasto x m² | USD 0,09 |
| Caja general | USD 95,61 |
| Saldo Usuario 1 | USD +114,58 |
| Gastado Usuario 1 | USD 131,03 |
| Saldo Usuario 2 | USD −87,04 |
| Gastado Usuario 2 | USD 56,16 |

> **¿Por qué el saldo de U2 baja tanto?**
> El saldo mostrado descuenta la obligación pendiente que U2 todavía no pagó (USD 68,07 neto).
> −18,96 (balance real) − 68,07 (pendiente) = −87,03
>
> **¿Por qué caja ≠ suma de saldos?**
> La caja muestra el dinero real en el proyecto (suma de balance_db).
> Los saldos individuales incluyen obligaciones pendientes que todavía no ingresaron como cash.

---

## PASO 3c — Usuario 2 paga su cuota neta (ARS 97.000 = USD 68,07)

**Acción:**
Usuario 2 paga ARS 97.000. El admin aprueba.

**Lógica interna:**
- U2.balance_db += 68,07 → −18,96 + 68,07 = **+49,11**
- U2 ya no tiene pendiente → saldo mostrado = balance_db = 49,11
- Caja general = 114,58 + 49,11 = **163,69 ≈ 163,68**

**Dashboard esperado al final (estado definitivo):**

| Indicador | Valor |
|-----------|------:|
| Total gastos | USD 187,19 |
| Gasto x m² | USD 0,09 |
| Caja general | USD 163,68 |
| Saldo Usuario 1 | USD +114,58 |
| Gastado Usuario 1 | USD 131,03 |
| Saldo Usuario 2 | USD +49,11 |
| Gastado Usuario 2 | USD 56,16 |

---

## Resumen completo del flujo

| Paso | Acción | Caja (USD) | Saldo U1 (USD) | Gastado U1 | Saldo U2 (USD) | Gastado U2 |
|------|--------|:----------:|:--------------:|:----------:|:--------------:|:----------:|
| 0 | Estado inicial | 0 | 0 | 0 | 0 | 0 |
| 1 | Gasto USD 150 (U1 paga) | 0 | +45,00 | 105,00 | −45,00 | 45,00 |
| 2 | Gasto ARS 53.000 (U2 paga) | 0 | +18,96 | 131,03 | −18,96 | 56,16 |
| 3a | Solicitud grupal ARS 500.000 creada | 0 | +18,96 | 131,03 | −18,96 | 56,16 |
| 3b | U1 paga cuota neta ARS 136.250 | 95,61 | +114,58 | 131,03 | −87,04 ⚠ | 56,16 |
| 3c | U2 paga cuota neta ARS 97.000 | **163,68** | **+114,58** | **131,03** | **+49,11** | **56,16** |

⚠ El saldo de U2 en el paso 3b incluye la deuda pendiente de la solicitud no pagada aún.

---

## Invariantes que el test debe verificar en CADA paso

1. `caja_general = suma de balance_db de todos los participantes`
2. `gastado_acumulado_participante = suma de cuotas de todos los gastos`
3. `saldo_mostrado = balance_db − pendiente_neto_de_solicitudes_no_pagas`
4. `total_gastos = suma de amount_usd de todos los expenses`
5. `gasto_x_m2 = total_gastos / 2000` (redondeado a 2 decimales)

---

## Notas para la automatización (tests/e2e/test_01.py)

```
Endpoint a verificar después de cada paso:
  GET /dashboard/summary          → total_usd, gasto_x_m2, caja_general
  GET /dashboard/my-status        → balance_usd (para cada usuario)

Parámetros fijos:
  exchange_rate_override = 1425   (en cada expense)
  Tolerancia de redondeo: ± 0.02 USD
```

Secuencia de llamadas API:
1. `POST /auth/register-first-admin` → crear Usuario 1 (admin)
2. `POST /auth/register` → crear Usuario 2
3. `POST /projects` → crear proyecto con parámetros del setup
4. `POST /project-members` → agregar Usuario 2 con 30%
5. `POST /expenses` con `payers=[{user_1_id, 150}]` → Paso 1
6. `GET /dashboard/summary` + `GET /dashboard/my-status` × 2 → verificar Paso 1
7. `POST /expenses` con `payers=[{user_2_id, 53000 ARS}]` → Paso 2
8. `GET /dashboard/...` → verificar Paso 2
9. `POST /contributions` con absorción de ambos unilaterales → Paso 3a
10. `PUT /contributions/payments/{id}/approve` para U1 → Paso 3b
11. `GET /dashboard/...` → verificar Paso 3b
12. `PUT /contributions/payments/{id}/approve` para U2 → Paso 3c
13. `GET /dashboard/...` → verificar estado final
```
