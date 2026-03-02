"""
Test E2E — Escenario 03: Construcción · Moneda USD · Solo Aportes a Caja

Verifica el flujo completo según el documento:
  tests/scenarios/03_construccion_usd_current_account.md

Misma secuencia de operaciones que el Escenario 01 DUAL, pero con moneda USD.
Los montos en USD son equivalentes a los del Escenario 01 con TC=1.425.
No se necesita mockear tipo de cambio.
No hay Paso 7 (TC no aplica).
"""

from decimal import Decimal

import pytest


TOL = Decimal("0.02")  # tolerancia ±0.02 USD (mismo criterio que escenario 01)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_close(actual, expected, msg=""):
    """Falla si |actual - expected| > TOL."""
    a = Decimal(str(actual))
    e = Decimal(str(expected))
    assert abs(a - e) <= TOL, f"{msg}: obtenido={a}, esperado≈{e} (±{TOL})"


def dashboard_summary(client, headers):
    """GET /dashboard/summary (sin mock de TC — modo USD no lo usa)."""
    r = client.get("/dashboard/summary", headers=headers)
    assert r.status_code == 200, f"dashboard/summary falló: {r.text}"
    return r.json()


def my_status(client, headers):
    """GET /dashboard/my-status (sin mock de TC — modo USD no lo usa)."""
    r = client.get("/dashboard/my-status", headers=headers)
    assert r.status_code == 200, f"dashboard/my-status falló: {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# Test principal
# ---------------------------------------------------------------------------

