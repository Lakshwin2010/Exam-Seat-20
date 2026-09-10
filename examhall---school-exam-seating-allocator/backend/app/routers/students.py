from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import models, schemas
from app.monitoring_service import MonitoringService

router = APIRouter(prefix="/api/students", tags=["students"])

@router.get("", response_model=List[schemas.Student])
def list_students(
    search: Optional[str] = Query(None, description="Search by roll number, name, or grade"),
    grade: Optional[str] = Query(None, description="Filter by grade"),
    limit: int = Query(2000, le=10000),
    db: Session = Depends(get_db)
):
    query = db.query(models.Student)
    if grade:
        query = query.filter(models.Student.grade == grade)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (models.Student.name.ilike(s)) |
            (models.Student.roll_no.ilike(s)) |
            (models.Student.grade.ilike(s))
        )

    students = query.limit(limit).all()
    results = []
    for st in students:
        results.append(schemas.Student(
            id=st.id,
            rollNo=st.roll_no,
            name=st.name,
            grade=st.grade,
            gender=st.gender,
            specialNeeds=st.special_needs,
            enrolledSubjectIds=[s.id for s in st.enrolled_subjects]
        ))
    return results

@router.get("/{student_id}", response_model=schemas.Student)
def get_student(student_id: str, db: Session = Depends(get_db)):
    st = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")

    return schemas.Student(
        id=st.id,
        rollNo=st.roll_no,
        name=st.name,
        grade=st.grade,
        gender=st.gender,
        specialNeeds=st.special_needs,
        enrolledSubjectIds=[s.id for s in st.enrolled_subjects]
    )

@router.post("", response_model=schemas.Student)
def create_student(data: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Student).filter(models.Student.roll_no == data.rollNo).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Student with roll number {data.rollNo} already exists.")

    student_id = data.id or f"stud-{data.rollNo.lower().replace(' ', '-')}"
    new_student = models.Student(
        id=student_id,
        roll_no=data.rollNo,
        name=data.name,
        grade=data.grade,
        gender=data.gender or "M",
        special_needs=data.specialNeeds or False
    )

    if data.enrolledSubjectIds:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(data.enrolledSubjectIds)).all()
        new_student.enrolled_subjects = subs

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return schemas.Student(
        id=new_student.id,
        rollNo=new_student.roll_no,
        name=new_student.name,
        grade=new_student.grade,
        gender=new_student.gender,
        specialNeeds=new_student.special_needs,
        enrolledSubjectIds=[s.id for s in new_student.enrolled_subjects]
    )

@router.put("/{student_id}", response_model=schemas.Student)
def update_student(student_id: str, data: schemas.StudentCreate, db: Session = Depends(get_db)):
    st = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")

    st.roll_no = data.rollNo
    st.name = data.name
    st.grade = data.grade
    st.gender = data.gender or "M"
    st.special_needs = data.specialNeeds or False

    if data.enrolledSubjectIds is not None:
        subs = db.query(models.Subject).filter(models.Subject.id.in_(data.enrolledSubjectIds)).all()
        st.enrolled_subjects = subs

    db.commit()
    db.refresh(st)

    return schemas.Student(
        id=st.id,
        rollNo=st.roll_no,
        name=st.name,
        grade=st.grade,
        gender=st.gender,
        specialNeeds=st.special_needs,
        enrolledSubjectIds=[s.id for s in st.enrolled_subjects]
    )

@router.delete("/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db)):
    st = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")

    db.delete(st)
    db.commit()
    return {"status": "success", "message": f"Student {student_id} deleted."}

@router.patch("/{student_id}/status", response_model=schemas.StudentMonitoringRecord)
def update_student_monitoring_status(
    student_id: str,
    status_data: schemas.StudentMonitoringStatusUpdate,
    session_id: str = Query(..., description="Active session ID"),
    db: Session = Depends(get_db)
):
    """Updates student exam monitoring status (e.g. checked_in, in_hall, completed, absent, flagged)."""
    return MonitoringService.update_student_status(student_id, session_id, status_data, db)
