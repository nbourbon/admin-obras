"""
Test E2E — Escenario 02: Construcción · Moneda ARS · Solo Aportes a Caja

Verifica el flujo completo según el documento:
  tests/scenarios/02_construccion_ars_current_account.md

Misma secuencia de operaciones que el Escenario 01 DUAL, pero con moneda ARS.
No se necesita mockear tipo de cambio (el dashboard lo omite para modo ARS).
No hay Paso 7 (TC no aplica).
"""

from decimal import Decimal

import pytest


TOL = Decimal("1.00")  # tolerancia ±1 ARS (en lugar de ±0.02 USD)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_close(actual, expected, msg=""):
    """Falla si |actual - expected| > TOL."""
    a = Decimal(str(actual))
    e = Decimal(str(expected))
    assert abs(a - e) <= TOL, f"{msg}: obtenido={a}, esperado≈{e} (±{TOL})"


def dashboard_summary(client, headers):
    """GET /dashboard/summary (sin mock de TC — modo ARS no lo usa)."""
    r = client.get("/dashboard/summary", headers=headers)
    assert r.status_code == 200, f"dashboard/summary falló: {r.text}"
    return r.json()


def my_status(client, headers):
    """GET /dashboard/my-status (sin mock de TC — modo ARS no lo usa)."""
    r = client.get("/dashboard/my-status", headers=headers)
    assert r.status_code == 200, f"dashboard/my-status falló: {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# Test principal
# ---------------------------------------------------------------------------

