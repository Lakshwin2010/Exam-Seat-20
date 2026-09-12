import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

def _parse_ids(val: str) -> List[str]:
    if not val:
        return []
    try:
        data = json.loads(val)
        return data if isinstance(data, list) else []
    except Exception:
        return [x.strip() for x in val.split(",") if x.strip()]

@router.get("", response_model=List[schemas.ExamSession])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(models.ExamSession).all()
    results = []
    for s in sessions:
        results.append(schemas.ExamSession(
            id=s.id,
            name=s.name,
            date=s.date,
            timeSlot=s.time_slot,
            subjectIds=[sub.id for sub in s.subjects],
            grade11SubjectIds=_parse_ids(getattr(s, "grade11_subject_ids", "")),
            grade12SubjectIds=_parse_ids(getattr(s, "grade12_subject_ids", "")),
            isLocked=s.is_locked
        ))
    return results

@router.post("", response_model=schemas.ExamSession)
def create_session(data: schemas.ExamSessionCreate, db: Session = Depends(get_db)):
    import re
    slug = re.sub(r'[^a-zA-Z0-9_-]+', '-', data.name.lower()).strip('-')
    sess_id = data.id or f"sess-{slug}"
    existing = db.query(models.ExamSession).filter(models.ExamSession.id == sess_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Session with id/name '{data.name}' already exists.")

    grade11_ids = data.grade11SubjectIds or []
    grade12_ids = data.grade12SubjectIds or []
    all_subject_ids = list(dict.fromkeys((data.subjectIds or []) + grade11_ids + grade12_ids))

    new_sess = models.ExamSession(
        id=sess_id,
        name=data.name,
        date=data.date,
        time_slot=data.timeSlot,
        is_locked=data.isLocked or False,
        grade11_subject_ids=json.dumps(grade11_ids),
        grade12_subject_ids=json.dumps(grade12_ids)
    )

    if all_subject_ids:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(all_subject_ids)).all()
        new_sess.subjects = subs

    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)

    return schemas.ExamSession(
        id=new_sess.id,
        name=new_sess.name,
        date=new_sess.date,
        timeSlot=new_sess.time_slot,
        subjectIds=[sub.id for sub in new_sess.subjects],
        grade11SubjectIds=_parse_ids(new_sess.grade11_subject_ids),
        grade12SubjectIds=_parse_ids(new_sess.grade12_subject_ids),
        isLocked=new_sess.is_locked
    )

@router.put("/{session_id}", response_model=schemas.ExamSession)
def update_session(session_id: str, data: schemas.ExamSessionCreate, db: Session = Depends(get_db)):
    sess = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    grade11_ids = data.grade11SubjectIds or []
    grade12_ids = data.grade12SubjectIds or []
    all_subject_ids = list(dict.fromkeys((data.subjectIds or []) + grade11_ids + grade12_ids))

    sess.name = data.name
    sess.date = data.date
    sess.time_slot = data.timeSlot
    sess.is_locked = data.isLocked or False
    sess.grade11_subject_ids = json.dumps(grade11_ids)
    sess.grade12_subject_ids = json.dumps(grade12_ids)

    if all_subject_ids is not None:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(all_subject_ids)).all()
        sess.subjects = subs

    db.commit()
    db.refresh(sess)

    return schemas.ExamSession(
        id=sess.id,
        name=sess.name,
        date=sess.date,
        timeSlot=sess.time_slot,
        subjectIds=[sub.id for sub in sess.subjects],
        grade11SubjectIds=_parse_ids(sess.grade11_subject_ids),
        grade12SubjectIds=_parse_ids(sess.grade12_subject_ids),
        isLocked=sess.is_locked
    )

@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    sess = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(sess)
    db.commit()
    return {"status": "success", "message": f"Session {session_id} deleted."}
