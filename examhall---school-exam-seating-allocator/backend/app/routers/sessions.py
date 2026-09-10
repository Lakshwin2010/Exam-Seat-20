from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

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
            isLocked=s.is_locked
        ))
    return results

@router.post("", response_model=schemas.ExamSession)
def create_session(data: schemas.ExamSessionCreate, db: Session = Depends(get_db)):
    sess_id = data.id or f"sess-{data.name.lower().replace(' ', '-')}"
    existing = db.query(models.ExamSession).filter(models.ExamSession.id == sess_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Session with id/name '{data.name}' already exists.")

    new_sess = models.ExamSession(
        id=sess_id,
        name=data.name,
        date=data.date,
        time_slot=data.timeSlot,
        is_locked=data.isLocked or False
    )

    if data.subjectIds:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(data.subjectIds)).all()
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
        isLocked=new_sess.is_locked
    )

@router.put("/{session_id}", response_model=schemas.ExamSession)
def update_session(session_id: str, data: schemas.ExamSessionCreate, db: Session = Depends(get_db)):
    sess = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    sess.name = data.name
    sess.date = data.date
    sess.time_slot = data.timeSlot
    sess.is_locked = data.isLocked or False

    if data.subjectIds is not None:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(data.subjectIds)).all()
        sess.subjects = subs

    db.commit()
    db.refresh(sess)

    return schemas.ExamSession(
        id=sess.id,
        name=sess.name,
        date=sess.date,
        timeSlot=sess.time_slot,
        subjectIds=[sub.id for sub in sess.subjects],
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
