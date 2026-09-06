"""Plain-text email notifications for newly created project notes."""
from html.parser import HTMLParser

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.note import Note, NoteType
from app.models.project_member import ProjectMember
from app.models.user import User
from app.services.auth_email import send_email


class _PlainTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "li":
            self.parts.append("\n- ")
        elif tag in {"br", "p", "div", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"p", "div", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(value: str | None) -> str:
    if not value:
        return ""
    parser = _PlainTextParser()
    parser.feed(value)
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return "\n".join(line for line in lines if line).strip()


def _format_date(value) -> str:
    return value.strftime("%d/%m/%Y %H:%M") if value else "Sin fecha indicada"


def build_note_email(note: Note, project_name: str, participant_names: list[str]) -> tuple[str, str]:
    is_vote = note.note_type in (NoteType.VOTACION, NoteType.VOTING)
    is_meeting = note.note_type in (NoteType.REUNION, NoteType.REGULAR)
    if is_vote:
        subject = f"Nueva Votación - Proyecto {project_name}"
    elif is_meeting:
        subject = f"Notas de la Reunión - Proyecto {project_name}"
    else:
        subject = f"Nueva Notificación - Proyecto {project_name}"

    sections = [f"Proyecto: {project_name}", f"Título: {note.title}"]
    content = html_to_text(note.content)

    if is_vote:
        sections.append("Estás siendo invitado/a a una votación.")
        description = html_to_text(note.voting_description)
        if description:
            sections.append(f"Detalles de la votación:\n{description}")
        if content:
            sections.append(f"Contenido:\n{content}")
        options = [option.option_text for option in sorted(note.vote_options, key=lambda item: item.display_order)]
        if options:
            sections.append("Opciones:\n" + "\n".join(f"- {option}" for option in options))
        sections.append(f"Cierre: {_format_date(note.voting_closes_at)}")
    else:
        if is_meeting:
            sections.append(f"Fecha de la reunión: {_format_date(note.meeting_date)}")
        if content:
            sections.append(content)
        if is_meeting:
            attendees = ", ".join(participant_names) if participant_names else "No se indicaron participantes"
            sections.append(f"Participantes: {attendees}")

    link = f"{get_settings().frontend_url.rstrip('/')}/notes/{note.id}"
    sections.extend([
        f"Ver la nota en Obrador:\n{link}",
        "es una solución de Proyectos Compartidos - obrador.xyz",
    ])
    return subject, "\n\n".join(sections)


def schedule_note_emails(db: Session, tasks: BackgroundTasks, note: Note, project_name: str) -> int:
    recipients = (
        db.query(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(
            ProjectMember.project_id == note.project_id,
            ProjectMember.is_active == True,
            ProjectMember.invitation_accepted == True,
            User.is_active == True,
            User.email_verified == True,
        )
        .distinct()
        .all()
    )
    participant_names = [participant.user.full_name for participant in note.participants if participant.user]
    subject, text = build_note_email(note, project_name, participant_names)
    for recipient in recipients:
        tasks.add_task(
            send_email,
            recipient.email,
            subject,
            text,
            f"project-note-{note.id}-user-{recipient.id}",
        )
    return len(recipients)
