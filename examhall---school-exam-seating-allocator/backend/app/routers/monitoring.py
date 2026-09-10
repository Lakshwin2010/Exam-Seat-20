from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import schemas, models
from app.monitoring_service import MonitoringService

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

@router.get("/records", response_model=List[schemas.StudentMonitoringRecord])
def get_monitoring_records(
    session_id: str = Query(..., description="Session ID to monitor"),
    room_id: Optional[str] = Query(None, description="Filter by room ID"),
    status: Optional[str] = Query(None, description="Filter by status (checked_in, in_hall, completed, absent, flagged)"),
    search: Optional[str] = Query(None, description="Search by student name or roll number"),
    db: Session = Depends(get_db)
):
    """Retrieve live monitoring & attendance records for students in a specific session."""
    return MonitoringService.get_monitoring_records(
        session_id=session_id,
        room_id=room_id,
        status=status,
        search=search,
        db=db
    )

@router.get("/dashboard", response_model=schemas.MonitoringDashboardStats)
def get_monitoring_dashboard(
    session_id: Optional[str] = Query(None, description="Session ID for dashboard"),
    db: Session = Depends(get_db)
):
    """Get high-level summary metrics, attendance rate, room occupancy, and incidents for the session."""
    # If no session_id given, default to first available session
    if not session_id:
        sess = db.query(models.ExamSession).first()
        if not sess:
            return schemas.MonitoringDashboardStats(
                totalStudents=0,
                totalCheckedIn=0,
                totalInHall=0,
                totalCompleted=0,
                totalAbsent=0,
                totalFlagged=0,
                attendanceRate=0.0,
                roomBreakdown=[],
                recentIncidents=[]
            )
        session_id = sess.id

    return MonitoringService.get_dashboard_stats(session_id, db)

@router.post("/incidents", response_model=schemas.MonitoringIncidentOut)
def log_incident(
    incident: schemas.MonitoringIncidentCreate,
    db: Session = Depends(get_db)
):
    """Log an exam monitoring incident (malpractice suspicion, unauthorized items, unauthorized exit, etc.)."""
    return MonitoringService.log_incident(incident, db)

@router.get("/incidents", response_model=List[schemas.MonitoringIncidentOut])
def list_incidents(
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """List exam hall monitoring incidents."""
    query = db.query(models.MonitoringIncident)
    if session_id:
        query = query.filter(models.MonitoringIncident.session_id == session_id)
    incidents = query.order_by(models.MonitoringIncident.timestamp.desc()).limit(limit).all()

    results = []
    for inc in incidents:
        student = db.query(models.Student).filter(models.Student.id == inc.student_id).first() if inc.student_id else None
        room = db.query(models.ExamRoom).filter(models.ExamRoom.id == inc.room_id).first() if inc.room_id else None
        results.append(schemas.MonitoringIncidentOut(
            id=inc.id,
            sessionId=inc.session_id,
            studentId=inc.student_id,
            studentName=student.name if student else None,
            studentRollNo=student.roll_no if student else None,
            roomId=inc.room_id,
            roomName=room.name if room else None,
            incidentType=inc.incident_type,
            severity=inc.severity,
            description=inc.description,
            reportedBy=inc.reported_by,
            actionTaken=inc.action_taken,
            timestamp=inc.timestamp.isoformat()
        ))
    return results