def test_escenario_03_construccion_usd_current_account(client):
    """Flujo completo del escenario 03 — moneda USD — paso a paso."""

    # -----------------------------------------------------------------------
    # SETUP: Usuarios, proyecto y miembros
    # -----------------------------------------------------------------------

    r = client.post("/auth/register-first-admin", json={
        "email": "u1@escenario03.com",
        "password": "Test1234!",
        "full_name": "Usuario 1",
    })
    assert r.status_code == 201, f"register-first-admin: {r.text}"
    u1_id = r.json()["id"]

    r = client.post("/auth/login", data={
        "username": "u1@escenario03.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u1: {r.text}"
    token_u1 = r.json()["access_token"]
    h1 = {"Authorization": f"Bearer {token_u1}"}

    r = client.post("/auth/register", json={
        "email": "u2@escenario03.com",
        "password": "Test1234!",
        "full_name": "Usuario 2",
    }, headers=h1)
    assert r.status_code == 201, f"register u2: {r.text}"
    u2_id = r.json()["id"]

    r = client.post("/auth/login", data={
        "username": "u2@escenario03.com",
        "password": "Test1234!",
    })
    assert r.status_code == 200, f"login u2: {r.text}"
    token_u2 = r.json()["access_token"]
    h2 = {"Authorization": f"Bearer {token_u2}"}

    # Crear proyecto USD current_account
    r = client.post("/projects", json={
        "name": "Construcción Edificio USD",
        "currency_mode": "USD",
        "project_type": "construccion",
        "type_parameters": {
            "square_meters": 2000,
            "contribution_mode": "current_account",
        },
    }, headers=h1)
    assert r.status_code == 200, f"create project: {r.text}"
    project_id = r.json()["id"]

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
    assert_close(s["total_expenses_usd"],   0, "p0 total_gastos_usd")
    assert_close(s["total_balance_usd"],    0, "p0 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], 0, "p0 U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], 0, "p0 U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 1: Gasto USD 150 — U1 paga
    # U1 unilateral +150 → net U1 = +45 | U2 = -45 | caja = 0
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 1 - obra principal",
        "amount_original": "150.00",
        "currency_original": "USD",
        "payers": [{"user_id": u1_id, "amount": "150.00"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto1 (USD 150): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       150.00, "p1 total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.08, "p1 gasto_x_m2")
    assert_close(s["total_balance_usd"],           0.00, "p1 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +45.00, "p1 U1 saldo")
    assert_close(st1["total_paid_usd"],       105.00, "p1 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  -45.00, "p1 U2 saldo")
    assert_close(st2["total_paid_usd"],        45.00, "p1 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 2: Gasto USD 37.19 — U2 paga
    # Deducción U1 = 26.03, U2 = 11.16 (suma exacta: 37.19)
    # U1 net: 45 - 26.03 = +18.97 | U2 net: (−45+37.19) - 11.16 = −18.97
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 2 - materiales",
        "amount_original": "37.19",
        "currency_original": "USD",
        "payers": [{"user_id": u2_id, "amount": "37.19"}],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto2 (USD 37.19): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],      187.19, "p2 total_gastos_usd")
    assert_close(s["total_balance_usd"],          0.00, "p2 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +18.97, "p2 U1 saldo")
    assert_close(st1["total_paid_usd"],        131.03, "p2 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  -18.97, "p2 U2 saldo")
    assert_close(st2["total_paid_usd"],         56.16, "p2 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 3a: Solicitud grupal USD 350.88
    # U1 amount_due=245.62, offset=150.00, restante=95.62
    # U2 amount_due=105.26, offset= 37.19, restante=68.07
    # -----------------------------------------------------------------------
    r = client.get("/contributions/unilateral/unabsorbed", headers=h1p)
    assert r.status_code == 200
    unabsorbed = r.json()
    unilateral_ids = [u["id"] for u in unabsorbed]
    assert len(unilateral_ids) == 2, f"esperaba 2 unilaterales, tengo {len(unilateral_ids)}"

    r = client.post("/contributions", json={
        "description": "Solicitud grupal 1 — USD 350.88",
        "amount": "350.88",
        "currency": "USD",
        "absorb_unilateral_ids": unilateral_ids,
    }, headers=h1p)
    assert r.status_code in (200, 201), f"create contribution 1: {r.text}"
    contrib1_id = r.json()["id"]

    r = client.get(f"/contributions/{contrib1_id}", headers=h1p)
    assert r.status_code == 200
    contrib1 = r.json()
    u1_p1 = next(p for p in contrib1["payments"] if p["user_id"] == u1_id)
    u2_p1 = next(p for p in contrib1["payments"] if p["user_id"] == u2_id)
    u1_payment1_id = u1_p1["payment_id"]
    u2_payment1_id = u2_p1["payment_id"]
    assert_close(u1_p1["amount_due"],        245.62, "p3a U1 cuota bruta")
    assert_close(u1_p1["amount_offset"],     150.00, "p3a U1 offset")
    assert_close(u1_p1["amount_remaining"],   95.62, "p3a U1 restante")
    assert_close(u2_p1["amount_due"],        105.26, "p3a U2 cuota bruta")
    assert_close(u2_p1["amount_offset"],      37.19, "p3a U2 offset")
    assert_close(u2_p1["amount_remaining"],   68.07, "p3a U2 restante")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  -76.65, "p3a U1 saldo (con pendiente)")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  -87.04, "p3a U2 saldo (con pendiente)")

    # -----------------------------------------------------------------------
    # PASO 3b: U1 paga USD 95.62 (auto-aprobado como admin)
    # U1.balance_usd += 95.62 → 114.59
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment1_id}/submit",
        json={
            "amount_paid": "95.62",
            "currency_paid": "USD",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment1: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago1 debe auto-aprobarse (es admin)"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_usd"],    95.62, "p3b caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +114.59, "p3b U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  -87.04, "p3b U2 saldo (pendiente)")

    # -----------------------------------------------------------------------
    # PASO 3c: U2 paga USD 68.07 → admin aprueba
    # U2.balance_usd += 68.07 → 49.10
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment1_id}/submit",
        json={
            "amount_paid": "68.07",
            "currency_paid": "USD",
        },
        headers=h2p,
    )
    assert r.status_code == 200, f"submit u2 payment1: {r.text}"
    assert r.json()["is_paid"] is False, "U2 no es admin → pendiente"

    r = client.put(
        f"/contributions/payments/{u2_payment1_id}/approve",
        json={"approved": True},
        headers=h1p,
    )
    assert r.status_code == 200, f"approve u2 payment1: {r.text}"
    assert r.json()["is_paid"] is True

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       187.19, "p3c total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.09, "p3c gasto_x_m2")
    assert_close(s["total_balance_usd"],          163.69, "p3c caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +114.59, "p3c U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],   +49.10, "p3c U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 4: Gasto USD 70.18 desde caja (sin pagadores)
    # Deducción U1 = 49.13, U2 = 21.05 (suma: 70.18 ✓)
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 3 - equipamiento",
        "amount_original": "70.18",
        "currency_original": "USD",
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto3 (USD 70.18): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       257.37, "p4 total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.13, "p4 gasto_x_m2")
    assert_close(s["total_balance_usd"],           93.51, "p4 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +65.46, "p4 U1 saldo")
    assert_close(st1["total_paid_usd"],        180.16, "p4 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  +28.05, "p4 U2 saldo")
    assert_close(st2["total_paid_usd"],         77.21, "p4 U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5a: Solicitud grupal USD 490.88 — sin absorción
    # U1 amount_due=343.62 | U2 amount_due=147.26
    # -----------------------------------------------------------------------
    r = client.post("/contributions", json={
        "description": "Solicitud grupal 2 — USD 490.88",
        "amount": "490.88",
        "currency": "USD",
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

    assert_close(u1_p2["amount_due"],       343.62, "p5a U1 cuota")
    assert_close(u1_p2["amount_offset"],      0.00, "p5a U1 offset")
    assert_close(u1_p2["amount_remaining"], 343.62, "p5a U1 restante")
    assert_close(u2_p2["amount_due"],       147.26, "p5a U2 cuota")
    assert_close(u2_p2["amount_offset"],      0.00, "p5a U2 offset")
    assert_close(u2_p2["amount_remaining"], 147.26, "p5a U2 restante")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], -278.16, "p5a U1 saldo (con pendiente)")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -119.21, "p5a U2 saldo (con pendiente)")

    # -----------------------------------------------------------------------
    # PASO 5x: Gasto USD 21.05 desde caja (sin pagadores)
    # Deducción U1 = 14.73, U2 = 6.32 (corrección de redondeo: 14.74+6.32=21.06 → U1-=0.01)
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 4 - insumos desde caja",
        "amount_original": "21.05",
        "currency_original": "USD",
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto4 (USD 21.05): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       278.42, "p5x total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.14, "p5x gasto_x_m2")
    assert_close(s["total_balance_usd"],           72.46, "p5x caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], -292.89, "p5x U1 saldo (con pendiente)")
    assert_close(st1["total_paid_usd"],       194.89, "p5x U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -125.53, "p5x U2 saldo (con pendiente)")
    assert_close(st2["total_paid_usd"],        83.53, "p5x U2 gastado")

    # -----------------------------------------------------------------------
    # PASO 5b: U1 paga USD 343.62 (auto-aprobado como admin)
    # U1.balance_usd += 343.62 → 394.35
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u1_payment2_id}/submit",
        json={
            "amount_paid": "343.62",
            "currency_paid": "USD",
        },
        headers=h1p,
    )
    assert r.status_code == 200, f"submit u1 payment2: {r.text}"
    assert r.json()["is_paid"] is True, "U1 pago2 debe auto-aprobarse (es admin)"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_balance_usd"],   416.08, "p5b caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"], +394.35, "p5b U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"], -125.53, "p5b U2 saldo (pendiente)")

    # -----------------------------------------------------------------------
    # PASO 5c: U2 paga USD 147.26 → admin aprueba
    # U2.balance_usd += 147.26 → 168.99
    # -----------------------------------------------------------------------
    r = client.put(
        f"/contributions/payments/{u2_payment2_id}/submit",
        json={
            "amount_paid": "147.26",
            "currency_paid": "USD",
        },
        headers=h2p,
    )
    assert r.status_code == 200, f"submit u2 payment2: {r.text}"
    assert r.json()["is_paid"] is False, "U2 no es admin → pendiente"

    r = client.put(
        f"/contributions/payments/{u2_payment2_id}/approve",
        json={"approved": True},
        headers=h1p,
    )
    assert r.status_code == 200, f"approve u2 payment2: {r.text}"
    assert r.json()["is_paid"] is True

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       278.42, "p5c total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.14, "p5c gasto_x_m2")
    assert_close(s["total_balance_usd"],          563.34, "p5c caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +394.35, "p5c U1 saldo")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  +168.99, "p5c U2 saldo")

    # -----------------------------------------------------------------------
    # PASO 6: Gasto USD 100 con pagadores parciales
    # U1 paga USD 80 | U2 paga USD 10 | caja paga USD 10
    #
    # Balance antes: U1=394.35, U2=168.99
    # Unilaterales:  U1 +80 → 474.35  |  U2 +10 → 178.99
    # Deducción:     U1 −70 → 404.35  |  U2 −30 → 148.99
    # caja = 404.35 + 148.99 = 553.34
    # -----------------------------------------------------------------------
    r = client.post("/expenses", json={
        "description": "Gasto 5 - equipamiento adicional",
        "amount_original": "100.00",
        "currency_original": "USD",
        "payers": [
            {"user_id": u1_id, "amount": "80.00"},
            {"user_id": u2_id, "amount": "10.00"},
        ],
    }, headers=h1p)
    assert r.status_code == 201, f"expense gasto5 (USD 100): {r.text}"

    s = dashboard_summary(client, h1p)
    assert_close(s["total_expenses_usd"],       378.42, "p6 total_gastos_usd")
    assert_close(s["cost_per_square_meter_usd"],  0.19, "p6 gasto_x_m2")
    assert_close(s["total_balance_usd"],          553.34, "p6 caja")

    st1 = my_status(client, h1p)
    assert_close(st1["balance_aportes_usd"],  +404.35, "p6 U1 saldo")
    assert_close(st1["total_paid_usd"],        264.89, "p6 U1 gastado")

    st2 = my_status(client, h2p)
    assert_close(st2["balance_aportes_usd"],  +148.99, "p6 U2 saldo")
    assert_close(st2["total_paid_usd"],        113.53, "p6 U2 gastado")
