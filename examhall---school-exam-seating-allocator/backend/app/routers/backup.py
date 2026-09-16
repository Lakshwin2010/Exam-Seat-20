import os
import json
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.config import DATA_DIR

router = APIRouter(prefix="/api/backup", tags=["backup"])

BACKUPS_DIR = DATA_DIR / "backups"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

class BackupSummary(BaseModel):
    id: str
    timestamp: str
    createdAt: str
    fileSizeBytes: int
    summary: Dict[str, int]
    note: Optional[str] = ""

class SyncAndBackupRequest(BaseModel):
    note: Optional[str] = "Manual sync & snapshot"
    clientData: Optional[Dict[str, Any]] = None

def _create_snapshot(db: Session, note: str = "") -> Dict[str, Any]:
    now = datetime.datetime.utcnow()
    backup_id = f"backup_{now.strftime('%Y%m%d_%H%M%S')}"

    # Query all current data
    all_subjects = db.query(models.Subject).all()
    all_rooms = db.query(models.ExamRoom).all()
    all_students = db.query(models.Student).all()
    all_sessions = db.query(models.ExamSession).all()
    all_allocations = db.query(models.SeatAllocation).all()
    all_monitoring = db.query(models.StudentMonitoring).all()

    subjects_data = [{
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "gradeLevel": s.grade_level,
        "color": s.color
    } for s in all_subjects]

    rooms_data = [{
        "id": r.id,
        "name": r.name,
        "building": r.building,
        "floor": r.floor,
        "capacity": r.capacity,
        "rows": r.rows,
        "cols": r.cols,
        "benchType": r.bench_type,
        "isActive": r.is_active,
        "notes": r.notes
    } for r in all_rooms]

    students_data = [{
        "id": s.id,
        "rollNo": s.roll_no,
        "name": s.name,
        "grade": s.grade,
        "gender": s.gender,
        "specialNeeds": s.special_needs,
        "enrolledSubjectIds": [sub.id for sub in s.enrolled_subjects]
    } for s in all_students]

    sessions_data = [{
        "id": s.id,
        "name": s.name,
        "date": s.date,
        "timeSlot": s.time_slot,
        "isLocked": s.is_locked,
        "grade11SubjectIds": s.grade11_subject_ids,
        "grade12SubjectIds": s.grade12_subject_ids,
        "subjectIds": [sub.id for sub in s.subjects]
    } for s in all_sessions]

    allocations_data = [{
        "id": a.id,
        "sessionId": a.session_id,
        "roomId": a.room_id,
        "seatIndex": a.seat_index,
        "row": a.row,
        "col": a.col,
        "seatLabel": a.seat_label,
        "studentId": a.student_id,
        "subjectId": a.subject_id,
        "neighborConflict": a.neighbor_conflict,
        "isSpecialNeeds": a.is_special_needs
    } for a in all_allocations]

    monitoring_data = [{
        "id": m.id,
        "studentId": m.student_id,
        "sessionId": m.session_id,
        "roomId": m.room_id,
        "seatLabel": m.seat_label,
        "status": m.status,
        "checkInTime": m.check_in_time.isoformat() if m.check_in_time else None,
        "submissionTime": m.submission_time.isoformat() if m.submission_time else None,
        "remarks": m.remarks
    } for m in all_monitoring]

    snapshot = {
        "id": backup_id,
        "timestamp": now.isoformat() + "Z",
        "createdAt": now.strftime("%b %d, %Y - %I:%M %p"),
        "note": note,
        "summary": {
            "roomsCount": len(rooms_data),
            "studentsCount": len(students_data),
            "subjectsCount": len(subjects_data),
            "sessionsCount": len(sessions_data),
            "allocationsCount": len(allocations_data),
            "monitoringCount": len(monitoring_data)
        },
        "data": {
            "subjects": subjects_data,
            "rooms": rooms_data,
            "students": students_data,
            "sessions": sessions_data,
            "allocations": allocations_data,
            "monitoring": monitoring_data
        }
    }

    # Write snapshot to disk
    file_path = BACKUPS_DIR / f"{backup_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)

    snapshot["fileSizeBytes"] = file_path.stat().st_size
    return snapshot

