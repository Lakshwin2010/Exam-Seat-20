# ExamHall - School Exam Seating Allocator & Student Monitoring System

A complete unified software application combining:
1. **React 19 Frontend**: Seating arrangement visualization, student monitoring dashboard, classrooms manager, and Excel sync interface.
2. **FastAPI & SQLite Backend**: Real-time student attendance monitoring, 50/50 anti-cheating seating allocation, and automated Excel sheet ingestion from the `source/` folder.

---

## 🚀 One-Click Launch (Unified on Port 8000)

Double-click **`start.bat`** or run:

```powershell
cd backend
python run.py
```

- **Complete Web Software (Frontend + Backend)**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Student Monitoring Dashboard**: [http://localhost:8000/api/monitoring/dashboard](http://localhost:8000/api/monitoring/dashboard)

---

## 📁 Source Excel Ingestion

Drop your class and exam spreadsheets into:
`E:\Ye not me\Antigravity\source\`

Supports multi-section school formats (e.g. `XI - Subject wise details AS ON 28.07.2026.xlsx`) with section tabs (`XI - A`, `XI - B`, `XI - G`), `EXAM NO`, `Name`, `Group`, and individual subject columns (`SUB 1` to `SUB 6`).
Click **Sync Source Excel** in the web UI anytime to instantly update your database!
