# Escenario 01 — Construcción · Moneda DUAL · Solo Aportes a Caja

## Descripción

Test punta a punta del flujo más complejo del sistema:
- Proyecto tipo construcción con moneda DUAL (ARS + USD con tipo de cambio)
- Modalidad **current_account**: los gastos se deducen del saldo de caja
- Aportes individuales que se van absorbiendo en solicitudes grupales
- Validación del estado del dashboard para cada participante en cada paso

---

## Setup inicial

### Participantes

| Usuario | Rol | Participación |
|---------|-----|:-------------:|
| Nicolás | Admin | 85% |
| María | Miembro | 15% |

### Configuración del proyecto

```
Nombre:             [COMPLETAR — ej: "Edificio Test"]
Tipo:               construccion
Moneda:             DUAL
Modalidad aportes:  current_account
is_individual:      false
```

### Tipo de cambio de referencia

Para simplificar los cálculos, usamos TC fijo en todos los gastos:

```
TC = [COMPLETAR — ej: 1.000 ARS/USD]
```

> Nota: al crear cada gasto, se usa `exchange_rate_override` para fijar el TC
> y que los números sean predecibles en el test.

---

## Pasos del escenario

> **Convención de signos:**
> - Saldo `+` = crédito a favor (aportó más de lo que le corresponde)
> - Saldo `-` = deuda (le corresponde más de lo que aportó)
> - Los montos de gasto se muestran en ARS (USD × TC)

---

### PASO 1 — Aporte individual de Nicolás

**Acción:**
Nicolás hace un aporte individual (unilateral) a la caja.

```
Tipo:         Aporte Individual
Usuario:      Nicolás
Monto:        [COMPLETAR — ej: ARS 500.000]
Estado post:  Aprobado automáticamente (admin)
```

**Estado esperado después del paso 1:**

| Participante | Saldo ARS | Nota |
|-------------|----------:|------|
| Nicolás     | +[COMPLETAR] | Aportó a caja |
| María       | 0 | Sin movimientos |
| **Caja General** | +[COMPLETAR] | = suma de saldos |

---

### PASO 2 — Aporte individual de María

**Acción:**
María hace un aporte individual a la caja.

```
Tipo:         Aporte Individual
Usuario:      María
Monto:        [COMPLETAR — ej: ARS 100.000]
Estado post:  Pendiente aprobación (debe aprobar el admin)
→ Admin aprueba
```

**Estado esperado después del paso 2:**

| Participante | Saldo ARS | Nota |
|-------------|----------:|------|
| Nicolás     | +[COMPLETAR] | Sin cambio |
| María       | +[COMPLETAR] | Aportó a caja |
| **Caja General** | +[COMPLETAR] | |

---

### PASO 3 — Gasto con caja suficiente

**Acción:**
Admin crea un gasto. La caja tiene saldo suficiente para cubrirlo → se deduce automáticamente.

```
Descripción:          [COMPLETAR — ej: "Materiales estructurales"]
Monto:                USD [COMPLETAR]
TC override:          [TC definido arriba]
→ Equivalente ARS:    [COMPLETAR]
Pagadores (payers):   (ninguno — la caja alcanza)
```

**Distribución automática del gasto:**
```
Cuota Nicolás (85%): ARS [COMPLETAR]  → deduce de su saldo
Cuota María   (15%): ARS [COMPLETAR]  → deduce de su saldo
```

**Estado esperado después del paso 3:**

| Participante | Saldo ARS | Cálculo |
|-------------|----------:|---------|
| Nicolás     | [COMPLETAR] | Paso2 - cuota85% |
| María       | [COMPLETAR] | Paso2 - cuota15% |
| **Caja General** | [COMPLETAR] | |

---

### PASO 4 — Gasto con caja insuficiente (Nicolás paga de su bolsillo)

**Acción:**
Admin crea un gasto grande. La caja NO tiene saldo suficiente.
El admin indica que Nicolás paga el total del gasto.

```
Descripción:          [COMPLETAR — ej: "Estructura de hormigón"]
Monto:                USD [COMPLETAR]
TC override:          [TC definido arriba]
→ Equivalente ARS:    [COMPLETAR]
Caja disponible:      ARS [COMPLETAR — saldo del paso 3]
Déficit:              ARS [COMPLETAR]
Pagadores (payers):   Nicolás → USD [COMPLETAR] (cubre el total)
```

**Lógica interna al crear el gasto:**
1. Se crea un aporte individual automático a nombre de Nicolás por el monto que pagó
2. Se distribuye el gasto proporcionalmente usando la caja + el aporte de Nicolás
3. El gasto queda en estado PAID

**Estado esperado después del paso 4:**

