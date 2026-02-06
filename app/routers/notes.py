from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.note import Note, NoteParticipant, NoteType
from app.models.note_comment import NoteComment
from app.models.vote import VoteOption, UserVote
from app.models.project_member import ProjectMember
from app.schemas.note import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteDetailResponse,
    CommentCreate,
    CommentResponse,
    CastVote,
    NoteParticipantResponse,
    VoteOptionWithVoters,
    VoterInfo,
)
from app.utils.dependencies import get_current_user, is_project_admin

router = APIRouter(prefix="/notes", tags=["notes"])


def get_project_id(x_project_id: Optional[str] = Header(None)) -> Optional[int]:
    if x_project_id:
        try:
            return int(x_project_id)
        except ValueError:
            return None
    return None


def build_note_response(note: Note, db: Session) -> NoteResponse:
    """Build a NoteResponse from a Note model."""
    creator = db.query(User).filter(User.id == note.created_by).first()
    active_comments = [c for c in note.comments if c.is_active]
    return NoteResponse(
        id=note.id,
        project_id=note.project_id,
        title=note.title,
        content=note.content,
        note_type=note.note_type,
        voting_description=note.voting_description,
        created_by=note.created_by,
        creator_name=creator.full_name if creator else "Unknown",
        is_active=note.is_active,
        created_at=note.created_at,
        updated_at=note.updated_at,
        participant_count=len(note.participants),
        comment_count=len(active_comments),
    )


def build_note_detail_response(note: Note, db: Session, current_user_id: int) -> NoteDetailResponse:
    """Build a NoteDetailResponse from a Note model."""
    creator = db.query(User).filter(User.id == note.created_by).first()

    # Build participants list
    participants = []
    for p in note.participants:
        user = db.query(User).filter(User.id == p.user_id).first()
        if user:
            participants.append(NoteParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                user_name=user.full_name,
            ))

    # Build comments list (only active ones)
    comments = []
    for c in note.comments:
        if c.is_active:
            user = db.query(User).filter(User.id == c.user_id).first()
            comments.append(CommentResponse(
                id=c.id,
                note_id=c.note_id,
                user_id=c.user_id,
                user_name=user.full_name if user else "Unknown",
                content=c.content,
                created_at=c.created_at,
            ))

    # Build vote options with voters and participation percentages
    vote_options = []
    user_has_voted = False
    user_vote_option_id = None

    # Get participation percentages for all project members
    member_percentages = {}
    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == note.project_id,
        ProjectMember.is_active == True
    ).all()
    for member in members:
        member_percentages[member.user_id] = float(member.participation_percentage)

    for option in sorted(note.vote_options, key=lambda x: x.display_order):
        voters = []
        option_participation = 0.0
        for vote in option.votes:
            voter = db.query(User).filter(User.id == vote.user_id).first()
            if voter:
                voter_percentage = member_percentages.get(vote.user_id, 0)
                voters.append(VoterInfo(
                    user_id=vote.user_id,
                    user_name=voter.full_name,
                    participation_percentage=voter_percentage,
                ))
                option_participation += voter_percentage
            if vote.user_id == current_user_id:
                user_has_voted = True
                user_vote_option_id = option.id

        vote_options.append(VoteOptionWithVoters(
            id=option.id,
            option_text=option.option_text,
            display_order=option.display_order,
            vote_count=len(option.votes),
            voters=voters,
            participation_percentage=option_participation,
        ))

    return NoteDetailResponse(
        id=note.id,
        project_id=note.project_id,
        title=note.title,
        content=note.content,
        note_type=note.note_type,
        voting_description=note.voting_description,
        created_by=note.created_by,
        creator_name=creator.full_name if creator else "Unknown",
        is_active=note.is_active,
        created_at=note.created_at,
        updated_at=note.updated_at,
        participant_count=len(note.participants),
        comment_count=len(comments),
        participants=participants,
        comments=comments,
        vote_options=vote_options,
        user_has_voted=user_has_voted,
        user_vote_option_id=user_vote_option_id,
    )


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    x_project_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all notes for the current project, ordered by most recent first."""
    project_id = get_project_id(x_project_id)
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID required")

    notes = (
        db.query(Note)
        .filter(Note.project_id == project_id)
        .filter(Note.is_active == True)
        .order_by(Note.created_at.desc())
        .all()
    )

    return [build_note_response(note, db) for note in notes]


@router.post("", response_model=NoteResponse)
async def create_note(
    note_data: NoteCreate,
    x_project_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new note (regular or voting)."""
    project_id = get_project_id(x_project_id)
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID required")

    # Create the note
    note = Note(
        project_id=project_id,
        title=note_data.title,
        content=note_data.content,
        note_type=note_data.note_type,
        voting_description=note_data.voting_description if note_data.note_type == NoteType.VOTING else None,
        created_by=current_user.id,
    )
    db.add(note)
    db.flush()  # Get the note ID

    # Add participants
    for user_id in note_data.participant_ids:
        participant = NoteParticipant(
            note_id=note.id,
            user_id=user_id,
        )
        db.add(participant)

    # Add vote options for voting notes
    if note_data.note_type == NoteType.VOTING:
        for i, option_text in enumerate(note_data.vote_options):
            option = VoteOption(
                note_id=note.id,
                option_text=option_text,
                display_order=i,
            )
            db.add(option)

    db.commit()
    db.refresh(note)

    return build_note_response(note, db)


