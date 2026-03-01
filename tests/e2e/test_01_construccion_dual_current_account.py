"""
Test E2E — Escenario 01: Construcción · Moneda DUAL · Solo Aportes a Caja

Verifica el flujo completo según el documento:
  tests/scenarios/01_construccion_dual_current_account.md

Pasos cubiertos:
  Paso 0  — Estado inicial (todo en 0)
  Paso 1  — Gasto USD 150, paga Usuario 1
  Paso 2  — Gasto ARS 53.000, paga Usuario 2
  Paso 3a — Solicitud grupal ARS 500.000 (con absorción de aportes unilaterales)
  Paso 3b — Usuario 1 paga su cuota neta (ARS 136.250)
  Paso 3c — Usuario 2 paga su cuota neta (ARS 97.000) → admin aprueba
"""

from decimal import Decimal
from unittest.mock import patch

import pytest

# TC fijo usado en todos los gastos y mocks del dashboard
TC = Decimal("1425")
# Tolerancia de redondeo ± 0.02 USD (ver escenario)
TOL = Decimal("0.02")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_close(actual, expected, msg=""):
    """Falla si |actual - expected| > TOL."""
    a = Decimal(str(actual))
    e = Decimal(str(expected))
    assert abs(a - e) <= TOL, f"{msg}: obtenido={a}, esperado≈{e} (±{TOL})"


def dashboard_summary(client, headers):
    """GET /dashboard/summary con TC mockeado."""
    with patch("app.routers.dashboard.fetch_blue_dollar_rate_sync", return_value=TC):
        r = client.get("/dashboard/summary", headers=headers)
    assert r.status_code == 200, f"dashboard/summary falló: {r.text}"
    return r.json()


def my_status(client, headers):
    """GET /dashboard/my-status con TC mockeado."""
    with patch("app.routers.dashboard.fetch_blue_dollar_rate_sync", return_value=TC):
        r = client.get("/dashboard/my-status", headers=headers)
    assert r.status_code == 200, f"dashboard/my-status falló: {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# Test principal
# ---------------------------------------------------------------------------