| Participante | Saldo ARS | Cálculo |
|-------------|----------:|---------|
| Nicolás     | [COMPLETAR] | Paso3 + aporte_auto - cuota85% |
| María       | [COMPLETAR] | Paso3 - cuota15% |
| **Caja General** | [COMPLETAR] | |

---

### PASO 5 — Solicitud grupal de aporte (con absorción del saldo individual)

**Acción:**
Admin crea una solicitud grupal de aporte. Al crearla, indica absorber los
aportes individuales previos no absorbidos de cada participante.

```
Descripción:          [COMPLETAR — ej: "Cuota 1 - Q1 2025"]
Monto total:          ARS [COMPLETAR]
Distribución:
  Nicolás (85%):      ARS [COMPLETAR]
  María   (15%):      ARS [COMPLETAR]
Aportes a absorber:
  De Nicolás:         ARS [COMPLETAR — saldo individual disponible]
  De María:           ARS [COMPLETAR]
```

**Resultado de la absorción:**
```
Nicolás: cuota [X] - absorbido [Y] = neto a pagar en efectivo [Z]
María:   cuota [X] - absorbido [Y] = neto a pagar en efectivo [Z]
```

**Estado esperado después del paso 5 (antes de que paguen):**

| Participante | Saldo ARS | Neto pendiente | Nota |
|-------------|----------:|---------------:|------|
| Nicolás     | [COMPLETAR] | [COMPLETAR] | Tiene deuda grupal pendiente |
| María       | [COMPLETAR] | [COMPLETAR] | |
| **Caja General** | [COMPLETAR] | | |

---

### PASO 6 — Nicolás paga su cuota de la solicitud grupal

**Acción:**
Nicolás marca como pagado su parte de la solicitud grupal (el neto post-absorción).

```
Usuario:    Nicolás
Monto:      ARS [COMPLETAR — neto a pagar]
→ Admin aprueba el pago
```

**Estado esperado después del paso 6:**

| Participante | Saldo ARS | Nota |
|-------------|----------:|------|
| Nicolás     | [COMPLETAR] | |
| María       | [COMPLETAR] | Todavía pendiente |
| **Caja General** | [COMPLETAR] | |

---

### PASO 7 — María paga su cuota

**Acción:**
María paga su parte.

```
Usuario:    María
Monto:      ARS [COMPLETAR]
→ Admin aprueba
```

**Estado esperado final (después del paso 7):**

| Participante | Saldo ARS | Nota |
|-------------|----------:|------|
| Nicolás     | [COMPLETAR] | |
| María       | [COMPLETAR] | |
| **Caja General** | [COMPLETAR] | |

---

## Resumen del flujo completo

| Paso | Acción | Saldo Nicolás | Saldo María | Caja |
|------|--------|:-------------:|:-----------:|:----:|
| 0    | Estado inicial | 0 | 0 | 0 |
| 1    | Aporte individual Nicolás | +[X] | 0 | +[X] |
| 2    | Aporte individual María | +[X] | +[Y] | +[X+Y] |
| 3    | Gasto (caja alcanza) | +[...] | +[...] | +[...] |
| 4    | Gasto (Nicolás paga de bolsillo) | +[...] | +[...] | +[...] |
| 5    | Solicitud grupal creada | +[...] | +[...] | +[...] |
| 6    | Nicolás paga cuota grupal | +[...] | +[...] | +[...] |
| 7    | María paga cuota grupal | **[COMPLETAR]** | **[COMPLETAR]** | **[COMPLETAR]** |

---

## Qué valida este test

- [x] Aporte individual suma correctamente al saldo
- [x] Gasto con caja suficiente deduce proporcionalmente de cada participante
- [x] Gasto con caja insuficiente crea aporte automático para el pagador
- [x] El saldo del pagador refleja correctamente: aporte - cuota propia
- [x] La solicitud grupal calcula correctamente las absorciones
- [x] El neto a pagar (cuota - absorbido) es correcto
- [x] El pago de la solicitud grupal actualiza correctamente el saldo
- [x] La caja general = suma de saldos individuales en todo momento

---

## Notas para la automatización

Cuando se implemente como test automático (`tests/e2e/test_01.py`):

1. Usar la API real del backend con base de datos SQLite de test
2. Crear usuarios vía `POST /auth/register-first-admin` y `POST /auth/register`
3. Crear proyecto vía `POST /projects` con los parámetros de este escenario
4. Ejecutar cada paso vía las APIs correspondientes
5. Después de cada paso, llamar a `GET /dashboard/my-status` para cada usuario
   y comparar `balance_ars` con el valor esperado de la tabla
6. Tolerancia de redondeo: ± ARS 1 (por divisiones decimales)
