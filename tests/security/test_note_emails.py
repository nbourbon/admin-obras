from app.database import SessionLocal
from app.models.project_member import ProjectMember
from app.services.auth import create_access_token
from tests.user_factory import seed_verified_user


PASSWORD = "Secure-pass-123"


def _user(email, name):
    user_id = seed_verified_user({"email": email, "password": PASSWORD, "full_name": name}).json()["id"]
    return user_id, {"Authorization": "Bearer " + create_access_token({"sub": str(user_id)})}


def _setup_project(client):
    owner_id, owner_headers = _user("owner@example.com", "Responsable")
    member_id, member_headers = _user("member@example.com", "Integrante")
    project = client.post("/projects", headers=owner_headers, json={"name": "Torre Norte", "currency_mode": "ARS"})
    project_id = project.json()["id"]
    headers = {**owner_headers, "X-Project-ID": str(project_id)}
    assert client.post(f"/projects/{project_id}/members", headers=headers, json={"user_id": member_id}).status_code == 200
    return owner_id, member_id, member_headers, project_id, headers


def test_note_emails_cover_all_types_and_recipients(client, sent_emails):
    owner_id, member_id, _, _, headers = _setup_project(client)

    response = client.post("/notes", headers=headers, json={
        "title": "Ingreso de materiales",
        "content": "<p>Llegan los <strong>materiales</strong>.</p><ul><li>Controlar acceso</li></ul>",
        "note_type": "notificacion",
    })
    assert response.status_code == 200, response.text
    assert len(sent_emails) == 2
    assert {message["to"] for message in sent_emails} == {"owner@example.com", "member@example.com"}
    assert all(message["subject"] == "Nueva Notificación - Proyecto Torre Norte" for message in sent_emails)
    assert "Llegan los materiales.\n- Controlar acceso" in sent_emails[0]["text"]
    assert "<p>" not in sent_emails[0]["text"]
    assert "es una solución de Proyectos Compartidos - obrador.xyz" in sent_emails[0]["text"]

    sent_emails.clear()
    response = client.post("/notes", headers=headers, json={
        "title": "Reunión semanal",
        "content": "Se revisó el cronograma.",
        "note_type": "reunion",
        "participant_ids": [owner_id, member_id],
        "meeting_date": "2026-09-06T10:30:00Z",
    })
    assert response.status_code == 200, response.text
    assert sent_emails[0]["subject"] == "Notas de la Reunión - Proyecto Torre Norte"
    assert "Participantes: Responsable, Integrante" in sent_emails[0]["text"]

    sent_emails.clear()
    response = client.post("/notes", headers=headers, json={
        "title": "Elegir terminación",
        "content": "Definir el color final.",
        "note_type": "votacion",
        "voting_description": "Seleccionar una alternativa.",
        "vote_options": ["Gris", "Blanco"],
        "voting_duration_days": 2,
    })
    assert response.status_code == 200, response.text
    assert sent_emails[0]["subject"] == "Nueva Votación - Proyecto Torre Norte"
    assert "Estás siendo invitado/a a una votación." in sent_emails[0]["text"]
    assert "- Gris\n- Blanco" in sent_emails[0]["text"]
    assert f"/notes/{response.json()['id']}" in sent_emails[0]["text"]


def test_inactive_member_cannot_create_note_or_trigger_email(client, sent_emails):
    _, member_id, member_headers, project_id, _ = _setup_project(client)
    with SessionLocal() as db:
        membership = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == member_id,
        ).one()
        membership.is_active = False
        db.commit()
    response = client.post("/notes", headers={**member_headers, "X-Project-ID": str(project_id)}, json={
        "title": "No autorizado", "note_type": "notificacion",
    })
    assert response.status_code == 403
    assert sent_emails == []
