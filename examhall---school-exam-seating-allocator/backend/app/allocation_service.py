import datetime
import math
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app import models, schemas

class AllocationEngine:
    @staticmethod
    def generate_seating_plan(
        session_id: str,
        options: schemas.AllocationOptions,
        db: Session
    ) -> schemas.SeatingPlan:
        exam_session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
        if not exam_session:
            raise ValueError(f"Exam session {session_id} not found")

        active_rooms = db.query(models.ExamRoom).filter(
            models.ExamRoom.is_active == True,
            models.ExamRoom.capacity > 0
        ).all()

        session_subject_ids = {s.id.lower() for s in exam_session.subjects}
        session_subject_codes = {s.code.upper() for s in exam_session.subjects}
        all_students = db.query(models.Student).all()
        all_subjects = db.query(models.Subject).all()
        all_subjects_map = {s.id: s for s in all_subjects}
        sub_code_by_id = {s.id.lower(): s.code.upper() for s in all_subjects}

        import json
        def _parse_ids(val: str) -> List[str]:
            if not val:
                return []
            try:
                d = json.loads(val)
                return d if isinstance(d, list) else []
            except Exception:
                return [x.strip() for x in val.split(",") if x.strip()]

        raw_g11 = _parse_ids(getattr(exam_session, "grade11_subject_ids", ""))
        raw_g12 = _parse_ids(getattr(exam_session, "grade12_subject_ids", ""))
        g11_subject_ids = {s.lower() for s in raw_g11}
        g12_subject_ids = {s.lower() for s in raw_g12}
        g11_subject_codes = {sub_code_by_id[sid] for sid in g11_subject_ids if sid in sub_code_by_id}
        g12_subject_codes = {sub_code_by_id[sid] for sid in g12_subject_ids if sid in sub_code_by_id}

        def check_is_xi(g: str) -> bool:
            u = g.upper()
            return "XI" in u and "XII" not in u

        def check_is_xii(g: str) -> bool:
            return "XII" in g.upper()

        # 1. Identify all eligible candidates taking subjects in this session
        candidates: List[Dict[str, Any]] = []
        for stud in all_students:
            stud_xi = check_is_xi(stud.grade)
            stud_xii = check_is_xii(stud.grade)

            matched_subs = []
            if stud_xi and (g11_subject_ids or g11_subject_codes):
                # Class 11 student: strictly match against Grade 11 exam subjects
                matched_subs = [
                    s for s in stud.enrolled_subjects
                    if s.id.lower() in g11_subject_ids or s.code.upper() in g11_subject_codes
                ]
            elif stud_xii and (g12_subject_ids or g12_subject_codes):
                # Class 12 student: strictly match against Grade 12 exam subjects
                matched_subs = [
                    s for s in stud.enrolled_subjects
                    if s.id.lower() in g12_subject_ids or s.code.upper() in g12_subject_codes
                ]
            elif session_subject_ids:
                matched_subs = [
                    s for s in stud.enrolled_subjects 
                    if s.id.lower() in session_subject_ids or s.code.upper() in session_subject_codes
                ]
            else:
                matched_subs = list(stud.enrolled_subjects)

            if matched_subs:
                candidates.append({
                    "student": stud,
                    "subject": matched_subs[0]
                })

        # Resilient fallback: if no candidate matched the session filter, seat all students
        if not candidates and all_students:
            for stud in all_students:
                chosen = stud.enrolled_subjects[0] if stud.enrolled_subjects else (list(all_subjects_map.values())[0] if all_subjects_map else None)
                if chosen:
                    candidates.append({
                        "student": stud,
                        "subject": chosen
                    })

        # 2. Group candidates by Subject Code & Grade
        group_map: Dict[str, List[Dict[str, Any]]] = {}
        for c in candidates:
            key = f"{c['subject'].code}_{c['student'].grade}"
            if key not in group_map:
                group_map[key] = []
            group_map[key].append(c)

        # Sort within each group (special needs first if prioritized, then roll number)
        for key, members in group_map.items():
            members.sort(
                key=lambda x: (
                    0 if (options.prioritizeSpecialNeedsFront and x["student"].special_needs) else 1,
                    x["student"].roll_no
                )
            )

        # Create pools sorted by size descending
        pools = []
        for key, members in group_map.items():
            pools.append({
                "key": key,
                "list": list(members),
                "subject": members[0]["subject"],
                "grade": members[0]["student"].grade,
                "originalCount": len(members)
            })
        pools.sort(key=lambda p: len(p["list"]), reverse=True)

        room_allocations: List[schemas.RoomAllocation] = []
        unassigned_students: List[schemas.UnassignedStudent] = []
        conflicts: List[schemas.ConflictWarning] = []

        # Clear existing allocations for this session in DB
        db.query(models.SeatAllocation).filter(models.SeatAllocation.session_id == session_id).delete()

        # 3. Allocate Room by Room
        for room in active_rooms:
            total_remaining = sum(len(p["list"]) for p in pools)
            if total_remaining == 0:
                break

            rows = room.rows or max(1, math.ceil(room.capacity / (room.cols or 6)))
            cols = room.cols or max(1, math.ceil(room.capacity / rows))
            capacity = room.capacity

            # Initialize seat grid
            grid: List[List[Optional[Dict[str, Any]]]] = [[None for _ in range(cols)] for _ in range(rows)]
            assigned_seats: List[schemas.SeatAssignment] = []

            # Helpers to identify grade level
            def is_xi(g: str) -> bool:
                u = g.upper()
                return "XI" in u and "XII" not in u

            def is_xii(g: str) -> bool:
                return "XII" in g.upper()

            available_pools = [p for p in pools if len(p["list"]) > 0]
            if not available_pools:
                break

            has_xi = any(is_xi(p["grade"]) for p in available_pools)
            has_xii = any(is_xii(p["grade"]) for p in available_pools)

            half_cap = math.ceil(capacity / 2)
            taken_a: List[Dict[str, Any]] = []
            taken_b: List[Dict[str, Any]] = []

            if has_xi and has_xii:
                # 50/50 mixing of Grade 11 and Grade 12 per room (e.g. 15 XI and 15 XII)
                target_a = half_cap
                target_b = capacity - target_a

                # Fill taken_a from XI pools
                for p in pools:
                    if is_xi(p["grade"]) and p["list"]:
                        need = target_a - len(taken_a)
                        if need <= 0:
                            break
                        take = min(need, len(p["list"]))
                        taken_a.extend(p["list"][:take])
                        del p["list"][:take]

                # Fill taken_b from XII pools
                for p in pools:
                    if is_xii(p["grade"]) and p["list"]:
                        need = target_b - len(taken_b)
                        if need <= 0:
                            break
                        take = min(need, len(p["list"]))
                        taken_b.extend(p["list"][:take])
                        del p["list"][:take]

                # Leftovers if any slots remain unfilled
                needed_more = capacity - (len(taken_a) + len(taken_b))
                if needed_more > 0:
                    for p in pools:
                        if p["list"]:
                            take = min(needed_more, len(p["list"]))
                            if is_xi(p["grade"]):
                                taken_a.extend(p["list"][:take])
                            else:
                                taken_b.extend(p["list"][:take])
                            del p["list"][:take]
                            needed_more = capacity - (len(taken_a) + len(taken_b))
                            if needed_more <= 0:
                                break
            else:
                # Fallback to standard 2-pool split if only one grade is in this session
                primary_pool = available_pools[0]
                secondary_pool = available_pools[1] if len(available_pools) > 1 else None
                primary_budget = min(half_cap, len(primary_pool["list"]))
                secondary_budget = min(capacity - primary_budget, len(secondary_pool["list"])) if secondary_pool else 0

                taken_a = primary_pool["list"][:primary_budget]
                del primary_pool["list"][:primary_budget]

                if secondary_pool and secondary_budget > 0:
                    taken_b = secondary_pool["list"][:secondary_budget]
                    del secondary_pool["list"][:secondary_budget]

                needed_more = capacity - (len(taken_a) + len(taken_b))
                if needed_more > 0:
                    for p in pools:
                        if p["list"]:
                            take = min(needed_more, len(p["list"]))
                            taken_a.extend(p["list"][:take])
                            del p["list"][:take]
                            needed_more = capacity - (len(taken_a) + len(taken_b))
                            if needed_more <= 0:
                                break

            room_students_to_seat: List[Dict[str, Any]] = taken_a + taken_b

            # Separate special needs to put in front row
            front_students = [s for s in room_students_to_seat if s["student"].special_needs]
            regular_a = [s for s in taken_a if not s["student"].special_needs]
            regular_b = [s for s in taken_b if not s["student"].special_needs]

            # Place special needs first in front row
            front_idx = 0
            for c in range(cols):
                if front_idx < len(front_students) and c < capacity:
                    grid[0][c] = front_students[front_idx]
                    front_idx += 1

            # Fill remaining seats alternating between pool A (XI) and pool B (XII) across bench pairs
            for r in range(rows):
                for c in range(cols):
                    seat_idx = r * cols + c
                    if seat_idx >= capacity:
                        continue
                    if grid[r][c] is not None:
                        continue

                    # Alternating checkerboard: (r + c) % 2 gives perfect 2D alternating layout
                    if (r + c) % 2 == 0:
                        chosen = regular_a.pop(0) if regular_a else (regular_b.pop(0) if regular_b else None)
                    else:
                        chosen = regular_b.pop(0) if regular_b else (regular_a.pop(0) if regular_a else None)

                    grid[r][c] = chosen

            # Check neighbor conflicts and build SeatAssignment objects
            grade_dist: Dict[str, int] = {}
            subject_dist: Dict[str, int] = {}
            total_assigned_room = 0

            for r in range(rows):
                for c in range(cols):
                    seat_idx = r * cols + c
                    if seat_idx >= capacity:
                        continue

                    seat_letter = chr(65 + r) if r < 26 else f"R{r+1}"
                    seat_label = f"{seat_letter}{c + 1}"
                    item = grid[r][c]

                    has_neighbor_conflict = False
                    if item:
                        total_assigned_room += 1
                        sub_code = item["subject"].code
                        grd = item["student"].grade

                        grade_dist[grd] = grade_dist.get(grd, 0) + 1
                        subject_dist[sub_code] = subject_dist.get(sub_code, 0) + 1

                        # Check adjacent cells for identical subject
                        neighbors = [
                            (r - 1, c),  # Top
                            (r + 1, c),  # Bottom
                            (r, c - 1),  # Left
                            (r, c + 1),  # Right
                        ]
                        for nr, nc in neighbors:
                            if 0 <= nr < rows and 0 <= nc < cols:
                                n_item = grid[nr][nc]
                                if n_item and n_item["subject"].code == sub_code:
                                    n_grd = n_item["student"].grade
                                    # Students from different grade levels take different exam papers, so no cheat risk
                                    if is_xi(n_grd) != is_xi(grd):
                                        continue
                                    has_neighbor_conflict = True
                                    break

                        if has_neighbor_conflict:
                            conflicts.append(schemas.ConflictWarning(
                                type="neighbor_same_subject",
                                severity="warning",
                                message=f"Student {item['student'].roll_no} sitting adjacent to another student with same subject {sub_code}",
                                roomId=room.id,
                                studentId=item["student"].id,
                                seatLabel=seat_label
                            ))

                        seat_assign = schemas.SeatAssignment(
                            seatIndex=seat_idx,
                            row=r,
                            col=c,
                            seatLabel=seat_label,
                            studentId=item["student"].id,
                            studentRollNo=item["student"].roll_no,
                            studentName=item["student"].name,
                            studentGrade=item["student"].grade,
                            subjectCode=item["subject"].code,
                            subjectName=item["subject"].name,
                            subjectColor=item["subject"].color,
                            isSpecialNeeds=item["student"].special_needs,
                            hasNeighborConflict=has_neighbor_conflict
                        )
                        assigned_seats.append(seat_assign)

                        # Insert into DB models.SeatAllocation
                        db_alloc = models.SeatAllocation(
                            id=f"alloc-{session_id}-{room.id}-{seat_idx}",
                            session_id=session_id,
                            room_id=room.id,
                            seat_index=seat_idx,
                            row=r,
                            col=c,
                            seat_label=seat_label,
                            student_id=item["student"].id,
                            subject_id=item["subject"].id,
                            neighbor_conflict=has_neighbor_conflict,
                            is_special_needs=item["student"].special_needs
                        )
                        db.add(db_alloc)

                        # Update or create StudentMonitoring record for student
                        existing_mon = db.query(models.StudentMonitoring).filter(
                            models.StudentMonitoring.student_id == item["student"].id,
                            models.StudentMonitoring.session_id == session_id
                        ).first()

                        if existing_mon:
                            existing_mon.room_id = room.id
                            existing_mon.seat_label = seat_label
                        else:
                            new_mon = models.StudentMonitoring(
                                id=f"mon-{session_id}-{item['student'].id}",
                                student_id=item["student"].id,
                                session_id=session_id,
                                room_id=room.id,
                                seat_label=seat_label,
                                status="not_checked_in"
                            )
                            db.add(new_mon)
                    else:
                        # Empty seat
                        assigned_seats.append(schemas.SeatAssignment(
                            seatIndex=seat_idx,
                            row=r,
                            col=c,
                            seatLabel=seat_label
                        ))

            room_alloc = schemas.RoomAllocation(
                roomId=room.id,
                roomName=room.name,
                building=room.building or "",
                floor=room.floor or "",
                capacity=room.capacity,
                rows=rows,
                cols=cols,
                benchType=room.bench_type,
                assignedSeats=assigned_seats,
                totalAssigned=total_assigned_room,
                gradeDistribution=grade_dist,
                subjectDistribution=subject_dist,
                invigilator="Allocated"
            )
            room_allocations.append(room_alloc)

        # Record any unassigned students
        for p in pools:
            for item in p["list"]:
                unassigned_students.append(schemas.UnassignedStudent(
                    student=schemas.Student(
                        id=item["student"].id,
                        rollNo=item["student"].roll_no,
                        name=item["student"].name,
                        grade=item["student"].grade,
                        gender=item["student"].gender,
                        specialNeeds=item["student"].special_needs,
                        enrolledSubjectIds=[s.id for s in item["student"].enrolled_subjects]
                    ),
                    subject=schemas.ExamSubject(
                        id=item["subject"].id,
                        code=item["subject"].code,
                        name=item["subject"].name,
                        gradeLevel=item["subject"].grade_level,
                        color=item["subject"].color
                    ),
                    reason="Exam hall capacity exhausted"
                ))

        # Compute global stats
        total_candidates = len(candidates)
        total_assigned = sum(r.totalAssigned for r in room_allocations)
        total_cap_avail = sum(r.capacity for r in active_rooms)
        rooms_used = sum(1 for r in room_allocations if r.totalAssigned > 0)
        mixed_rooms = sum(1 for r in room_allocations if (len(r.gradeDistribution) > 1 or len(r.subjectDistribution) > 1) and r.totalAssigned > 0)
        single_rooms = sum(1 for r in room_allocations if len(r.gradeDistribution) <= 1 and len(r.subjectDistribution) <= 1 and r.totalAssigned > 0)

        conflict_count = len([c for c in conflicts if c.severity in ["warning", "error"]])
        cheat_prev_index = 100.0
        if total_assigned > 0:
            seated_conflicts = sum(
                1 for r in room_allocations for s in r.assignedSeats if s.studentId and s.hasNeighborConflict
            )
            cheat_prev_index = max(0.0, round(100.0 * (1 - (seated_conflicts / total_assigned)), 1))

        stats = schemas.SeatingPlanStats(
            totalStudents=total_candidates,
            totalAssigned=total_assigned,
            totalRoomsUsed=rooms_used,
            totalCapacityAvailable=total_cap_avail,
            overallUtilizationPercent=round(100.0 * total_assigned / max(1, total_cap_avail), 1),
            mixedRoomCount=mixed_rooms,
            singleGroupRoomCount=single_rooms,
            conflictCount=conflict_count,
            cheatPreventionIndex=cheat_prev_index
        )

        db.commit()

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return schemas.SeatingPlan(
            id=f"plan-{session_id}-{int(now_utc.timestamp())}",
            sessionId=exam_session.id,
            sessionName=exam_session.name,
            sessionDate=exam_session.date,
            sessionTime=exam_session.time_slot,
            createdAt=now_utc.isoformat(),
            options=options,
            roomAllocations=room_allocations,
            unassignedStudents=unassigned_students,
            conflicts=conflicts,
            stats=stats
        )
