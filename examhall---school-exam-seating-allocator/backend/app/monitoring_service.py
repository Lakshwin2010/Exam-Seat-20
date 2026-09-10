import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models, schemas

class MonitoringService:
    @staticmethod
    def get_monitoring_records(
        session_id: str,
        room_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        db: Session = None
    ) -> List[schemas.StudentMonitoringRecord]:
        query = db.query(models.StudentMonitoring).filter(models.StudentMonitoring.session_id == session_id)

        if room_id:
            query = query.filter(models.StudentMonitoring.room_id == room_id)
        if status:
            query = query.filter(models.StudentMonitoring.status == status)

        records = query.all()
        results = []

        for rec in records:
            student = rec.student
            if not student:
                continue

            # Text search filter
            if search:
                s_lower = search.lower()
                if (
                    s_lower not in student.name.lower()
                    and s_lower not in student.roll_no.lower()
                    and s_lower not in student.grade.lower()
                ):
                    continue

            room_name = rec.room.name if rec.room else "Unassigned"
            results.append(schemas.StudentMonitoringRecord(
                id=rec.id,
                studentId=rec.student_id,
                studentRollNo=student.roll_no,
                studentName=student.name,
                studentGrade=student.grade,
                sessionId=rec.session_id,
                roomId=rec.room_id,
                roomName=room_name,
                seatLabel=rec.seat_label,
                status=rec.status,
                checkInTime=rec.check_in_time.isoformat() if rec.check_in_time else None,
                submissionTime=rec.submission_time.isoformat() if rec.submission_time else None,
                remarks=rec.remarks or "",
                updatedAt=rec.updated_at.isoformat() if rec.updated_at else None
            ))

        return results

    @staticmethod
    def update_student_status(
        student_id: str,
        session_id: str,
        update_data: schemas.StudentMonitoringStatusUpdate,
        db: Session
    ) -> schemas.StudentMonitoringRecord:
        rec = db.query(models.StudentMonitoring).filter(
            models.StudentMonitoring.student_id == student_id,
            models.StudentMonitoring.session_id == session_id
        ).first()

        now = datetime.datetime.now(datetime.timezone.utc)

        if not rec:
            rec = models.StudentMonitoring(
                id=f"mon-{session_id}-{student_id}",
                student_id=student_id,
                session_id=session_id,
                status=update_data.status,
                room_id=update_data.roomId,
                seat_label=update_data.seatLabel,
                remarks=update_data.remarks or ""
            )
            db.add(rec)
        else:
            rec.status = update_data.status
            if update_data.remarks is not None:
                rec.remarks = update_data.remarks
            if update_data.roomId:
                rec.room_id = update_data.roomId
            if update_data.seatLabel:
                rec.seat_label = update_data.seatLabel

        # Time transitions
        if update_data.status in ["checked_in", "in_hall"] and not rec.check_in_time:
            rec.check_in_time = now
        elif update_data.status == "completed" and not rec.submission_time:
            rec.submission_time = now

        db.commit()
        db.refresh(rec)

        student = rec.student
        return schemas.StudentMonitoringRecord(
            id=rec.id,
            studentId=rec.student_id,
            studentRollNo=student.roll_no if student else "",
            studentName=student.name if student else "",
            studentGrade=student.grade if student else "",
            sessionId=rec.session_id,
            roomId=rec.room_id,
            roomName=rec.room.name if rec.room else None,
            seatLabel=rec.seat_label,
            status=rec.status,
            checkInTime=rec.check_in_time.isoformat() if rec.check_in_time else None,
            submissionTime=rec.submission_time.isoformat() if rec.submission_time else None,
            remarks=rec.remarks or "",
            updatedAt=rec.updated_at.isoformat() if rec.updated_at else None
        )

    @staticmethod
    def get_dashboard_stats(session_id: str, db: Session) -> schemas.MonitoringDashboardStats:
        records = db.query(models.StudentMonitoring).filter(
            models.StudentMonitoring.session_id == session_id
        ).all()

        total = len(records)
        checked_in = sum(1 for r in records if r.status in ["checked_in", "in_hall", "completed", "flagged"])
        in_hall = sum(1 for r in records if r.status in ["in_hall", "flagged"])
        completed = sum(1 for r in records if r.status == "completed")
        absent = sum(1 for r in records if r.status == "absent")
        flagged = sum(1 for r in records if r.status == "flagged")

        att_rate = round((checked_in / total * 100.0), 1) if total > 0 else 0.0

        # Room breakdown
        rooms = db.query(models.ExamRoom).filter(models.ExamRoom.is_active == True).all()
        room_breakdown = []
        for r in rooms:
            room_recs = [rec for rec in records if rec.room_id == r.id]
            assigned_cnt = len(room_recs)
            pres_cnt = sum(1 for rec in room_recs if rec.status in ["checked_in", "in_hall", "completed", "flagged"])
            abs_cnt = sum(1 for rec in room_recs if rec.status == "absent")
            flg_cnt = sum(1 for rec in room_recs if rec.status == "flagged")
            inc_cnt = db.query(models.MonitoringIncident).filter(
                models.MonitoringIncident.session_id == session_id,
                models.MonitoringIncident.room_id == r.id
            ).count()

            room_breakdown.append({
                "roomId": r.id,
                "roomName": r.name,
                "capacity": r.capacity,
                "totalAssigned": assigned_cnt,
                "presentCount": pres_cnt,
                "absentCount": abs_cnt,
                "flaggedCount": flg_cnt,
                "incidentCount": inc_cnt,
                "occupancyPercent": round((assigned_cnt / max(1, r.capacity)) * 100, 1)
            })

        # Recent incidents
        incidents = db.query(models.MonitoringIncident).filter(
            models.MonitoringIncident.session_id == session_id
        ).order_by(models.MonitoringIncident.timestamp.desc()).limit(15).all()

        incident_outs = []
        for inc in incidents:
            student = db.query(models.Student).filter(models.Student.id == inc.student_id).first() if inc.student_id else None
            room = db.query(models.ExamRoom).filter(models.ExamRoom.id == inc.room_id).first() if inc.room_id else None
            incident_outs.append(schemas.MonitoringIncidentOut(
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

        return schemas.MonitoringDashboardStats(
            totalStudents=total,
            totalCheckedIn=checked_in,
            totalInHall=in_hall,
            totalCompleted=completed,
            totalAbsent=absent,
            totalFlagged=flagged,
            attendanceRate=att_rate,
            roomBreakdown=room_breakdown,
            recentIncidents=incident_outs
        )

    @staticmethod
    def log_incident(
        incident_in: schemas.MonitoringIncidentCreate,
        db: Session
    ) -> schemas.MonitoringIncidentOut:
        inc_id = f"inc-{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}"
        new_inc = models.MonitoringIncident(
            id=inc_id,
            session_id=incident_in.sessionId,
            student_id=incident_in.studentId,
            room_id=incident_in.roomId,
            incident_type=incident_in.incidentType,
            severity=incident_in.severity,
            description=incident_in.description,
            reported_by=incident_in.reportedBy,
            action_taken=incident_in.actionTaken or "",
            timestamp=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(new_inc)

        # If student involved and severity is critical/high or malpractice, flag student
        if incident_in.studentId and incident_in.severity in ["high", "critical", "malpractice"]:
            rec = db.query(models.StudentMonitoring).filter(
                models.StudentMonitoring.student_id == incident_in.studentId,
                models.StudentMonitoring.session_id == incident_in.sessionId
            ).first()
            if rec:
                rec.status = "flagged"
                rec.remarks = f"Flagged due to incident: {incident_in.description}"

        db.commit()
        db.refresh(new_inc)

        student = db.query(models.Student).filter(models.Student.id == new_inc.student_id).first() if new_inc.student_id else None
        room = db.query(models.ExamRoom).filter(models.ExamRoom.id == new_inc.room_id).first() if new_inc.room_id else None

        return schemas.MonitoringIncidentOut(
            id=new_inc.id,
            sessionId=new_inc.session_id,
            studentId=new_inc.student_id,
            studentName=student.name if student else None,
            studentRollNo=student.roll_no if student else None,
            roomId=new_inc.room_id,
            roomName=room.name if room else None,
            incidentType=new_inc.incident_type,
            severity=new_inc.severity,
            description=new_inc.description,
            reportedBy=new_inc.reported_by,
            actionTaken=new_inc.action_taken,
            timestamp=new_inc.timestamp.isoformat()
        )
