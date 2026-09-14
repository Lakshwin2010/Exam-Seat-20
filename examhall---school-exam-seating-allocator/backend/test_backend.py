import sys
import datetime
from pathlib import Path
import unittest

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app import models, schemas
from app.excel_service import ExcelService
from app.allocation_service import AllocationEngine
from app.monitoring_service import MonitoringService

class TestExamHallBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        print("[OK] Health check passed")

    def test_02_source_files_scan(self):
        response = self.client.get("/api/source/files")
        self.assertEqual(response.status_code, 200)
        files = response.json()
        self.assertTrue(len(files) > 0, "Should detect at least 1 Excel file in source folder")
        print(f"[OK] Scanned {len(files)} source files successfully")

    def test_03_source_sync(self):
        response = self.client.post("/api/source/sync")
        self.assertEqual(response.status_code, 200)
        res = response.json()
        self.assertEqual(res["status"], "success")
        print(f"[OK] Source sync result: {res['imported']}")

        # Verify students and rooms in DB
        stud_count = self.db.query(models.Student).count()
        self.assertGreater(stud_count, 0, "Students should be populated in DB")

        room_count = self.db.query(models.ExamRoom).count()
        self.assertGreater(room_count, 0, "Rooms should be populated in DB")

        # Exam schedules are dynamically managed from the main web
        sess_count = self.db.query(models.ExamSession).count()
        print(f"[OK] DB state: {stud_count} students, {room_count} rooms, {sess_count} sessions (schedules dynamically managed)")

    def test_04_students_api(self):
        response = self.client.get("/api/students")
        self.assertEqual(response.status_code, 200)
        students = response.json()
        self.assertGreater(len(students), 0)
        print(f"[OK] Students API returned {len(students)} students")

    def test_05_rooms_api(self):
        response = self.client.get("/api/rooms")
        self.assertEqual(response.status_code, 200)
        rooms = response.json()
        self.assertGreater(len(rooms), 0)
        print(f"[OK] Rooms API returned {len(rooms)} rooms")

    def test_06_seating_allocation_generation(self):
        # Simulate creating an exam schedule dynamically from the web
        subjects = self.client.get("/api/subjects").json()
        self.assertGreater(len(subjects), 0)
        sess_payload = {
            "name": f"General Term Exam {datetime.datetime.now().strftime('%H%M%S%f')}",
            "date": "2026-09-25",
            "timeSlot": "09:00 AM - 12:00 PM",
            "subjectIds": [subjects[0]["id"]]
        }
        res_sess = self.client.post("/api/sessions", json=sess_payload)
        self.assertEqual(res_sess.status_code, 200)
        session = res_sess.json()

        response = self.client.post(f"/api/allocations/generate?session_id={session['id']}")
        self.assertEqual(response.status_code, 200)
        plan = response.json()

        self.assertEqual(plan["sessionId"], session["id"])
        self.assertGreater(plan["stats"]["totalAssigned"], 0)
        self.assertGreaterEqual(plan["stats"]["cheatPreventionIndex"], 0.0)
        print(f"[OK] Seating plan generated: {plan['stats']['totalAssigned']} students seated, cheat index: {plan['stats']['cheatPreventionIndex']}%")

    def test_07_student_monitoring_lifecycle(self):
        session = self.db.query(models.ExamSession).first()
        student = self.db.query(models.Student).first()
        self.assertIsNotNone(session)
        self.assertIsNotNone(student)

        # 1. Check in student
        status_update = {
            "status": "checked_in",
            "remarks": "Arrived at hall on time",
            "seatLabel": "A1"
        }
        res = self.client.patch(f"/api/students/{student.id}/status?session_id={session.id}", json=status_update)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "checked_in")
        self.assertIsNotNone(data["checkInTime"])
        print(f"[OK] Student check-in verified: {student.name} marked checked_in")

        # 2. Mark in hall
        res2 = self.client.patch(f"/api/students/{student.id}/status?session_id={session.id}", json={"status": "in_hall"})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "in_hall")

        # 3. Log an incident
        incident_data = {
            "sessionId": session.id,
            "studentId": student.id,
            "incidentType": "unauthorized_material",
            "severity": "high",
            "description": "Student had a calculator not permitted for this exam paper",
            "reportedBy": "Invigilator Room 101",
            "actionTaken": "Calculator confiscated and warning issued"
        }
        inc_res = self.client.post("/api/monitoring/incidents", json=incident_data)
        self.assertEqual(inc_res.status_code, 200)
        inc_json = inc_res.json()
        self.assertEqual(inc_json["severity"], "high")
        print("[OK] Monitoring incident logged successfully")

        # 4. Check dashboard metrics
        dash_res = self.client.get(f"/api/monitoring/dashboard?session_id={session.id}")
        self.assertEqual(dash_res.status_code, 200)
        dash = dash_res.json()
        self.assertGreater(dash["totalStudents"], 0)
        self.assertGreaterEqual(dash["totalCheckedIn"], 1)
        self.assertGreaterEqual(dash["totalFlagged"], 1)  # student was flagged by high severity incident
        print(f"[OK] Dashboard stats: {dash['attendanceRate']}% attendance, {dash['totalFlagged']} flagged, {len(dash['recentIncidents'])} incidents")

    def test_08_email_router(self):
        # 1. Test recipients endpoint
        rec_res = self.client.get("/api/email/recipients")
        self.assertEqual(rec_res.status_code, 200)
        rec_data = rec_res.json()
        self.assertEqual(rec_data["totalSections"], 15)
        
        # Verify XI-A and XI-B pre-configured emails
        sections_map = {s["section"]: s for s in rec_data["sections"]}
        self.assertEqual(sections_map["XI - A"]["email"], "erd_s1401728@csacademy.in")
        self.assertEqual(sections_map["XI - B"]["email"], "erd_s1803155@csacademy.in")
        self.assertEqual(sections_map["XI - A"]["studentCount"], 30)
        self.assertEqual(sections_map["XI - B"]["studentCount"], 33)
        print("[OK] Email recipients verified (15 sections XI & XII, XI-A & XI-B configured)")

        # 2. Test class sheet generation for XI-A
        sheet_res = self.client.get("/api/email/class-sheet/XI%20-%20A")
        self.assertEqual(sheet_res.status_code, 200)
        sheet_data = sheet_res.json()
        self.assertEqual(sheet_data["studentCount"], 30)
        self.assertTrue(sheet_data["filename"].endswith(".xlsx"))
        self.assertTrue(len(sheet_data["base64"]) > 500)
        print(f"[OK] 2-Tab Class sheet generated: {sheet_data['filename']} ({sheet_data['sizeBytes']} bytes, base64 payload verified)")

    def test_09_grade_specific_exam_pairing(self):
        # Create a session where Grade XI writes MATH and Grade XII writes PHY
        subjects = self.client.get("/api/subjects").json()
        math_sub = next(s for s in subjects if s["code"] == "MATH")
        phy_sub = next(s for s in subjects if s["code"] == "PHY")

        sess_name = f"Paired Term Exam {datetime.datetime.now().strftime('%H%M%S')}"
        payload = {
            "name": sess_name,
            "date": "2026-09-20",
            "timeSlot": "09:00 AM - 12:00 PM",
            "grade11SubjectIds": [math_sub["id"]],
            "grade12SubjectIds": [phy_sub["id"]]
        }
        res = self.client.post("/api/sessions", json=payload)
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(len(session["grade11SubjectIds"]), 1)
        self.assertEqual(len(session["grade12SubjectIds"]), 1)

        # Generate seating allocation
        alloc_res = self.client.post(f"/api/allocations/generate?session_id={session['id']}")
        self.assertEqual(alloc_res.status_code, 200)
        plan = alloc_res.json()
        self.assertGreater(plan["stats"]["totalAssigned"], 0)

        # Verify 50/50 same-class paired allocation: 15 Class 11 & 15 Class 12 in Room XI - A (capacity 30)
        first_room = plan["roomAllocations"][0]
        self.assertEqual(first_room["roomName"], "XI - A")
        self.assertEqual(first_room["capacity"], 30)
        self.assertEqual(first_room["totalAssigned"], 30)

        g11_seats = [s for s in first_room["assignedSeats"] if s.get("studentGrade") and "XI" in s["studentGrade"].upper() and "XII" not in s["studentGrade"].upper()]
        g12_seats = [s for s in first_room["assignedSeats"] if s.get("studentGrade") and "XII" in s["studentGrade"].upper()]

        self.assertEqual(len(g11_seats), 15, "Room XI-A must seat exactly 15 Class 11 students")
        self.assertEqual(len(g12_seats), 15, "Room XI-A must seat exactly 15 Class 12 students")

        # Verify all 15 Class 11 students are from the SAME class (XI - A)
        for s in g11_seats:
            self.assertEqual(s["studentGrade"], "XI - A", f"All Class 11 students in Room 1 must be from XI - A, got {s['studentGrade']}")

        # Verify all 15 Class 12 students are from the SAME class (XII - A)
        for s in g12_seats:
            self.assertEqual(s["studentGrade"], "XII - A", f"All Class 12 students in Room 1 must be from XII - A, got {s['studentGrade']}")

        # Verify dynamic change according to room capacity / class strength in Room XI - C (capacity 34)
        xi_c_room = next((r for r in plan["roomAllocations"] if r["roomName"] == "XI - C"), None)
        if xi_c_room:
            xi_c_g11 = [s for s in xi_c_room["assignedSeats"] if s.get("studentGrade") and "XI" in s["studentGrade"].upper() and "XII" not in s["studentGrade"].upper()]
            xi_c_g12 = [s for s in xi_c_room["assignedSeats"] if s.get("studentGrade") and "XII" in s["studentGrade"].upper()]
            self.assertEqual(len(xi_c_g11), 17, "Room XI-C (capacity 34) must dynamically seat 17 Class 11 students")
            self.assertEqual(len(xi_c_g12), 17, "Room XI-C (capacity 34) must dynamically seat 17 Class 12 students")

        # Verify anti-cheating index
        self.assertEqual(plan["stats"]["cheatPreventionIndex"], 100.0)
        print(f"[OK] Paired exam verified: Room XI-A has 15 XI-A & 15 XII-A students, dynamically adjusts by class strength (XI-C has 17 & 17), 100% cheat prevention index!")

        # Verify dual-tab sheet with session_id
        sheet_res = self.client.get(f"/api/email/class-sheet/XI%20-%20A?session_id={session['id']}")
        self.assertEqual(sheet_res.status_code, 200)
        sheet_data = sheet_res.json()
        self.assertGreater(sheet_data["roomSeatsCount"], 0)
        self.assertGreater(sheet_data["despatchCount"], 0)
        print(f"[OK] Dual-report verified for XI-A in session: {sheet_data['roomSeatsCount']} in-room seats, {sheet_data['despatchCount']} dispatched")

if __name__ == "__main__":
    unittest.main(verbosity=2)