@router.post("/create")
def create_backup(note: str = "Manual backup", db: Session = Depends(get_db)):
    """Creates an immediate snapshot copy of the current database state."""
    snapshot = _create_snapshot(db, note=note)
    return {
        "status": "success",
        "backupId": snapshot["id"],
        "createdAt": snapshot["createdAt"],
        "summary": snapshot["summary"],
        "message": f"Backup {snapshot['id']} created successfully."
    }

@router.post("/sync_and_backup")
def sync_and_backup(req: SyncAndBackupRequest, db: Session = Depends(get_db)):
    """Syncs data with backend and immediately takes a full recovery snapshot copy."""
    snapshot = _create_snapshot(db, note=req.note or "Sync & Snapshot")
    
    # Return fresh state so frontend is 100% in sync
    all_rooms = db.query(models.ExamRoom).all()
    all_students = db.query(models.Student).all()
    all_subjects = db.query(models.Subject).all()
    all_sessions = db.query(models.ExamSession).all()

    return {
        "status": "success",
        "backup": {
            "id": snapshot["id"],
            "timestamp": snapshot["timestamp"],
            "createdAt": snapshot["createdAt"],
            "summary": snapshot["summary"],
            "fileSizeBytes": snapshot["fileSizeBytes"],
            "note": snapshot["note"]
        },
        "roomsCount": len(all_rooms),
        "studentsCount": len(all_students),
        "subjectsCount": len(all_subjects),
        "sessionsCount": len(all_sessions),
        "message": f"Data synchronized with backend and recovery snapshot {snapshot['id']} created."
    }

@router.get("/list", response_model=List[BackupSummary])
def list_backups():
    """Lists all available backup snapshots with metadata."""
    results = []
    for file in BACKUPS_DIR.glob("backup_*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                results.append(BackupSummary(
                    id=data.get("id", file.stem),
                    timestamp=data.get("timestamp", ""),
                    createdAt=data.get("createdAt", ""),
                    fileSizeBytes=file.stat().st_size,
                    summary=data.get("summary", {}),
                    note=data.get("note", "")
                ))
        except Exception as e:
            print(f"Error reading backup {file}: {e}")

    results.sort(key=lambda x: x.timestamp, reverse=True)
    return results

