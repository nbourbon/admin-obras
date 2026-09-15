import hashlib
import json
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.models.project_member import ProjectMember
from app.models.project_member_history import ProjectMemberHistory
from app.models.composition_change import CompositionChange
from app.schemas.composition import CompositionRequest
from app.services.composition import preview, utc
from app.services.accounting_reversal import change_member_balance
from app.services.auth_email import require_email_config, issue_action
from app.utils.dependencies import get_project_admin_user

router = APIRouter(prefix='/projects/{project_id}/compositions', tags=['Compositions'])


@router.get('')
def history(project_id: int, db: Session = Depends(get_db), actor: User = Depends(get_project_admin_user)):
    changes = db.query(CompositionChange).filter_by(project_id=project_id).order_by(CompositionChange.id.desc()).all()
    return [dict(id=c.id, created_at=c.created_at, created_by=c.created_by, **c.snapshot) for c in changes]


@router.post('/preview')
def calculate(project_id: int, data: CompositionRequest, db: Session = Depends(get_db), actor: User = Depends(get_project_admin_user)):
    return preview(db, db.get(Project, project_id), data)


@router.post('', status_code=201)
def confirm(project_id: int, data: CompositionRequest, tasks: BackgroundTasks,
            db: Session = Depends(get_db), actor: User = Depends(get_project_admin_user)):
    if not data.request_key or not data.preview_token:
        raise HTTPException(422, 'Revisá la vista previa antes de confirmar')
    project = db.query(Project).filter_by(id=project_id).with_for_update().one()
    request_digest = hashlib.sha256(json.dumps(data.model_dump(mode="json", exclude={"preview_token", "request_key"}), sort_keys=True).encode()).hexdigest()
    existing = db.query(CompositionChange).filter_by(project_id=project_id, request_key=data.request_key).first()
    if existing:
        if existing.snapshot.get("request_digest") != request_digest:
            raise HTTPException(409, "Esta confirmación ya se usó para otro cambio")
        return dict(id=existing.id, **existing.snapshot)
    db.query(ProjectMember).filter_by(project_id=project_id).order_by(ProjectMember.user_id).with_for_update().all()
    result = preview(db, project, data)
    if data.preview_token != result['preview_token']:
        raise HTTPException(409, 'Los datos cambiaron. Volvé a calcular y revisar la vista previa.')
    if any(row['user_id'] is None for row in result['rows']):
        require_email_config()
    change = CompositionChange(project_id=project_id, effective_at=utc(data.effective_at),
                               created_by=actor.id, request_key=data.request_key, snapshot={})
    db.add(change)
    db.flush()
    for row in result['rows']:
        if row['user_id'] is None:
            user = db.query(User).filter_by(email=row['email']).first()
            if not user:
                user = User(email=row['email'], full_name=row['name'], email_verified=False, is_admin=False)
                db.add(user)
                db.flush()
            member = ProjectMember(project_id=project_id, user_id=user.id, participation_percentage=0,
                                   is_active=True, is_admin=False, invitation_accepted=False)
            db.add(member)
            db.flush()
            row['user_id'] = user.id
            issue_action(db, tasks, user, 'invite', member, project.name)
        else:
            member = db.query(ProjectMember).filter_by(project_id=project_id, user_id=row['user_id']).one()
        member.participation_percentage = row['percentage']
        db.add(ProjectMemberHistory(project_id=project_id, user_id=member.user_id, changed_by=actor.id,
                                   action='rebalanced', old_percentage=row['old_percentage'],
                                   new_percentage=row['percentage'], old_is_admin=member.is_admin, new_is_admin=member.is_admin))
        for field, kind in [('balance_adjustment', 'composition_rebalance'), ('external_balance_settlement', 'external_settlement')]:
            change_member_balance(db, member, result['balance_currency'], Decimal(row[field]),
                                  movement_type=kind, source_type='composition_change', source_id=change.id,
                                  description=data.reason, actor_id=actor.id)
    result["request_digest"] = request_digest
    change.snapshot = result
    if len(result['rows']) > 1:
        project.is_individual = False
    db.commit()
    return dict(id=change.id, **result)
