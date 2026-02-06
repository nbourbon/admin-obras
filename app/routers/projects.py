from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectMemberCreate,
    ProjectMemberUpdate,
    ProjectMemberResponse,
    ProjectWithMembers,
)
from app.utils.dependencies import get_current_user, get_project_admin_user, is_project_admin
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all projects the user is a member of.
    All users only see projects where they are members.
    """
    # Get projects where user is a member
    projects = (
        db.query(Project)
        .join(ProjectMember)
        .filter(
            ProjectMember.user_id == current_user.id,
            ProjectMember.is_active == True,
            Project.is_active == True,
        )
        .order_by(Project.name)
        .all()
    )

    # Add current_user_is_admin flag to each project
    result = []
    for project in projects:
        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "created_by": project.created_by,
            "is_individual": project.is_individual,
            "is_active": project.is_active,
            "created_at": project.created_at,
            "current_user_is_admin": is_project_admin(db, current_user.id, project.id),
        }
        result.append(ProjectResponse(**project_dict))

    return result


@router.post("", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new project. Any authenticated user can create a project and becomes its admin."""
    project = Project(
        name=project_data.name,
        description=project_data.description,
        is_individual=project_data.is_individual,
        created_by=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Add creator as a member with 0% participation AND is_admin=True
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        participation_percentage=Decimal("0"),
        is_admin=True,  # Creator is admin of the project
    )
    db.add(member)
    db.commit()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_by=project.created_by,
        is_individual=project.is_individual,
        is_active=project.is_active,
        created_at=project.created_at,
        current_user_is_admin=True,  # Creator is always admin
    )


@router.get("/{project_id}", response_model=ProjectWithMembers)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get project details with members."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_active == True,
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check access - user must be a member
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )

    # Build response with members
    members = (
        db.query(ProjectMember)
        .join(User)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.is_active == True,
            User.is_active == True,
        )
        .all()
    )

    member_responses = [
        ProjectMemberResponse(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            user_name=m.user.full_name,
            user_email=m.user.email,
            participation_percentage=m.participation_percentage,
            is_admin=m.is_admin,
            is_active=m.is_active,
            created_at=m.created_at,
        )
        for m in members
    ]

    return ProjectWithMembers(
        id=project.id,
        name=project.name,
        description=project.description,
        created_by=project.created_by,
        is_individual=project.is_individual,
        is_active=project.is_active,
        created_at=project.created_at,
        current_user_is_admin=member.is_admin,
        members=member_responses,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
):
    """Update project details (project admin only)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_by=project.created_by,
        is_individual=project.is_individual,
        is_active=project.is_active,
        created_at=project.created_at,
        current_user_is_admin=True,  # Caller is project admin
    )


@router.delete("/{project_id}")
async def deactivate_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
):
    """Deactivate a project (project admin only)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    project.is_active = False
    db.commit()
    return {"message": "Project deactivated successfully"}


# Member management endpoints

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all members of a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_active == True,
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check access - user must be a member
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id,
        ProjectMember.is_active == True,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project",
        )

    members = (
        db.query(ProjectMember)
        .join(User)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.is_active == True,
            User.is_active == True,
        )
        .order_by(User.full_name)
        .all()
    )

    return [
        ProjectMemberResponse(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            user_name=m.user.full_name,
            user_email=m.user.email,
            participation_percentage=m.participation_percentage,
            is_admin=m.is_admin,
            is_active=m.is_active,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
async def add_project_member(
    project_id: int,
    member_data: ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
):
    """Add a member to a project (project admin only)."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_active == True,
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check if user exists
    user = db.query(User).filter(
        User.id == member_data.user_id,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if already a member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member_data.user_id,
    ).first()

    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this project",
            )
        # Reactivate
        existing.is_active = True
        existing.participation_percentage = member_data.participation_percentage
        existing.is_admin = member_data.is_admin
        db.commit()
        db.refresh(existing)
        return ProjectMemberResponse(
            id=existing.id,
            project_id=existing.project_id,
            user_id=existing.user_id,
            user_name=user.full_name,
            user_email=user.email,
            participation_percentage=existing.participation_percentage,
            is_admin=existing.is_admin,
            is_active=existing.is_active,
            created_at=existing.created_at,
        )

    # Create new membership (new members are NOT admins by default)
    member = ProjectMember(
        project_id=project_id,
        user_id=member_data.user_id,
        participation_percentage=member_data.participation_percentage,
        is_admin=member_data.is_admin,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        user_name=user.full_name,
        user_email=user.email,
        participation_percentage=member.participation_percentage,
        is_admin=member.is_admin,
        is_active=member.is_active,
        created_at=member.created_at,
    )


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    project_id: int,
    user_id: int,
    member_data: ProjectMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
):
    """Update a member's participation percentage or admin status (project admin only)."""
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    update_data = member_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)

    user = db.query(User).filter(User.id == user_id).first()

    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        user_name=user.full_name,
        user_email=user.email,
        participation_percentage=member.participation_percentage,
        is_admin=member.is_admin,
        is_active=member.is_active,
        created_at=member.created_at,
    )


@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_project_admin_user),
):
    """Remove a member from a project (project admin only)."""
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    member.is_active = False
    db.commit()
    return {"message": "Member removed successfully"}


@router.get("/{project_id}/participation-validation")
async def validate_participation(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate that participation percentages sum to 100%."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.is_active == True,
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    members = (
        db.query(ProjectMember)
        .join(User)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.is_active == True,
            User.is_active == True,
        )
        .all()
    )

    total = sum(m.participation_percentage for m in members)
    is_valid = total == Decimal("100")

    return {
        "is_valid": is_valid,
        "total_percentage": float(total),
        "message": "Percentages sum to 100%" if is_valid else f"Percentages sum to {total}%, should be 100%",
    }