@router.post("/restore/{backup_id}")
def restore_backup(backup_id: str, db: Session = Depends(get_db)):
    """Restores the entire database from a specified backup snapshot."""
    file_path = BACKUPS_DIR / f"{backup_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Backup snapshot '{backup_id}' not found.")

    with open(file_path, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    data = snapshot.get("data", {})
    subjects_data = data.get("subjects", [])
    rooms_data = data.get("rooms", [])
    students_data = data.get("students", [])
    sessions_data = data.get("sessions", [])
    allocations_data = data.get("allocations", [])
    monitoring_data = data.get("monitoring", [])

    try:
        # Create a safety backup of current state right before restoring!
        _create_snapshot(db, note=f"Pre-restore safety snapshot before loading {backup_id}")

        # Clear dependent tables first
        db.query(models.SeatAllocation).delete()
        db.query(models.StudentMonitoring).delete()
        db.execute(models.session_subject_assoc.delete())
        db.execute(models.student_subject_assoc.delete())
        db.query(models.ExamSession).delete()
        db.query(models.ExamRoom).delete()
        db.query(models.Student).delete()
        db.query(models.Subject).delete()
        db.flush()

        # 1. Restore Subjects
        sub_map = {}
        for s in subjects_data:
            new_sub = models.Subject(
                id=s["id"],
                code=s["code"],
                name=s["name"],
                grade_level=s.get("gradeLevel", "General"),
                color=s.get("color", "#2563EB")
            )
            db.add(new_sub)
            sub_map[s["id"]] = new_sub
        db.flush()

        # 2. Restore Rooms
        for r in rooms_data:
            new_room = models.ExamRoom(
                id=r["id"],
                name=r["name"],
                building=r.get("building", ""),
                floor=r.get("floor", ""),
                capacity=r.get("capacity", 30),
                rows=r.get("rows", 5),
                cols=r.get("cols", 6),
                bench_type=r.get("benchType", "single"),
                is_active=r.get("isActive", True),
                notes=r.get("notes", "")
            )
            db.add(new_room)
        db.flush()

        # 3. Restore Students
        for st in students_data:
            new_stud = models.Student(
                id=st["id"],
                roll_no=st["rollNo"],
                name=st["name"],
                grade=st["grade"],
                gender=st.get("gender", "M"),
                special_needs=st.get("specialNeeds", False)
            )
            enrolled_ids = st.get("enrolledSubjectIds", [])
            for sid in enrolled_ids:
                if sid in sub_map:
                    new_stud.enrolled_subjects.append(sub_map[sid])
            db.add(new_stud)
        db.flush()

        # 4. Restore Exam Sessions
        for ses in sessions_data:
            new_ses = models.ExamSession(
                id=ses["id"],
                name=ses["name"],
                date=ses["date"],
                time_slot=ses["timeSlot"],
                is_locked=ses.get("isLocked", False),
                grade11_subject_ids=ses.get("grade11SubjectIds", ""),
                grade12_subject_ids=ses.get("grade12SubjectIds", "")
            )
            sub_ids = ses.get("subjectIds", [])
            for sid in sub_ids:
                if sid in sub_map:
                    new_ses.subjects.append(sub_map[sid])
            db.add(new_ses)
        db.flush()

        # 5. Restore Seat Allocations
        for al in allocations_data:
            new_al = models.SeatAllocation(
                id=al["id"],
                session_id=al["sessionId"],
                room_id=al["roomId"],
                seat_index=al["seatIndex"],
                row=al["row"],
                col=al["col"],
                seat_label=al["seatLabel"],
                student_id=al.get("studentId"),
                subject_id=al.get("subjectId"),
                neighbor_conflict=al.get("neighborConflict", False),
                is_special_needs=al.get("isSpecialNeeds", False)
            )
            db.add(new_al)
        db.flush()

        # 6. Restore Monitoring
        for mo in monitoring_data:
            new_mo = models.StudentMonitoring(
                id=mo["id"],
                student_id=mo["studentId"],
                session_id=mo["sessionId"],
                room_id=mo.get("roomId"),
                seat_label=mo.get("seatLabel"),
                status=mo.get("status", "not_checked_in"),
                remarks=mo.get("remarks", "")
            )
            db.add(new_mo)

        db.commit()
        return {
            "status": "success",
            "message": f"Successfully restored data from snapshot '{backup_id}'.",
            "restoredSummary": snapshot.get("summary", {})
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")

@router.delete("/{backup_id}")
def delete_backup(backup_id: str):
    """Deletes a backup snapshot file."""
    file_path = BACKUPS_DIR / f"{backup_id}.json"
    if file_path.exists():
        file_path.unlink()
        return {"status": "success", "message": f"Backup '{backup_id}' deleted."}
    raise HTTPException(status_code=404, detail="Backup not found")

@router.get("/download/{backup_id}")
def download_backup(backup_id: str):
    """Downloads a backup snapshot as a JSON file."""
    file_path = BACKUPS_DIR / f"{backup_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(file_path, media_type="application/json", filename=f"{backup_id}.json")

@router.post("/upload")
async def upload_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Uploads and restores a backup JSON file."""
    try:
        content = await file.read()
        snapshot = json.loads(content.decode("utf-8"))
        backup_id = snapshot.get("id") or f"backup_uploaded_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Save uploaded file into backups folder
        target_path = BACKUPS_DIR / f"{backup_id}.json"
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, indent=2)

        # Restore from this backup
        return restore_backup(backup_id, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid backup file: {str(e)}")
