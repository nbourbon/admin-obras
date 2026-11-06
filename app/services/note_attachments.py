"""Private note files; provider addresses are never exposed to clients or emails."""
from pathlib import Path
from uuid import uuid4
import logging
import time
from starlette.concurrency import run_in_threadpool

import httpx
from fastapi import HTTPException

from app.models.note import NoteAttachment
from app.services import file_storage

logger = logging.getLogger(__name__)


class _HidePrivateDownloadURL(logging.Filter):
    def filter(self, record):
        # httpx logs complete request URLs at INFO, including API signatures.
        # Keep our status-only diagnostics, without persisting access links.
        return not any("api.cloudinary.com" in str(arg) and "/download" in str(arg)
                       for arg in record.args)


logging.getLogger("httpx").addFilter(_HidePrivateDownloadURL())


async def prepare_attachments(files, existing=()):
    if len(files) + len(existing) > 10:
        raise HTTPException(422, "La nota admite hasta 10 adjuntos")
    prepared = []
    total = sum(a.size for a in existing)
    types = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
    for file in files:
        try:
            filename = Path((file.filename or "").replace("\\", "/")).name
            ext = filename.rsplit(".", 1)[-1].lower()
            if ext not in types or len(filename) > 255 or any(ord(c) < 32 for c in filename):
                raise HTTPException(422, "Solo se admiten PDF, JPG y PNG con nombres válidos")
            contents = await file_storage.read_validated_file(file)
            valid = (ext == "pdf" and contents.startswith(b"%PDF-")) or (ext in ("jpg", "jpeg") and contents.startswith(b"\xff\xd8\xff")) or (ext == "png" and contents.startswith(b"\x89PNG\r\n\x1a\n"))
            if not valid:
                raise HTTPException(422, "El contenido del archivo no coincide con su formato")
            total += len(contents)
            if total > 50 * 1024 * 1024:
                raise HTTPException(413, "Los adjuntos de la nota no pueden superar 50 MB en total")
            prepared.append((filename, types[ext], contents))
        finally:
            await file.close()
    return prepared


async def persist_attachments(db, note, prepared):
    stored = []
    try:
        for filename, content_type, contents in prepared:
            key = f"construccion/notes/{note.id}/{uuid4().hex}.{filename.rsplit('.', 1)[-1].lower()}"
            if file_storage.cloudinary_configured:
                import cloudinary.uploader
                await run_in_threadpool(cloudinary.uploader.upload, contents, public_id=key, resource_type="raw", type="authenticated")
                storage_key = "cloud:" + key
            else:
                path = file_storage.get_upload_dir() / "notes" / key.rsplit("/", 1)[-1]
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(contents)
                storage_key = "local:" + path.name
            stored.append(storage_key)
            db.add(NoteAttachment(note_id=note.id, filename=filename, content_type=content_type,
                                  size=len(contents), storage_key=storage_key))
        db.commit()
    except Exception:
        db.rollback()
        for key in stored:
            try:
                if key.startswith("cloud:"):
                    import cloudinary.uploader
                    await run_in_threadpool(cloudinary.uploader.destroy, key[6:], resource_type="raw", type="authenticated")
                else:
                    (file_storage.get_upload_dir() / "notes" / key[6:]).unlink(missing_ok=True)
            except Exception:
                pass
        raise HTTPException(503, "No se pudieron guardar los adjuntos. Intentá nuevamente")


async def read_attachment(attachment):
    try:
        if attachment.storage_key.startswith("cloud:"):
            import cloudinary.utils
            # Use the authenticated download API. CDN delivery can reject PDFs
            # even when the asset was uploaded successfully and its URL is signed.
            # Raw public IDs already contain their extension; adding a format
            # would change the requested asset's identity.
            url = cloudinary.utils.private_download_url(
                attachment.storage_key[6:], None, resource_type="raw",
                type="authenticated", expires_at=int(time.time()) + 60,
            )
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        return (file_storage.get_upload_dir() / "notes" / attachment.storage_key[6:]).read_bytes()
    except httpx.HTTPStatusError as exc:
        # URLs contain access signatures: never log the exception or request URL.
        logger.warning("Note attachment download failed (id=%s, provider_status=%s)",
                       attachment.id, exc.response.status_code)
        raise HTTPException(503, "El adjunto no está disponible. Intentá nuevamente") from None
    except (OSError, httpx.HTTPError):
        raise HTTPException(503, "El adjunto no está disponible. Intentá nuevamente")
