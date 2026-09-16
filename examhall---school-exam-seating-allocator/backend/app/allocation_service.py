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

        # Helpers to identify grade level and section
        def is_xi(g: str) -> bool:
            u = (g or "").upper()
            return "XI" in u and "XII" not in u

        def is_xii(g: str) -> bool:
            return "XII" in (g or "").upper()

        def extract_section_key(g: str) -> str:
            parts = (g or "").replace("-", " ").split()
            for p in reversed(parts):
                p_clean = p.strip().upper()
                if p_clean and p_clean not in ["XI", "XII", "GRADE", "CLASS", "SECTION"]:
                    return p_clean
            return (g or "").strip().upper()

        # 2. Group candidates strictly by Section (e.g. XI - A, XI - B, XII - A, XII - B...)
        section_map: Dict[str, List[Dict[str, Any]]] = {}
        for c in candidates:
            sec_name = c["student"].grade or "General"
            if sec_name not in section_map:
                section_map[sec_name] = []
            section_map[sec_name].append(c)

        # Sort students inside each section (special needs first, then roll number)
        for sec_name, members in section_map.items():
            members.sort(
                key=lambda x: (
                    0 if (options.prioritizeSpecialNeedsFront and x["student"].special_needs) else 1,
                    x["student"].roll_no
                )
            )

        # Separate pools for Class 11 and Class 12 sections
        xi_pools: List[Dict[str, Any]] = []
        xii_pools: List[Dict[str, Any]] = []
        other_pools: List[Dict[str, Any]] = []

        for sec_name, members in section_map.items():
            pool_item = {
                "section": sec_name,
                "section_key": extract_section_key(sec_name),
                "list": list(members),
                "originalCount": len(members),
                "subject": members[0]["subject"] if members else None,
                "grade": sec_name
            }
            if is_xi(sec_name):
                xi_pools.append(pool_item)
            elif is_xii(sec_name):
                xii_pools.append(pool_item)
            else:
                other_pools.append(pool_item)

        # Sort section pools alphabetically by section key (A, B, C...)
        xi_pools.sort(key=lambda p: (p["section_key"], p["section"]))
        xii_pools.sort(key=lambda p: (p["section_key"], p["section"]))

        # Build matched section pairs (XI-A with XII-A, XI-B with XII-B, etc.)
        paired_list: List[Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]] = []
        unmatched_xii = list(xii_pools)

        for p_xi in xi_pools:
            match_xii = next((p for p in unmatched_xii if p["section_key"] == p_xi["section_key"]), None)
            if match_xii:
                unmatched_xii.remove(match_xii)
                paired_list.append((p_xi, match_xii))
            else:
                if unmatched_xii:
                    paired_list.append((p_xi, unmatched_xii.pop(0)))
                else:
                    paired_list.append((p_xi, None))

        for p_xii in unmatched_xii:
            paired_list.append((None, p_xii))

        for p_oth in other_pools:
            paired_list.append((p_oth, None))

        all_section_pools = xi_pools + xii_pools + other_pools
        pools = all_section_pools

        room_allocations: List[schemas.RoomAllocation] = []
        unassigned_students: List[schemas.UnassignedStudent] = []
        conflicts: List[schemas.ConflictWarning] = []

        # Clear existing allocations for this session in DB
        db.query(models.SeatAllocation).filter(models.SeatAllocation.session_id == session_id).delete()

        # Order active rooms so matching section rooms are paired together (e.g. XI - A, XII - A, XI - B, XII - B...)
        rooms_by_sec: Dict[str, List[models.ExamRoom]] = {}
        generic_rooms: List[models.ExamRoom] = []
        for r in active_rooms:
            r_sec = extract_section_key(r.name)
            if is_xi(r.name) or is_xii(r.name):
                if r_sec not in rooms_by_sec:
                    rooms_by_sec[r_sec] = []
                rooms_by_sec[r_sec].append(r)
            else:
                generic_rooms.append(r)

        ordered_rooms: List[models.ExamRoom] = []
        for sk in sorted(rooms_by_sec.keys()):
            sec_rooms = rooms_by_sec[sk]
            sec_rooms.sort(key=lambda r: (0 if is_xi(r.name) else 1, r.name))
            ordered_rooms.extend(sec_rooms)
        ordered_rooms.extend(generic_rooms)

        if not ordered_rooms:
            ordered_rooms = list(active_rooms)

        # 3. Allocate Room by Room: strictly 1 section of Class 11 and 1 section of Class 12 per room
        current_pair_idx = 0

        for room in ordered_rooms:
            # Advance to next section pair if current pair is exhausted
            while current_pair_idx < len(paired_list):
                p_a, p_b = paired_list[current_pair_idx]
                rem_a = len(p_a["list"]) if p_a else 0
                rem_b = len(p_b["list"]) if p_b else 0
                if rem_a > 0 or rem_b > 0:
                    break
                current_pair_idx += 1

            if current_pair_idx >= len(paired_list):
                break

            cur_xi_pool, cur_xii_pool = paired_list[current_pair_idx]

            rows = room.rows or max(1, math.ceil(room.capacity / (room.cols or 6)))
            cols = room.cols or max(1, math.ceil(room.capacity / rows))
            capacity = room.capacity

            # Initialize seat grid
            grid: List[List[Optional[Dict[str, Any]]]] = [[None for _ in range(cols)] for _ in range(rows)]
            assigned_seats: List[schemas.SeatAssignment] = []

            taken_a: List[Dict[str, Any]] = []
            taken_b: List[Dict[str, Any]] = []

            has_xi_in_pair = bool(cur_xi_pool and len(cur_xi_pool["list"]) > 0)
            has_xii_in_pair = bool(cur_xii_pool and len(cur_xii_pool["list"]) > 0)

            if has_xi_in_pair and has_xii_in_pair:
                # Exact 50/50 seat split: 15 Class 11 and 15 Class 12 for a 30-capacity room
                target_a = math.ceil(capacity / 2)
                target_b = capacity - target_a

                # Take up to target_a strictly from this single XI section
                take_a = min(target_a, len(cur_xi_pool["list"]))
                taken_a = cur_xi_pool["list"][:take_a]
                del cur_xi_pool["list"][:take_a]

                # Take up to target_b strictly from this single XII section
                take_b = min(target_b, len(cur_xii_pool["list"]))
                taken_b = cur_xii_pool["list"][:take_b]
                del cur_xii_pool["list"][:take_b]

                # If one section in this pair had fewer than target, allow the other section of the same pair to fill room
                rem_capacity = capacity - (len(taken_a) + len(taken_b))
                if rem_capacity > 0 and cur_xi_pool["list"]:
                    extra_a = min(rem_capacity, len(cur_xi_pool["list"]))
                    taken_a.extend(cur_xi_pool["list"][:extra_a])
                    del cur_xi_pool["list"][:extra_a]
                    rem_capacity = capacity - (len(taken_a) + len(taken_b))

                if rem_capacity > 0 and cur_xii_pool["list"]:
                    extra_b = min(rem_capacity, len(cur_xii_pool["list"]))
                    taken_b.extend(cur_xii_pool["list"][:extra_b])
                    del cur_xii_pool["list"][:extra_b]

            elif has_xi_in_pair:
                take_a = min(capacity, len(cur_xi_pool["list"]))
                taken_a = cur_xi_pool["list"][:take_a]
                del cur_xi_pool["list"][:take_a]

            elif has_xii_in_pair:
                take_b = min(capacity, len(cur_xii_pool["list"]))
                taken_b = cur_xii_pool["list"][:take_b]
                del cur_xii_pool["list"][:take_b]

            # In case there are a few extra tables, put a few students of another class also
            rem_capacity = capacity - (len(taken_a) + len(taken_b))
            if rem_capacity > 0:
                for next_pair_idx in range(current_pair_idx + 1, len(paired_list)):
                    if rem_capacity <= 0:
                        break
                    nxt_xi, nxt_xii = paired_list[next_pair_idx]

                    if rem_capacity > 0 and nxt_xi and nxt_xi["list"]:
                        half_rem = math.ceil(rem_capacity / 2) if (nxt_xii and nxt_xii["list"]) else rem_capacity
                        take_nxt_a = min(half_rem, len(nxt_xi["list"]))
                        taken_a.extend(nxt_xi["list"][:take_nxt_a])
                        del nxt_xi["list"][:take_nxt_a]
                        rem_capacity = capacity - (len(taken_a) + len(taken_b))

                    if rem_capacity > 0 and nxt_xii and nxt_xii["list"]:
                        take_nxt_b = min(rem_capacity, len(nxt_xii["list"]))
                        taken_b.extend(nxt_xii["list"][:take_nxt_b])
                        del nxt_xii["list"][:take_nxt_b]
                        rem_capacity = capacity - (len(taken_a) + len(taken_b))

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

            # Fill remaining seats desk by desk
            for r in range(rows):
                for c in range(cols):
                    seat_idx = r * cols + c
                    if seat_idx >= capacity:
                        continue
                    if grid[r][c] is not None:
                        continue

                    # Alternating pattern:
                    if options.strategy == "column_alternate":
                        is_slot_a = (c % 2 == 0)
                    elif options.strategy == "row_alternate":
                        is_slot_a = (r % 2 == 0)
                    else:
                        # checkerboard / split_50_50 default:
                        # (r + c) % 2 == 0 provides alternating desks horizontally & vertically
                        is_slot_a = ((r + c) % 2 == 0)

                    if is_slot_a:
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
                                    # In row-alternation, students from different sections (e.g. XI-A vs XI-B) interleaved have no cheat risk
                                    if nr == r and n_grd != grd:
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
