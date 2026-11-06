"""Read-only deployment check of the same storage path used by note downloads.

Uses an existing attachment; never creates notes, uploads files or sends emails.
Prints only IDs and byte counts, never file contents or signed provider URLs.
"""
import asyncio

from app.database import SessionLocal
from app.models.note import Note, NoteAttachment
from app.services.note_attachments import read_attachment


async def main():
    with SessionLocal() as db:
        attachment = (db.query(NoteAttachment).join(Note, Note.id == NoteAttachment.note_id)
                      .filter(NoteAttachment.is_active == True, Note.is_active == True)
                      .order_by(NoteAttachment.id.desc()).first())
        if attachment is None:
            print("Note storage check skipped: no active attachments")
            return
        contents = await read_attachment(attachment)
        if len(contents) != attachment.size:
            raise RuntimeError("Note storage check failed: downloaded byte count differs")
        print(f"Note storage check passed: attachment_id={attachment.id}, bytes={len(contents)}")


if __name__ == "__main__":
    asyncio.run(main())
