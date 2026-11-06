import base64
import json

from app.services import file_storage
from app.services.auth_email import send_email as _deliver_email
from tests.security.test_note_emails import _setup_project, _user

PDF = b'%PDF-1.4\nTest plan\n%%EOF'


def _create(client, headers, files=None, include=True):
    return client.post('/notes/with-attachments', headers=headers,
                       data={'data': json.dumps({'title': 'Plano aprobado', 'note_type': 'notificacion'}),
                             'include_attachments': str(include).lower()},
                       files=files or [('files', ('plano.pdf', PDF, 'application/pdf'))])


def test_create_download_and_email_private_files(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    _, _, _, _, headers = _setup_project(client)
    response = _create(client, headers)
    assert response.status_code == 200, response.text
    note_id = response.json()['id']
    detail = client.get(f'/notes/{note_id}', headers=headers).json()
    file = detail['attachments'][0]
    assert file['filename'] == 'plano.pdf'
    assert 'storage_key' not in file
    download = client.get(f'/notes/{note_id}/attachments/{file["id"]}', headers=headers)
    assert download.content == PDF
    assert 'no-store' in download.headers['cache-control']
    assert len(sent_emails) == 2
    assert base64.b64decode(sent_emails[0]['attachments'][0]['content']) == PDF


def test_invalid_upload_does_not_publish_or_notify(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    *_, headers = _setup_project(client)
    for name, content in [('fake.pdf', b'not a pdf'), ('script.html', PDF), ('big.pdf', b'%PDF-' + b'x' * (10 * 1024 * 1024))]:
        response = _create(client, headers, [('files', (name, content, 'application/pdf'))])
        assert response.status_code in (413, 422), response.text
    assert client.get('/notes', headers=headers).json() == []
    assert sent_emails == []


def test_project_permissions_removal_and_explicit_notification(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    _, _, member_headers, project_id, headers = _setup_project(client)
    response = _create(client, headers, include=False)
    note_id = response.json()['id']
    file_id = client.get(f'/notes/{note_id}', headers=headers).json()['attachments'][0]['id']
    assert sent_emails[0]['attachments'] is None
    assert 'no adjuntos' in sent_emails[0]['text']
    member_headers = {**member_headers, 'X-Project-ID': str(project_id)}
    url = f'/notes/{note_id}/attachments/{file_id}'
    assert client.get(url, headers=member_headers).status_code == 200
    assert client.delete(url, headers=member_headers).status_code == 403
    assert client.post(f'/notes/{note_id}/notify', headers=member_headers, json={}).status_code == 403
    _, outsider_headers = _user('outsider@example.com', 'Otro')
    other = client.post('/projects', headers=outsider_headers, json={'name': 'Otro', 'currency_mode': 'ARS'}).json()['id']
    assert client.get(url, headers={**outsider_headers, 'X-Project-ID': str(other)}).status_code == 404
    sent_emails.clear()
    assert client.post(f'/notes/{note_id}/attachments', headers=headers,
                       files=[('files', ('aprobacion.pdf', PDF, 'application/pdf'))]).status_code == 200
    assert sent_emails == []
    assert client.post(f'/notes/{note_id}/notify', headers=headers, json={}).status_code == 200
    assert len(sent_emails) == 2 and len(sent_emails[0]['attachments']) == 2
    first_delivery = sent_emails[0]['id']
    assert client.post(f'/notes/{note_id}/notify', headers=headers, json={}).status_code == 200
    assert sent_emails[2]['id'] != first_delivery
    assert client.delete(url, headers=headers).status_code == 200
    assert client.get(url, headers=headers).status_code == 404
    assert client.delete(f'/notes/{note_id}', headers=headers).status_code == 200
    assert client.get(f'/notes/{note_id}/attachments/{file_id}', headers=headers).status_code == 404


def test_large_attachments_use_note_link(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    *_, headers = _setup_project(client)
    contents = b'%PDF-' + b'x' * (6 * 1024 * 1024)
    response = _create(client, headers, [('files', ('uno.pdf', contents, 'application/pdf')),
                                       ('files', ('dos.pdf', contents, 'application/pdf'))])
    assert response.status_code == 200, response.text
    assert sent_emails[0]['attachments'] is None
    assert 'Disponibles en la nota' in sent_emails[0]['text']
    assert 'uno.pdf' in sent_emails[0]['text'] and 'dos.pdf' in sent_emails[0]['text']


def test_failed_storage_rolls_back_note_and_files(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    *_, headers = _setup_project(client)
    from pathlib import Path
    original = Path.write_bytes
    calls = []
    def fail_second(path, contents):
        calls.append(path)
        if len(calls) == 2:
            raise OSError('Storage unavailable')
        return original(path, contents)
    monkeypatch.setattr(Path, 'write_bytes', fail_second)
    response = _create(client, headers, [('files', ('uno.pdf', PDF, 'application/pdf')),
                                       ('files', ('dos.pdf', PDF, 'application/pdf'))])
    assert response.status_code == 503
    assert client.get('/notes', headers=headers).json() == []
    assert sent_emails == []
    assert list((tmp_path / 'notes').iterdir()) == []


def test_attachment_limit_applies_to_existing_files(client, sent_emails, monkeypatch, tmp_path):
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    *_, headers = _setup_project(client)
    files = [('files', (f'{i}.pdf', PDF, 'application/pdf')) for i in range(10)]
    note_id = _create(client, headers, files).json()['id']
    sent_emails.clear()
    response = client.post(f'/notes/{note_id}/attachments', headers=headers,
                           files=[('files', ('once.pdf', PDF, 'application/pdf'))])
    assert response.status_code == 422
    assert len(client.get(f'/notes/{note_id}', headers=headers).json()['attachments']) == 10
    assert sent_emails == []


def test_email_transport_serializes_attachments_without_affecting_account_emails(monkeypatch):
    import asyncio
    import httpx
    real_client = httpx.AsyncClient
    payloads = []
    def receive(request):
        payloads.append(json.loads(request.content))
        assert request.headers['Idempotency-Key'] == 'attachment-transport-test'
        return httpx.Response(200, json={'id': 'local-only'})
    transport = httpx.MockTransport(receive)
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: real_client(transport=transport, **kw))
    attachment = {'filename': 'plano.pdf', 'content': base64.b64encode(PDF).decode('ascii')}
    asyncio.run(_deliver_email('local@example.test', 'Nota', 'Contenido', 'attachment-transport-test', [attachment]))
    asyncio.run(_deliver_email('local@example.test', 'Cuenta', 'Contenido', 'attachment-transport-test'))
    assert payloads[0]['attachments'] == [attachment]
    assert 'attachments' not in payloads[1]


def _mock_cloud_download(monkeypatch, status=200):
    import cloudinary
    import httpx
    from urllib.parse import parse_qs
    config = cloudinary.config()
    monkeypatch.setattr(config, 'cloud_name', 'note-test')
    monkeypatch.setattr(config, 'api_key', 'test-key')
    monkeypatch.setattr(config, 'api_secret', 'test-secret')
    real_client = httpx.AsyncClient
    calls = []
    def receive(request):
        calls.append(request)
        assert request.url.host == 'api.cloudinary.com'
        assert request.url.path == '/v1_1/note-test/raw/download'
        query = parse_qs(request.url.query.decode())
        assert query['public_id'] == ['construccion/notes/26/stored.pdf']
        assert query['type'] == ['authenticated']
        assert 'format' not in query  # Raw IDs already include .pdf.
        assert 'expires_at' in query and 'signature' in query
        return httpx.Response(status, content=PDF if status == 200 else b'private error',
                              headers={'Content-Type': 'application/pdf'})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: real_client(transport=httpx.MockTransport(receive), **kw))
    return calls


def _cloud_attachment(client, headers, monkeypatch, tmp_path):
    from app.database import SessionLocal
    from app.models.note import NoteAttachment
    monkeypatch.setattr(file_storage, 'cloudinary_configured', False)
    monkeypatch.setattr(file_storage.settings, 'upload_dir', str(tmp_path))
    note_id = _create(client, headers).json()['id']
    with SessionLocal() as db:
        attachment = db.query(NoteAttachment).filter_by(note_id=note_id).one()
        attachment.storage_key = 'cloud:construccion/notes/26/stored.pdf'
        attachment_id = attachment.id
        db.commit()
    return note_id, attachment_id


def test_cloud_private_download_and_update_email(client, sent_emails, monkeypatch, tmp_path):
    *_, headers = _setup_project(client)
    note_id, attachment_id = _cloud_attachment(client, headers, monkeypatch, tmp_path)
    calls = _mock_cloud_download(monkeypatch)
    response = client.get(f'/notes/{note_id}/attachments/{attachment_id}', headers=headers)
    assert response.status_code == 200, response.text
    assert response.content == PDF
    assert response.headers['content-type'] == 'application/pdf'
    assert 'attachment;' in response.headers['content-disposition']
    assert client.post(f'/notes/{note_id}/notify', headers=headers, json={}).status_code == 200
    assert len(calls) == 2
    assert base64.b64decode(sent_emails[-1]['attachments'][0]['content']) == PDF


def test_cloud_download_error_is_safe_and_keeps_file(client, sent_emails, monkeypatch, tmp_path, caplog):
    *_, headers = _setup_project(client)
    note_id, attachment_id = _cloud_attachment(client, headers, monkeypatch, tmp_path)
    _mock_cloud_download(monkeypatch, 403)
    response = client.get(f'/notes/{note_id}/attachments/{attachment_id}', headers=headers)
    assert response.status_code == 503
    assert response.json()['detail'] == 'El adjunto no está disponible. Intentá nuevamente'
    assert 'provider_status=403' in caplog.text
    assert 'signature=' not in caplog.text and 'test-secret' not in caplog.text
    assert len(client.get(f'/notes/{note_id}', headers=headers).json()['attachments']) == 1