def test_escenario_02_construccion_ars_current_account(client):
    """Flujo completo del escenario 02 — moneda ARS — paso a paso."""

    # -----------------------------------------------------------------------
    # SETUP: Usuarios, proyecto y miembros
    # -----------------------------------------------------------------------

    r = client.post("/auth/register-first-admin", json={
        "email": "u1@escenario02.com",
        "password": "Test1234!",
        "full_name": "Usuario 1",
    })
    assert r.status_code == 201, f"register-first-admin: {r.text}"
    u1_id = r.json()["id"]

    r = client.post("/auth/login", data={
        "username": "u1@escenario02.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u1: {r.text}"
    token_u1 = r.json()["access_token"]
    h1 = {"Authorization": f"Bearer {token_u1}"}

    r = client.post("/auth/register", json={
        "email": "u2@escenario02.com",
        "password": "Test1234!",
        "full_name": "Usuario 2",
    }, headers=h1)
    assert r.status_code == 201, f"register u2: {r.text}"
    u2_id = r.json()["id"]

    r = client.post("/auth/login", data={
        "username": "u2@escenario02.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u2: {r.text}"
    token_u2 = r.json()["access_token"]
    h2 = {"Authorization": f"Bearer {token_u2}"}

    # Crear proyecto ARS current_account
    r = client.post("/projects", json={
        "name": "Construcción Edificio ARS",
        "currency_mode": "ARS",
        "project_type": "construccion",
        "type_parameters": {
            "square_meters": 2000,
            "contribution_mode": "current_account",
        },
    }, headers=h1)
    assert r.status_code == 200, f"create project: {r.text}"
    project_id = r.json()["id"]

    # Headers con proyecto
    h1p = {**h1, "X-Project-ID": str(project_id)}
    h2p = {**h2, "X-Project-ID": str(project_id)}

    # Ajustar U1 a 70%
    r = client.put(f"/projects/{project_id}/members/{u1_id}", json={
        "participation_percentage": 70,
    }, headers=h1p)
    assert r.status_code == 200, f"update u1 percentage: {r.text}"

    # Agregar U2 con 30%
    r = client.post(f"/projects/{project_id}/members", json={
        "user_id": u2_id,
        "participation_percentage": 30,
    }, headers=h1p)
    assert r.status_code == 200, f"add member: {r.text}"

    # -----------------------------------------------------------------------
    # PASO 0: Estado inicial
    # -----------------------------------------------------------------------
    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],         0, "p0 total_gastos_ars")
    assert_close(s["total_balance_ars"],           0, "p0 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],       0, "p0 U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],       0, "p0 U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 1: Gasto ARS 213.750 — U1 paga
    # U1 unilateral +213.750 → net U1 = +64.125 | U2 = -64.125
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 1 - obra principal",
        "amount_original": "213750.00",
        "currency_original": "ARS",
        "payers": [{"user_id": u1_id, "amount": "213750.00"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto1 (ARS 213750): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      213750, "p1 total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 106.88, "p1 gasto_x_m2")
    assert_close(s["total_balance_ars"],              0, "p1 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],   +64125, "p1 U1 saldo")
    assert_close(st1["total_paid_ars"],        149625, "p1 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],   -64125, "p1 U2 saldo")
    assert_close(st2["total_paid_ars"],         64125, "p1 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 2: Gasto ARS 53.000 — U2 paga
    # U2 unilateral +53.000 → net U1 = +27.025 | U2 = -27.025
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 2 - materiales",
        "amount_original": "53000.00",
        "currency_original": "ARS",
        "payers": [{"user_id": u2_id, "amount": "53000.00"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto2 (ARS 53000): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      266750, "p2 total_gastos_ars")
    assert_close(s["total_balance_ars"],            0, "p2 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],   +27025, "p2 U1 saldo")
    assert_close(st1["total_paid_ars"],        186725, "p2 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],   -27025, "p2 U2 saldo")
    assert_close(st2["total_paid_ars"],         80025, "p2 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 3a: Solicitud grupal ARS 500.000 — absorbe unilaterales previos
    # U1 amount_due=350.000, offset=213.750, restante=136.250
    # U2 amount_due=150.000, offset= 53.000, restante= 97.000
    # -----------------------------------------------------------------------
    # Obtener IDs de unilaterales para absorción
    r = client.get("/contributions/unilateral/unabsorbed", headers=h1p)
    assert r.status_code == 200, f"get unabsorbed: {r.text}"
    unabsorbed = r.json()
    unilateral_ids = [u["id"] for u in unabsorbed]
    assert len(unilateral_ids) == 2, f"esperaba 2 unilaterales, tengo {len(unilateral_ids)}"

    r = client.post("/contributions", json={
        "description": "Solicitud grupal 1 — ARS 500.000",
        "amount": "500000.00",
        "currency": "ARS",
        "absorb_unilateral_ids": unilateral_ids,
    }, headers=h1p)
    assert r.status_code in (200, 201), f"create contribution 1: {r.text}"
    contrib1_id = r.json()["id"]

    # Obtener IDs de payments
    r = client.get(f"/contributions/{contrib1_id}", headers=h1p)
    assert r.status_code == 200
    contrib1 = r.json()
    u1_p1 = next(p for p in contrib1["payments"] if p["user_id"] == u1_id)
    u2_p1 = next(p for p in contrib1["payments"] if p["user_id"] == u2_id)
    u1_payment1_id = u1_p1["payment_id"]
    u2_payment1_id = u2_p1["payment_id"]
    assert_close(u1_p1["amount_due"],        350000, "p3a U1 cuota bruta")
    assert_close(u1_p1["amount_offset"],     213750, "p3a U1 offset")
    assert_close(u1_p1["amount_remaining"],  136250, "p3a U1 restante")
    assert_close(u2_p1["amount_due"],        150000, "p3a U2 cuota bruta")
    assert_close(u2_p1["amount_offset"],      53000, "p3a U2 offset")
    assert_close(u2_p1["amount_remaining"],   97000, "p3a U2 restante")

    # Saldos con pendiente
    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"], -109225, "p3a U1 saldo (con pendiente)")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"], -124025, "p3a U2 saldo (con pendiente)")

    # -----------------------------------------------------------------------
    # PASO 3b: U1 paga ARS 136.250 (auto-aprobado como admin)
    # U1.balance_ars += 136.250 → 163.275
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment1_id}/submit",
        json={
            "amount_paid": "136250.00",
            "currency_paid": "ARS",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment1: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago1 debe auto-aprobarse (es admin)"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_ars"],       136250, "p3b caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],  +163275, "p3b U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],  -124025, "p3b U2 saldo (pendiente)")

    # -----------------------------------------------------------------------
    # PASO 3c: U2 paga ARS 97.000 → admin aprueba
    # U2.balance_ars += 97.000 → 69.975
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment1_id}/submit",
        json={
            "amount_paid": "97000.00",
            "currency_paid": "ARS",
        },
        headers=h2p,
    )
    assert r.status_code == 200, f"submit u2 payment1: {r.text}"
    assert r.json()["is_paid"] is False, "U2 no es admin → pendiente de aprobación"

    r = client.put(
        f"/contributions/payments/{u2_payment1_id}/approve",
        json={"approved": True},
        headers=h1p,
    )
    assert r.status_code == 200, f"approve u2 payment1: {r.text}"
    assert r.json()["is_paid"] is True

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      266750, "p3c total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 133.38, "p3c gasto_x_m2")
    assert_close(s["total_balance_ars"],        233250, "p3c caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],   +163275, "p3c U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],    +69975, "p3c U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 4: Gasto ARS 100.000 desde caja (sin pagadores)
    # Deducción: U1 −70.000 → 93.275 | U2 −30.000 → 39.975
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 3 - equipamiento",
        "amount_original": "100000.00",
        "currency_original": "ARS",
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto3 (ARS 100000): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      366750, "p4 total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 183.38, "p4 gasto_x_m2")
    assert_close(s["total_balance_ars"],        133250, "p4 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],    +93275, "p4 U1 saldo")
    assert_close(st1["total_paid_ars"],         256725, "p4 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],    +39975, "p4 U2 saldo")
    assert_close(st2["total_paid_ars"],         110025, "p4 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5a: Solicitud grupal ARS 700.000 — sin absorción
    # U1 amount_due=490.000 | U2 amount_due=210.000
    # -----------------------------------------------------------------------
    r = client.post("/contributions", json={
        "description": "Solicitud grupal 2 — ARS 700.000",
        "amount": "700000.00",
        "currency": "ARS",
    }, headers=h1p)
    assert r.status_code in (200, 201), f"create contribution 2: {r.text}"
    contrib2_id = r.json()["id"]

    r = client.get(f"/contributions/{contrib2_id}", headers=h1p)
    assert r.status_code == 200
    contrib2 = r.json()
    u1_p2 = next(p for p in contrib2["payments"] if p["user_id"] == u1_id)
    u2_p2 = next(p for p in contrib2["payments"] if p["user_id"] == u2_id)
    u1_payment2_id = u1_p2["payment_id"]
    u2_payment2_id = u2_p2["payment_id"]

    assert_close(u1_p2["amount_due"],       490000, "p5a U1 cuota")
    assert_close(u1_p2["amount_offset"],         0, "p5a U1 offset")
    assert_close(u1_p2["amount_remaining"], 490000, "p5a U1 restante")
    assert_close(u2_p2["amount_due"],       210000, "p5a U2 cuota")
    assert_close(u2_p2["amount_offset"],         0, "p5a U2 offset")
    assert_close(u2_p2["amount_remaining"], 210000, "p5a U2 restante")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"], -396725, "p5a U1 saldo (con pendiente)")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"], -170025, "p5a U2 saldo (con pendiente)")

    # -----------------------------------------------------------------------
    # PASO 5x: Gasto ARS 30.000 desde caja (sin pagadores)
    # Deducción: U1 −21.000 → 72.275 | U2 −9.000 → 30.975
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 4 - insumos desde caja",
        "amount_original": "30000.00",
        "currency_original": "ARS",
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto4 (ARS 30000): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      396750, "p5x total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 198.38, "p5x gasto_x_m2")
    assert_close(s["total_balance_ars"],        103250, "p5x caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],  -417725, "p5x U1 saldo (con pendiente)")
    assert_close(st1["total_paid_ars"],        277725, "p5x U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],  -179025, "p5x U2 saldo (con pendiente)")
    assert_close(st2["total_paid_ars"],        119025, "p5x U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5b: U1 paga ARS 490.000 (auto-aprobado como admin)
    # U1.balance_ars += 490.000 → 562.275
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment2_id}/submit",
        json={
            "amount_paid": "490000.00",
            "currency_paid": "ARS",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment2: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago2 debe auto-aprobarse (es admin)"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_ars"],       593250, "p5b caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],  +562275, "p5b U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],  -179025, "p5b U2 saldo (pendiente)")

    # -----------------------------------------------------------------------
    # PASO 5c: U2 paga ARS 210.000 → admin aprueba
    # U2.balance_ars += 210.000 → 240.975
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment2_id}/submit",
        json={
            "amount_paid": "210000.00",
            "currency_paid": "ARS",
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
    assert r.json()["is_paid"] is True

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],      396750, "p5c total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 198.38, "p5c gasto_x_m2")
    assert_close(s["total_balance_ars"],        803250, "p5c caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],   +562275, "p5c U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],   +240975, "p5c U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 6: Gasto ARS 142.500 con pagadores parciales
    # U1 paga ARS 114.000 | U2 paga ARS 14.250 | caja ARS 14.250
    #
    # Balance antes: U1=562.275, U2=240.975
    # Unilaterales:  U1 +114.000 → 676.275  |  U2 +14.250 → 255.225
    # Deducción:     U1 −99.750  → 576.525  |  U2 −42.750 → 212.475
    # caja = 576.525 + 212.475 = 789.000
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 5 - terminaciones",
        "amount_original": "142500.00",
        "currency_original": "ARS",
        "payers": [
            {"user_id": u1_id, "amount": "114000.00"},
            {"user_id": u2_id, "amount": "14250.00"},
        ],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto5 (ARS 142500): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_ars"],       539250, "p6 total_gastos_ars")
    assert_close(s["cost_per_square_meter_ars"], 269.63, "p6 gasto_x_m2")
    assert_close(s["total_balance_ars"],         789000, "p6 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_ars"],   +576525, "p6 U1 saldo")
    assert_close(st1["total_paid_ars"],         377475, "p6 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_ars"],   +212475, "p6 U2 saldo")
    assert_close(st2["total_paid_ars"],         161775, "p6 U2 gastado")
