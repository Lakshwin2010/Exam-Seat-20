from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import tempfile
import datetime
import pandas as pd

from app.database import get_db
from app import models, schemas
from app.allocation_service import AllocationEngine

router = APIRouter(prefix="/api/allocations", tags=["allocations"])

@router.post("/generate", response_model=schemas.SeatingPlan)
@router.post("/{session_id}/generate", response_model=schemas.SeatingPlan)
def generate_seating_plan(
    session_id: Optional[str] = None,
    options: Optional[schemas.AllocationOptions] = None,
    db: Session = Depends(get_db)
):
    """Generates an anti-cheating 50/50 seating allocation for the specified session and saves to DB."""
    if not session_id:
        # Fallback to first session if none specified
        first_sess = db.query(models.ExamSession).first()
        if not first_sess:
            raise HTTPException(status_code=404, detail="No exam session found.")
        session_id = first_sess.id

    if options is None:
        options = schemas.AllocationOptions()

    try:
        plan = AllocationEngine.generate_seating_plan(session_id, options, db)
        return plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Allocation generation failed: {str(e)}")

@router.get("/{session_id}", response_model=schemas.SeatingPlan)
def get_seating_plan(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Fetch current seating plan from DB or auto-generate if none exists."""
    allocations = db.query(models.SeatAllocation).filter(models.SeatAllocation.session_id == session_id).all()
    if not allocations:
        # Generate default plan
        return AllocationEngine.generate_seating_plan(session_id, schemas.AllocationOptions(), db)

    # Reconstruct plan from DB allocations
    session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rooms = db.query(models.ExamRoom).filter(models.ExamRoom.is_active == True).all()
    room_allocs = []

    for room in rooms:
        room_seats = [a for a in allocations if a.room_id == room.id]
        if not room_seats:
            continue

        assigned_seats = []
        grade_dist = {}
        sub_dist = {}
        total_assigned = 0

        for s in sorted(room_seats, key=lambda x: x.seat_index):
            stud = s.student
            sub = s.subject

            if stud:
                total_assigned += 1
                grade_dist[stud.grade] = grade_dist.get(stud.grade, 0) + 1
            if sub:
                sub_dist[sub.code] = sub_dist.get(sub.code, 0) + 1

            assigned_seats.append(schemas.SeatAssignment(
                seatIndex=s.seat_index,
                row=s.row,
                col=s.col,
                seatLabel=s.seat_label,
                studentId=stud.id if stud else None,
                studentRollNo=stud.roll_no if stud else None,
                studentName=stud.name if stud else None,
                studentGrade=stud.grade if stud else None,
                subjectCode=sub.code if sub else None,
                subjectName=sub.name if sub else None,
                subjectColor=sub.color if sub else None,
                isSpecialNeeds=s.is_special_needs,
                hasNeighborConflict=s.neighbor_conflict
            ))

        room_allocs.append(schemas.RoomAllocation(
            roomId=room.id,
            roomName=room.name,
            building=room.building or "",
            floor=room.floor or "",
            capacity=room.capacity,
            rows=room.rows,
            cols=room.cols,
            benchType=room.bench_type,
            assignedSeats=assigned_seats,
            totalAssigned=total_assigned,
            gradeDistribution=grade_dist,
            subjectDistribution=sub_dist,
            invigilator="Assigned"
        ))

    total_assigned = sum(r.totalAssigned for r in room_allocs)
    total_cap = sum(r.capacity for r in rooms)

    stats = schemas.SeatingPlanStats(
        totalStudents=total_assigned,
        totalAssigned=total_assigned,
        totalRoomsUsed=len(room_allocs),
        totalCapacityAvailable=total_cap,
        overallUtilizationPercent=round(100.0 * total_assigned / max(1, total_cap), 1),
        mixedRoomCount=sum(1 for r in room_allocs if len(r.subjectDistribution) > 1),
        singleGroupRoomCount=sum(1 for r in room_allocs if len(r.subjectDistribution) == 1),
        conflictCount=sum(1 for a in allocations if a.neighbor_conflict),
        cheatPreventionIndex=95.0
    )

    return schemas.SeatingPlan(
        id=f"plan-{session_id}",
        sessionId=session.id,
        sessionName=session.name,
        sessionDate=session.date,
        sessionTime=session.time_slot,
        createdAt=datetime.datetime.utcnow().isoformat(),
        options=schemas.AllocationOptions(),
        roomAllocations=room_allocs,
        unassignedStudents=[],
        conflicts=[],
        stats=stats
    )

@router.post("/swap")
def swap_seats(swap_req: schemas.SeatSwapRequest, db: Session = Depends(get_db)):
    """Swaps student seat assignments between two seats and updates monitoring records."""
    seat_a = db.query(models.SeatAllocation).filter(
        models.SeatAllocation.session_id == swap_req.sessionId,
        models.SeatAllocation.room_id == swap_req.sourceRoomId,
        models.SeatAllocation.seat_index == swap_req.sourceSeatIdx
    ).first()

    seat_b = db.query(models.SeatAllocation).filter(
        models.SeatAllocation.session_id == swap_req.sessionId,
        models.SeatAllocation.room_id == swap_req.targetRoomId,
        models.SeatAllocation.seat_index == swap_req.targetSeatIdx
    ).first()

    if not seat_a or not seat_b:
        raise HTTPException(status_code=404, detail="One or both seats could not be found.")

    # Swap student and subject fields
    temp_stud = seat_a.student_id
    temp_sub = seat_a.subject_id
    temp_special = seat_a.is_special_needs

    seat_a.student_id = seat_b.student_id
    seat_a.subject_id = seat_b.subject_id
    seat_a.is_special_needs = seat_b.is_special_needs

    seat_b.student_id = temp_stud
    seat_b.subject_id = temp_sub
    seat_b.is_special_needs = temp_special

    # Update monitoring records for students if moved
    for st_id, room_id, label in [
        (seat_a.student_id, seat_a.room_id, seat_a.seat_label),
        (seat_b.student_id, seat_b.room_id, seat_b.seat_label)
    ]:
        if st_id:
            mon = db.query(models.StudentMonitoring).filter(
                models.StudentMonitoring.student_id == st_id,
                models.StudentMonitoring.session_id == swap_req.sessionId
            ).first()
            if mon:
                mon.room_id = room_id
                mon.seat_label = label

    db.commit()
    return {"status": "success", "message": "Seats swapped successfully."}

@router.get("/{session_id}/export/excel")
def export_seating_plan_excel(session_id: str, db: Session = Depends(get_db)):
    """Exports seating plan directly to an Excel file (.xlsx) with Room, Seat, and Student details."""
    session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    allocations = db.query(models.SeatAllocation).filter(
        models.SeatAllocation.session_id == session_id,
        models.SeatAllocation.student_id != None
    ).all()

    records = []
    for a in allocations:
        room = a.room
        stud = a.student
        sub = a.subject
        records.append({
            "Room Name": room.name if room else "",
            "Building": room.building if room else "",
            "Floor": room.floor if room else "",
            "Seat Label": a.seat_label,
            "Roll Number": stud.roll_no if stud else "",
            "Student Name": stud.name if stud else "",
            "Grade / Class": stud.grade if stud else "",
            "Subject Code": sub.code if sub else "",
            "Subject Name": sub.name if sub else "",
            "Special Needs": "Yes" if stud and stud.special_needs else "No",
            "Exam Date": session.date,
            "Time Slot": session.time_slot
        })

    df = pd.DataFrame(records)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    with pd.ExcelWriter(temp_file.name, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Seating Plan", index=False)

    clean_name = session.name.replace(" ", "_")
    return FileResponse(
        path=temp_file.name,
        filename=f"Seating_Plan_{clean_name}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
