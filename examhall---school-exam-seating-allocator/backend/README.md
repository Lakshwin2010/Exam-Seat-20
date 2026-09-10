# ExamHall Seating Allocator & Student Monitoring Backend

FastAPI and SQLite backend for the ExamHall exam seating allocator and real-time student monitoring system.

## Key Features

1. **Automatic Excel Ingestion from `source/`**:
   - Watches the `source/` folder (`e:/Ye not me/Antigravity/source`).
   - Supports single multi-tab master workbooks (`Students`, `Rooms`, `Subjects`, `Sessions`) and individual Excel sheets (`.xlsx`, `.xls`, `.csv`).
   - Resilient, case-insensitive column header mapping (handles variations like *Roll Number*, *Student Name*, *Candidate ID*, *Class*, *Capacity*, *Bench Type*, etc.).
   - On-demand sync via `POST /api/source/sync` or 1-click button in the UI.

2. **Database to Monitor Students (`data/exam_hall.db`)**:
   - Real-time student attendance and status tracking:
     - `not_checked_in`
     - `checked_in`
     - `in_hall`
     - `completed` (submitted paper)
     - `absent`
     - `flagged` (under review / malpractice alert)
   - Timestamps for arrival and paper submission.
   - Incident logging for invigilators (malpractice suspicion, unauthorized notes, seat violations, medical emergencies).
   - Live room-by-room attendance breakdown and occupancy metrics.

3. **50/50 Anti-Cheating Seating Allocation**:
   - Backend allocation engine supporting 50/50 classroom splits, checkerboard mixing, column alternation, and paired bench partner separation.
   - Front-row accessibility prioritization for special needs students.
   - Neighbor conflict detection (identifies any two adjacent students assigned the same subject paper).
   - Direct export of the final seating plan to Excel (`.xlsx`).

---

## How to Run the Backend

```powershell
# Navigate to the backend directory
cd "e:\Ye not me\Antigravity\examhall---school-exam-seating-allocator\backend"

# Start the server
python run.py
```

- Server URL: `http://localhost:8000`
- Interactive OpenAPI / Swagger Documentation: `http://localhost:8000/docs`

---

## Running Automated Tests

```powershell
python test_backend.py
```

All 7 test suites verify:
- Health check
- Source folder scanning
- Database synchronization
- Student & Room APIs
- Seating allocation generation
- Student monitoring lifecycle (check-in, in-hall, submit, absent, flag)
- Incident reporting & dashboard calculation

---

## Excel File Format Guide (Matching "XI - Subject wise details")

Place your spreadsheets in `e:/Ye not me/Antigravity/source/` (or project `./source`).

### 1. School Section-wise Layout (Native Support)
The backend natively parses the exact school roster format:
- **Sheet Names**: Class sections, e.g. `A`, `B`, `C`, `D -cep`, `E - cep`, `F - CEP`, `G`, `H` or `XI - A`, `XI - B`, etc.
- **Title Row (Row 0 / Cell A1)**: Section name (e.g. `XI - A`, `XI - D`).
- **Header Row (Row 1)**:

| S.No. | EXAM NO | Name | Group | SUB 1 | SUB 2 | SUB 3 | SUB 4 | SUB 5 | SUB 6 |
| ----- | ------- | ---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| 1     | 11101   | AADHITYA A | I D | Eng | PSY | Phy | Che | Bio | BA |
| 2     | 11102   | ADHITHYAA R S | II A | Eng | Math | Phy | Che | CS | BA |
| 1     | 11701   | AISHWARYA G | III A | Eng | Acc | BS | Eco | DS | A.M |

- **Footer Protection**: Footers and teacher tags (e.g. `TOTAL`, `CT: Class Teacher`, `ACT: Asst Teacher`) are automatically detected and omitted from student rosters.
- **Subject Normalization**:
  - `Eng` -> English Core
  - `Math` -> Mathematics
  - `A.M` -> Applied Mathematics
  - `Phy` -> Physics
  - `Che` -> Chemistry
  - `Bio` -> Biology
  - `CS` -> Computer Science
  - `Acc` -> Accountancy
  - `BS` -> Business Studies
  - `Eco` -> Economics
  - `Entre` -> Entrepreneurship
  - `BA` -> Business Administration
  - `DS` -> Data Science
  - `FN` / `FND` -> Financial Markets / Food & Nutrition
  - `Psy` -> Psychology

### 2. Examination Rooms Sheet (`Rooms`)
| Room Name | Building | Floor | Capacity | Rows | Columns | Bench Type | Active |
| --------- | -------- | ----- | -------- | ---- | ------- | ---------- | ------ |
| Auditorium Hall A | Main Block | Ground Floor | 50 | 5 | 10 | paired | Yes |
| Room 101 | Science Wing | 1st Floor | 30 | 5 | 6 | single | Yes |
| Room 102 | Science Wing | 1st Floor | 30 | 5 | 6 | single | Yes |

### 3. Exam Sessions Timetable Sheet (`Sessions`)
| Session Name | Date | Time Slot | Subjects |
| ------------ | ---- | --------- | -------- |
| Term Exam - Physics & Business Studies | 2026-09-10 | 09:00 AM - 12:00 PM | PHY, BS |
| Term Exam - Chemistry & Accountancy | 2026-09-12 | 09:00 AM - 12:00 PM | CHE, ACC |
| Term Exam - Mathematics & Economics | 2026-09-14 | 09:00 AM - 12:00 PM | MATH, ECO |
| Term Exam - English Language Core | 2026-09-16 | 09:00 AM - 12:00 PM | ENG |
| Term Exam - Biology & Computer Science | 2026-09-18 | 09:00 AM - 12:00 PM | BIO, CS |
