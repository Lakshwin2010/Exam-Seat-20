import sys
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

        # Verify students in DB
        stud_count = self.db.query(models.Student).count()
        self.assertGreater(stud_count, 0, "Students should be populated in DB")

        room_count = self.db.query(models.ExamRoom).count()
        self.assertGreater(room_count, 0, "Rooms should be populated in DB")

        sess_count = self.db.query(models.ExamSession).count()
        self.assertGreater(sess_count, 0, "Sessions should be populated in DB")
        print(f"[OK] DB state: {stud_count} students, {room_count} rooms, {sess_count} sessions")

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
        session = self.db.query(models.ExamSession).first()
        self.assertIsNotNone(session)

        response = self.client.post(f"/api/allocations/generate?session_id={session.id}")
        self.assertEqual(response.status_code, 200)
        plan = response.json()

        self.assertEqual(plan["sessionId"], session.id)
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

if __name__ == "__main__":
    unittest.main(verbosity=2)
