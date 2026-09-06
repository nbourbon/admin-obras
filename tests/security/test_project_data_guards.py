from app.services.auth import create_access_token
from tests.user_factory import seed_verified_user


PASSWORD = "Secure-pass-123"


def _user(email, name):
    user_id = seed_verified_user({
        "email": email,
        "password": PASSWORD,
        "full_name": name,
    }).json()["id"]
    return user_id, {"Authorization": "Bearer " + create_access_token({"sub": str(user_id)})}


def _project(client, headers, name):
    response = client.post("/projects", headers=headers, json={
        "name": name,
        "currency_mode": "ARS",
    })
    assert response.status_code == 200, response.text
    project_id = response.json()["id"]
    return project_id, {**headers, "X-Project-ID": str(project_id)}


def test_project_header_is_required_and_foreign_ids_are_hidden(client):
    _, owner_headers = _user("scope-owner@example.com", "Responsable")
    project_a, headers_a = _project(client, owner_headers, "Proyecto A")
    _, headers_b = _project(client, owner_headers, "Proyecto B")

    expense = client.post("/expenses", headers=headers_a, json={
        "description": "Gasto reservado",
        "amount_original": "100.00",
        "currency_original": "ARS",
    })
    assert expense.status_code == 201, expense.text

    contribution = client.post("/contributions", headers=headers_a, json={
        "description": "Aporte reservado",
        "amount": "100.00",
        "currency": "ARS",
    })
    assert contribution.status_code in (200, 201), contribution.text

    note = client.post("/notes", headers=headers_a, json={
        "title": "Nota reservada",
        "content": "Contenido privado",
        "note_type": "notificacion",
    })
    assert note.status_code == 200, note.text

    for path in ("/expenses", "/contributions", "/notes", "/payments/my"):
        assert client.get(path, headers=owner_headers).status_code == 400

    foreign_paths = (
        f"/expenses/{expense.json()['id']}",
        f"/contributions/{contribution.json()['id']}",
        f"/notes/{note.json()['id']}",
    )
    for path in foreign_paths:
        response = client.get(path, headers=headers_b)
        assert response.status_code == 404, (path, response.text)

    own_expenses = client.get("/expenses", headers=headers_a)
    assert own_expenses.status_code == 200
    payment_id = own_expenses.json()[0]["my_payment_id"]
    assert payment_id is not None
    assert client.get(f"/payments/{payment_id}", headers=headers_b).status_code == 404

    assert project_a != int(headers_b["X-Project-ID"])


def test_notes_remove_executable_html_from_new_and_legacy_content(client):
    _, owner_headers = _user("xss-owner@example.com", "Responsable")
    _, headers = _project(client, owner_headers, "Proyecto Seguro")

    response = client.post("/notes", headers=headers, json={
        "title": "Contenido enriquecido",
        "content": (
            '<p onclick="steal()">Hola <strong>equipo</strong></p>'
            '<img src=x onerror="steal()"><script>alert(1)</script>'
            '<a href="javascript:steal()">enlace</a>'
        ),
        "note_type": "notificacion",
    })
    assert response.status_code == 200, response.text
    content = response.json()["content"]
    assert "<strong>equipo</strong>" in content
    for unsafe in ("script", "onclick", "onerror", "javascript:", "<img"):
        assert unsafe not in content.lower()

    detail = client.get(f"/notes/{response.json()['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["content"] == content


def test_invalid_amounts_and_partial_contribution_payment_are_rejected(client):
    owner_id, owner_headers = _user("amount-owner@example.com", "Responsable")
    member_id, member_headers = _user("amount-member@example.com", "Integrante")
    project_id, headers = _project(client, owner_headers, "Proyecto Importes")

    negative = client.post("/expenses", headers=headers, json={
        "description": "Importe inválido",
        "amount_original": "-10.00",
        "currency_original": "ARS",
    })
    assert negative.status_code == 422
    assert client.get("/expenses", headers=headers).json() == []

    assert client.put(
        f"/projects/{project_id}/members/{owner_id}",
        headers=headers,
        json={"participation_percentage": 50},
    ).status_code == 200
    assert client.post(
        f"/projects/{project_id}/members",
        headers=headers,
        json={"user_id": member_id, "participation_percentage": 50},
    ).status_code == 200

    contribution = client.post("/contributions", headers=headers, json={
        "description": "Aporte completo",
        "amount": "100.00",
        "currency": "ARS",
    })
    assert contribution.status_code in (200, 201), contribution.text
    detail = client.get(f"/contributions/{contribution.json()['id']}", headers=headers).json()
    member_payment = next(item for item in detail["payments"] if item["user_id"] == member_id)

    partial = client.put(
        f"/contributions/payments/{member_payment['payment_id']}/submit",
        headers={**member_headers, "X-Project-ID": str(project_id)},
        json={"amount_paid": "1.00", "currency_paid": "ARS"},
    )
    assert partial.status_code == 422, partial.text

    refreshed = client.get(f"/contributions/{contribution.json()['id']}", headers=headers).json()
    member_payment = next(item for item in refreshed["payments"] if item["user_id"] == member_id)
    assert member_payment["is_paid"] is False
    assert member_payment["amount_paid"] in (None, "0.00")