@router.get("/{note_id}", response_model=NoteDetailResponse)
async def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get note detail with comments and votes."""
    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return build_note_detail_response(note, db, current_user.id)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a note (only creator or project admin can update)."""
    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Check permissions - creator or project admin
    is_admin = note.project_id and is_project_admin(db, current_user.id, note.project_id)
    if note.created_by != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this note")

    # Update fields
    if note_data.title is not None:
        note.title = note_data.title
    if note_data.content is not None:
        note.content = note_data.content
    if note_data.voting_description is not None and note.note_type == NoteType.VOTING:
        note.voting_description = note_data.voting_description

    db.commit()
    db.refresh(note)

    return build_note_response(note, db)


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a note (only creator or project admin can delete)."""
    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Check permissions - creator or project admin
    is_admin = note.project_id and is_project_admin(db, current_user.id, note.project_id)
    if note.created_by != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")

    note.is_active = False
    db.commit()

    return {"message": "Note deleted successfully"}


# Comment endpoints

@router.post("/{note_id}/comments", response_model=CommentResponse)
async def add_comment(
    note_id: int,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    comment = NoteComment(
        note_id=note_id,
        user_id=current_user.id,
        content=comment_data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        note_id=comment.note_id,
        user_id=comment.user_id,
        user_name=current_user.full_name,
        content=comment.content,
        created_at=comment.created_at,
    )


@router.delete("/{note_id}/comments/{comment_id}")
async def delete_comment(
    note_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a comment (only comment owner or admin can delete)."""
    comment = (
        db.query(NoteComment)
        .filter(NoteComment.id == comment_id, NoteComment.note_id == note_id, NoteComment.is_active == True)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Check permissions - comment owner or project admin
    note = db.query(Note).filter(Note.id == note_id).first()
    is_admin = note and note.project_id and is_project_admin(db, current_user.id, note.project_id)
    if comment.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    comment.is_active = False
    db.commit()

    return {"message": "Comment deleted successfully"}


# Voting endpoints

@router.post("/{note_id}/vote")
async def cast_vote(
    note_id: int,
    vote_data: CastVote,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cast a vote on a voting note (irreversible for non-admin)."""
    note = db.query(Note).filter(Note.id == note_id, Note.is_active == True).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note.note_type != NoteType.VOTING:
        raise HTTPException(status_code=400, detail="This note is not a voting note")

    # Check if option belongs to this note
    option = db.query(VoteOption).filter(
        VoteOption.id == vote_data.option_id,
        VoteOption.note_id == note_id,
    ).first()
    if not option:
        raise HTTPException(status_code=404, detail="Vote option not found")

    # Check if user already voted on this note
    existing_vote = (
        db.query(UserVote)
        .join(VoteOption)
        .filter(VoteOption.note_id == note_id, UserVote.user_id == current_user.id)
        .first()
    )
    if existing_vote:
        raise HTTPException(status_code=400, detail="You have already voted on this note")

    # Create the vote
    vote = UserVote(
        vote_option_id=vote_data.option_id,
        user_id=current_user.id,
    )
    db.add(vote)
    db.commit()

    return {"message": "Vote cast successfully"}


@router.delete("/{note_id}/vote/{user_id}")
async def reset_vote(
    note_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset a user's vote (project admin only)."""
    # Get the note to check project admin
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Verify user is admin of the note's project
    if not note.project_id or not is_project_admin(db, current_user.id, note.project_id):
        raise HTTPException(status_code=403, detail="You must be an admin of this project")

    # Find the user's vote on this note
    vote = (
        db.query(UserVote)
        .join(VoteOption)
        .filter(VoteOption.note_id == note_id, UserVote.user_id == user_id)
        .first()
    )
    if not vote:
        raise HTTPException(status_code=404, detail="Vote not found")

    db.delete(vote)
    db.commit()

    return {"message": "Vote reset successfully"}
