from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.note import NoteType


# Vote Option Schemas
class VoteOptionCreate(BaseModel):
    option_text: str


class VoteOptionResponse(BaseModel):
    id: int
    option_text: str
    display_order: int
    vote_count: int = 0

    class Config:
        from_attributes = True


class VoterInfo(BaseModel):
    user_id: int
    user_name: str
    participation_percentage: float


class VoteOptionWithVoters(VoteOptionResponse):
    voters: List[VoterInfo] = []  # List of voters with their participation %
    participation_percentage: float = 0  # Total participation % for this option


# User Vote Schemas
class CastVote(BaseModel):
    option_id: int


class UserVoteResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    voted_at: datetime

    class Config:
        from_attributes = True


# Comment Schemas
class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    note_id: int
    user_id: int
    user_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# Participant Schemas
class NoteParticipantResponse(BaseModel):
    id: int
    user_id: int
    user_name: str

    class Config:
        from_attributes = True


# Note Schemas
class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None


class NoteCreate(NoteBase):
    note_type: NoteType = NoteType.REUNION
    meeting_date: Optional[datetime] = None  # For reunion notes
    participant_ids: List[int] = []           # Only for reunion notes
    voting_description: Optional[str] = None  # Only for votacion notes
    vote_options: List[str] = []              # Only for votacion notes


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    meeting_date: Optional[datetime] = None
    voting_description: Optional[str] = None


class NoteResponse(NoteBase):
    id: int
    project_id: int
    note_type: NoteType
    meeting_date: Optional[datetime] = None
    voting_description: Optional[str] = None
    created_by: int
    creator_name: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    participant_count: int = 0
    comment_count: int = 0

    class Config:
        from_attributes = True


class NoteDetailResponse(NoteResponse):
    participants: List[NoteParticipantResponse] = []
    comments: List[CommentResponse] = []
    vote_options: List[VoteOptionWithVoters] = []
    user_has_voted: bool = False
    user_vote_option_id: Optional[int] = None
