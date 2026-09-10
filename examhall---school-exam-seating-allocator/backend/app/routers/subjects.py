from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/subjects", tags=["subjects"])

@router.get("", response_model=List[schemas.ExamSubject])
def list_subjects(db: Session = Depends(get_db)):
    subjects = db.query(models.Subject).all()
    results = []
    for s in subjects:
        results.append(schemas.ExamSubject(
            id=s.id,
            code=s.code,
            name=s.name,
            gradeLevel=s.grade_level,
            color=s.color
        ))
    return results

@router.post("", response_model=schemas.ExamSubject)
def create_subject(data: schemas.ExamSubjectCreate, db: Session = Depends(get_db)):
    sub_id = data.id or f"sub-{data.code.lower().replace(' ', '-')}"
    existing = db.query(models.Subject).filter((models.Subject.id == sub_id) | (models.Subject.code == data.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject with code '{data.code}' already exists.")

    new_sub = models.Subject(
        id=sub_id,
        code=data.code.upper(),
        name=data.name,
        grade_level=data.gradeLevel,
        color=data.color
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    return schemas.ExamSubject(
        id=new_sub.id,
        code=new_sub.code,
        name=new_sub.name,
        gradeLevel=new_sub.grade_level,
        color=new_sub.color
    )

@router.put("/{subject_id}", response_model=schemas.ExamSubject)
def update_subject(subject_id: str, data: schemas.ExamSubjectCreate, db: Session = Depends(get_db)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    sub.code = data.code.upper()
    sub.name = data.name
    sub.grade_level = data.gradeLevel
    sub.color = data.color

    db.commit()
    db.refresh(sub)

    return schemas.ExamSubject(
        id=sub.id,
        code=sub.code,
        name=sub.name,
        gradeLevel=sub.grade_level,
        color=sub.color
    )

@router.delete("/{subject_id}")
def delete_subject(subject_id: str, db: Session = Depends(get_db)):
    sub = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    db.delete(sub)
    db.commit()
    return {"status": "success", "message": f"Subject {subject_id} deleted."}