def test_escenario_01_construccion_dual_current_account(client):
    """Flujo completo del escenario 01 paso a paso."""

    # -----------------------------------------------------------------------
    # SETUP: Usuarios, proyecto y miembros
    # -----------------------------------------------------------------------

    # Registrar Usuario 1 (admin global)
    r = client.post("/auth/register-first-admin", json={
        "email": "u1@escenario01.com",
        "password": "Test1234!",
        "full_name": "Usuario 1",
    })
    assert r.status_code == 201, f"register-first-admin: {r.text}"
    u1_id = r.json()["id"]

    # Login Usuario 1
    r = client.post("/auth/login", data={
        "username": "u1@escenario01.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u1: {r.text}"
    token_u1 = r.json()["access_token"]
    h1 = {"Authorization": f"Bearer {token_u1}"}

    # Registrar Usuario 2 (usando credenciales de admin)
    r = client.post("/auth/register", json={
        "email": "u2@escenario01.com",
        "password": "Test1234!",
        "full_name": "Usuario 2",
    }, headers=h1)
    assert r.status_code == 201, f"register u2: {r.text}"
    u2_id = r.json()["id"]

    # Login Usuario 2
    r = client.post("/auth/login", data={
        "username": "u2@escenario01.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u2: {r.text}"
    token_u2 = r.json()["access_token"]
    h2 = {"Authorization": f"Bearer {token_u2}"}

    # Crear proyecto: construccion / DUAL / current_account / 2000 m²
    r = client.post("/projects", json={
        "name": "Edificio Escenario 01",
        "currency_mode": "DUAL",
        "project_type": "construccion",
        "type_parameters": {
            "square_meters": 2000,
            "contribution_mode": "current_account",
        },
    }, headers=h1)
    assert r.status_code == 200, f"create project: {r.text}"
    project_id = r.json()["id"]

    # Headers con X-Project-ID incluido
    h1p = {**h1, "X-Project-ID": str(project_id)}
    h2p = {**h2, "X-Project-ID": str(project_id)}

    # Actualizar participación de U1 a 70%
    r = client.put(
        f"/projects/{project_id}/members/{u1_id}",
        json={"participation_percentage": 70},
        headers=h1p,
    )
    assert r.status_code == 200, f"update u1 pct: {r.text}"

    # Agregar U2 con 30%
    r = client.post(
        f"/projects/{project_id}/members",
        json={"user_id": u2_id, "participation_percentage": 30},
        headers=h1p,
    )
    assert r.status_code == 200, f"add u2: {r.text}"

    # -----------------------------------------------------------------------
    # PASO 0: Estado inicial — todo en cero
    # -----------------------------------------------------------------------
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"], 0, "p0 total_gastos")
    assert_close(s["total_balance_usd"],  0, "p0 caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], 0, "p0 U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], 0, "p0 U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 1: Gasto USD 150 — paga Usuario 1
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 1 - materiales",
        "amount_original": "150.00",
        "currency_original": "USD",
        "exchange_rate_override": "1425",
        "payers": [{"user_id": u1_id, "amount": "150.00"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense 1: {r.text}"

    # Verificar dashboard Paso 1
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],           150,  "p1 total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.08,  "p1 gasto_x_m2")
    assert_close(s["total_balance_usd"],              0,  "p1 caja_general")

    # Saldos individuales Paso 1
    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +45, "p1 U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -45, "p1 U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 2: Gasto ARS 53.000 — paga Usuario 2
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 2 - mano de obra",
        "amount_original": "53000.00",
        "currency_original": "ARS",
        "exchange_rate_override": "1425",
        "payers": [{"user_id": u2_id, "amount": "53000.00"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense 2: {r.text}"

    # Verificar dashboard Paso 2
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],         187.19, "p2 total_gastos")
    assert_close(s["cost_per_square_meter_usd"],    0.09, "p2 gasto_x_m2")
    assert_close(s["total_balance_usd"],               0, "p2 caja_general")

    # Saldos individuales Paso 2
    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +18.96, "p2 U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -18.96, "p2 U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 3a: Solicitud grupal ARS 500.000 con absorción de unilaterales
    # -----------------------------------------------------------------------

    # Obtener aportes unilaterales disponibles (admin)
    r = client.get("/contributions/unilateral/unabsorbed", headers=h1p)
    assert r.status_code == 200, f"unabsorbed: {r.text}"
    unabsorbed = r.json()
    assert len(unabsorbed) == 2, (
        f"Se esperaban 2 aportes unilaterales, se obtuvieron {len(unabsorbed)}"
    )
    unilateral_ids = [u["id"] for u in unabsorbed]

    # Crear solicitud grupal con absorción
    r = client.post("/contributions", json={
        "description": "Solicitud grupal Q1 2025",
        "amount": "500000.00",
        "currency": "ARS",
        "absorb_unilateral_ids": unilateral_ids,
    }, headers=h1p)
    assert r.status_code == 201, f"create contribution: {r.text}"
    solicitud_id = r.json()["id"]

    # Verificar que caja y total_gastos no cambiaron (saldos db sin cambios)
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"], 187.19, "p3a total_gastos")
    assert_close(s["total_balance_usd"],       0, "p3a caja_general")

    # Obtener detalle de la solicitud para conseguir los payment_ids
    r = client.get(f"/contributions/{solicitud_id}", headers=h1p)
    assert r.status_code == 200, f"get contribution detail: {r.text}"
    detail = r.json()
    payments = detail["payments"]

    u1_payment = next(p for p in payments if p["user_id"] == u1_id)
    u2_payment = next(p for p in payments if p["user_id"] == u2_id)
    u1_payment_id = u1_payment["payment_id"]
    u2_payment_id = u2_payment["payment_id"]

    # Verificar absorciones correctas
    # U1: cuota 350.000 ARS, absorbe 213.750 ARS → resta 136.250 ARS
    assert_close(u1_payment["amount_due"],    350000, "p3a U1 amount_due")
    assert_close(u1_payment["amount_offset"], 213750, "p3a U1 offset")
    assert_close(u1_payment["amount_remaining"], 136250, "p3a U1 restante")

    # U2: cuota 150.000 ARS, absorbe 53.000 ARS → resta 97.000 ARS
    assert_close(u2_payment["amount_due"],    150000, "p3a U2 amount_due")
    assert_close(u2_payment["amount_offset"],  53000, "p3a U2 offset")
    assert_close(u2_payment["amount_remaining"], 97000, "p3a U2 restante")

    # -----------------------------------------------------------------------
    # PASO 3b: Usuario 1 paga su cuota neta ARS 136.250
    # (U1 es admin → auto-aprobado)
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment_id}/submit",
        json={
            "amount_paid": "136250.00",
            "currency_paid": "ARS",
            "exchange_rate_override": "1425",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago debería auto-aprobarse (es admin)"

    # Verificar dashboard Paso 3b
    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_usd"], 95.61, "p3b caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +114.58, "p3b U1 saldo")

    # U2 todavía no pagó: su saldo mostrado incluye la deuda pendiente (−68,07 USD neto)
    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -87.04, "p3b U2 saldo (incluye pendiente)")

    # -----------------------------------------------------------------------
    # PASO 3c: Usuario 2 paga cuota neta ARS 97.000 → admin aprueba
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment_id}/submit",
        json={
            "amount_paid": "97000.00",
            "currency_paid": "ARS",
            "exchange_rate_override": "1425",
        },
        headers=h2p,
    )
    assert r.status_code == 200, f"submit u2 payment: {r.text}"
    assert r.json()["is_paid"] is False, "U2 no es admin → debe quedar pendiente de aprobación"

    # Admin (U1) aprueba el pago de U2
    r = client.put(
        f"/contributions/payments/{u2_payment_id}/approve",
        json={"approved": True},
        headers=h1p,
    )
    assert r.status_code == 200, f"approve u2 payment: {r.text}"
    assert r.json()["is_paid"] is True, "Pago de U2 debería quedar aprobado"

    # Verificar estado final Paso 3c
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],        187.19, "final total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.09, "final gasto_x_m2")
    assert_close(s["total_balance_usd"],          163.68, "final caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +114.58, "final U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], +49.11, "final U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 4: Gasto ARS 100.000 — se descuenta de la caja (sin pagadores)
    # Estado previo: U1.balance_ars=163275, U2.balance_ars=69975 → total=233250
    # 233250 >= 100000 ✓ → no requiere pagadores
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 3 - materiales desde caja",
        "amount_original": "100000.00",
        "currency_original": "ARS",
        "exchange_rate_override": "1425",
    }, headers=h1p)
    assert r.status_code == 201, f"expense 3: {r.text}"

    # Verificar dashboard Paso 4
    # total_usd = 187.19 + 100000/1425 = 187.19 + 70.18 = 257.37
    # caja = (163275 - 70000 + 69975 - 30000) / 1425 = 133250 / 1425 = 93.51
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],        257.37, "p4 total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.13, "p4 gasto_x_m2")
    assert_close(s["total_balance_usd"],           93.51, "p4 caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +65.46, "p4 U1 saldo")
    assert_close(st1["total_paid_usd"],      180.16, "p4 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], +28.05, "p4 U2 saldo")
    assert_close(st2["total_paid_usd"],       77.21, "p4 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5a: Solicitud grupal ARS 700.000 — sin absorción, nadie paga aún
    # Los unilaterales del paso 3a ya fueron absorbidos al 100% → lista vacía
    # -----------------------------------------------------------------------
    r = client.post("/contributions", json={
        "description": "Solicitud grupal Q2 2025",
        "amount": "700000.00",
        "currency": "ARS",
        "absorb_unilateral_ids": [],
    }, headers=h1p)
    assert r.status_code == 201, f"create contribution 2: {r.text}"
    solicitud2_id = r.json()["id"]

    # El dashboard no cambia (balance_db sin movimiento)
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],  257.37, "p5a total_gastos")
    assert_close(s["total_balance_usd"],    93.51, "p5a caja_general")

    # Saldos incluyen deuda pendiente de la nueva solicitud
    # U1: (93275 - 490000) / 1425 = -396725 / 1425 = -278.40
    # U2: (39975 - 210000) / 1425 = -170025 / 1425 = -119.32
    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], -278.40, "p5a U1 saldo (con pendiente)")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -119.32, "p5a U2 saldo (con pendiente)")

    # Obtener payment IDs de la segunda solicitud
    r = client.get(f"/contributions/{solicitud2_id}", headers=h1p)
    assert r.status_code == 200, f"get contribution2 detail: {r.text}"
    detail2 = r.json()
    payments2 = detail2["payments"]

    u1_payment2 = next(p for p in payments2 if p["user_id"] == u1_id)
    u2_payment2 = next(p for p in payments2 if p["user_id"] == u2_id)
    u1_payment2_id = u1_payment2["payment_id"]
    u2_payment2_id = u2_payment2["payment_id"]

    assert_close(u1_payment2["amount_due"],       490000, "p5a U1 cuota")
    assert_close(u1_payment2["amount_offset"],          0, "p5a U1 offset")
    assert_close(u1_payment2["amount_remaining"],  490000, "p5a U1 restante")

    assert_close(u2_payment2["amount_due"],       210000, "p5a U2 cuota")
    assert_close(u2_payment2["amount_offset"],          0, "p5a U2 offset")
    assert_close(u2_payment2["amount_remaining"],  210000, "p5a U2 restante")

    # -----------------------------------------------------------------------
    # PASO 5x: Gasto ARS 30.000 — se descuenta de la caja (sin pagadores)
    # Estado previo: U1.balance_ars=93275, U2.balance_ars=39975 → total=133250 ARS
    # 133250 >= 30000 ✓ → no requiere pagadores
    # Deducción: U1 -= 21000 → 72275  |  U2 -= 9000 → 30975
    # caja = 103250 / 1425 = 72.46 USD
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 4 - insumos desde caja",
        "amount_original": "30000.00",
        "currency_original": "ARS",
        "exchange_rate_override": "1425",
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto4 (30K ARS): {r.text}"

    # total = 257.37 + 30000/1425 = 257.37 + 21.05 = 278.42
    # caja = 103250 / 1425 = 72.46
    # U1 saldo = (72275 - 490000) / 1425 = -417725 / 1425 = -293.14
    # U2 saldo = (30975 - 210000) / 1425 = -179025 / 1425 = -125.63
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],        278.42, "p5x total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.14, "p5x gasto_x_m2")
    assert_close(s["total_balance_usd"],           72.46, "p5x caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], -293.14, "p5x U1 saldo")
    assert_close(st1["total_paid_usd"],       194.89, "p5x U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -125.63, "p5x U2 saldo")
    assert_close(st2["total_paid_usd"],        83.53, "p5x U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5b: Usuario 1 paga ARS 490.000 (auto-aprobado como admin)
    # U1.balance_ars += 490000 → 72275 + 490000 = 562275
    # caja = (562275 + 30975) / 1425 = 593250 / 1425 = 416.32
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment2_id}/submit",
        json={
            "amount_paid": "490000.00",
            "currency_paid": "ARS",
            "exchange_rate_override": "1425",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment2: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago2 debe auto-aprobarse (es admin)"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_usd"], 416.32, "p5b caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +394.58, "p5b U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -125.63, "p5b U2 saldo (aún pendiente)")

    # -----------------------------------------------------------------------
    # PASO 5c: Usuario 2 paga ARS 210.000 → admin aprueba
    # U2.balance_ars += 210000 → 39975 + 210000 = 249975
    # caja = (583275 + 249975) / 1425 = 833250 / 1425 = 584.74
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment2_id}/submit",
        json={
            "amount_paid": "210000.00",
            "currency_paid": "ARS",
            "exchange_rate_override": "1425",
        },
        headers=h2p,
    )
    assert r.status_code == 200, f"submit u2 payment2: {r.text}"
    assert r.json()["is_paid"] is False, "U2 no es admin → pendiente de aprobación"

    r = client.put(
        f"/contributions/payments/{u2_payment2_id}/approve",
        json={"approved": True},
        headers=h1p,
    )
    assert r.status_code == 200, f"approve u2 payment2: {r.text}"
    assert r.json()["is_paid"] is True, "Pago de U2 (solicitud 2) aprobado"

    # U2.balance_ars += 210000 → 30975 + 210000 = 240975
    # caja = (562275 + 240975) / 1425 = 803250 / 1425 = 563.68
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],        278.42, "p5c total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.14, "p5c gasto_x_m2")
    assert_close(s["total_balance_usd"],          563.68, "p5c caja_general")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +394.58, "p5c U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], +169.11, "p5c U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 6: Gasto USD 100 con pagadores parciales
    # U1 paga USD 80 → unilateral ARS 114.000 (80 × 1425)
    # U2 paga USD 10 → unilateral ARS  14.250 (10 × 1425)
    # Los USD 10 restantes se descuentan del saldo de caja
    #
    # Balance antes: U1=562275, U2=240975
    # Unilaterales:  U1 +114000 → 676275  |  U2 +14250 → 255225
    # Deducción:     U1 −99750  → 576525  |  U2 −42750 → 212475
    # caja = (576525 + 212475) / 1425 = 789000 / 1425 = 553.68
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 5 - equipamiento",
        "amount_original": "100.00",
        "currency_original": "USD",
        "exchange_rate_override": "1425",
        "payers": [
            {"user_id": u1_id, "amount": "80.00"},
            {"user_id": u2_id, "amount": "10.00"},
        ],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto5 (USD 100): {r.text}"

    # total = 278.42 + 100.00 = 378.42
    # gasto_x_m2 = 378.42 / 2000 = 0.19
    # caja = 789000 / 1425 = 553.68
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],        378.42, "p6 total_gastos")
    assert_close(s["cost_per_square_meter_usd"],   0.19, "p6 gasto_x_m2")
    assert_close(s["total_balance_usd"],          553.68, "p6 caja_general")

    # U1 saldo = 576525 / 1425 = 404.58
    # U2 saldo = 212475 / 1425 = 149.11
    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +404.58, "p6 U1 saldo")
    assert_close(st1["total_paid_usd"],       264.89, "p6 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], +149.11, "p6 U2 saldo")
    assert_close(st2["total_paid_usd"],       113.53, "p6 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 7: Cambio de TC a 1450 — impacto en saldos USD
    #
    # Los balances en ARS NO cambian: U1=576525, U2=212475, total=789000
    # Los gastos y "gastado" tampoco cambian (almacenados en USD al TC del momento)
    # Solo recalculan: caja y saldos individuales → ARS / TC_nuevo
    #
    # caja = 789000 / 1450 = 544.14
    # U1   = 576525 / 1450 = 397.57
    # U2   = 212475 / 1450 = 146.53
    # -----------------------------------------------------------------------
    TC_7 = Decimal("1450")

    with patch("app.routers.dashboard.fetch_blue_dollar_rate_sync", return_value=TC_7):
        r7s = client.get("/dashboard/summary", headers=h1p)
    assert r7s.status_code == 200
    s7 = r7s.json()

    # Valores almacenados en USD → sin cambio
    assert_close(s7["total_expenses_usd"],        378.42, "p7 total_gastos (sin cambio)")
    assert_close(s7["cost_per_square_meter_usd"],   0.19, "p7 gasto_x_m2 (sin cambio)")
    # Caja recalculada con TC=1450
    assert_close(s7["total_balance_usd"],          544.14, "p7 caja con TC=1450")

    with patch("app.routers.dashboard.fetch_blue_dollar_rate_sync", return_value=TC_7):
        r7_st1 = client.get("/dashboard/my-status", headers=h1p)
    assert r7_st1.status_code == 200
    st1_7 = r7_st1.json()
    assert_close(st1_7["balance_aportes_usd"], +397.60, "p7 U1 saldo con TC=1450")
    assert_close(st1_7["total_paid_usd"],       264.89, "p7 U1 gastado (sin cambio)")

    with patch("app.routers.dashboard.fetch_blue_dollar_rate_sync", return_value=TC_7):
        r7_st2 = client.get("/dashboard/my-status", headers=h2p)
    assert r7_st2.status_code == 200
    st2_7 = r7_st2.json()
    assert_close(st2_7["balance_aportes_usd"], +146.53, "p7 U2 saldo con TC=1450")
    assert_close(st2_7["total_paid_usd"],       113.53, "p7 U2 gastado (sin cambio)")
