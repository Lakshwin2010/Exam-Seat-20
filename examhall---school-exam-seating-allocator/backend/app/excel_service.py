import os
import re
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
import pandas as pd
from sqlalchemy.orm import Session

from app.config import get_all_source_dirs, get_primary_source_dir
from app import models

# --- CANONICAL SUBJECT DICTIONARY ---
CANONICAL_SUBJECT_MAP = {
    'ENG': ('ENG', 'English Core', '#2563EB'),
    'ENGLISH': ('ENG', 'English Core', '#2563EB'),
    'MATH': ('MATH', 'Mathematics', '#DC2626'),
    'MATHEMATICS': ('MATH', 'Mathematics', '#DC2626'),
    'A.M': ('A.M', 'Applied Mathematics', '#E11D48'),
    'AM': ('A.M', 'Applied Mathematics', '#E11D48'),
    'AMATH': ('A.M', 'Applied Mathematics', '#E11D48'),
    'APPLIED MATH': ('A.M', 'Applied Mathematics', '#E11D48'),
    'PHY': ('PHY', 'Physics', '#D97706'),
    'PHYSICS': ('PHY', 'Physics', '#D97706'),
    'CHE': ('CHE', 'Chemistry', '#9333EA'),
    'CHEMISTRY': ('CHE', 'Chemistry', '#9333EA'),
    'BIO': ('BIO', 'Biology', '#0D9488'),
    'BIOLOGY': ('BIO', 'Biology', '#0D9488'),
    'CS': ('CS', 'Computer Science', '#0284C7'),
    'COMPUTER SCIENCE': ('CS', 'Computer Science', '#0284C7'),
    'PSY': ('PSY', 'Psychology', '#7C3AED'),
    'PSYCHOLOGY': ('PSY', 'Psychology', '#7C3AED'),
    'ACC': ('ACC', 'Accountancy', '#16A34A'),
    'ACCOUNTANCY': ('ACC', 'Accountancy', '#16A34A'),
    'BS': ('BS', 'Business Studies', '#CA8A04'),
    'BUSINESS STUDIES': ('BS', 'Business Studies', '#CA8A04'),
    'ECO': ('ECO', 'Economics', '#EA580C'),
    'ECONOMICS': ('ECO', 'Economics', '#EA580C'),
    'ENTRE': ('ENTRE', 'Entrepreneurship', '#4F46E5'),
    'ENTREPRENEURSHIP': ('ENTRE', 'Entrepreneurship', '#4F46E5'),
}

# Skill subjects to exclude per school policy
SKILL_SUBJECT_CODES = {
    'BA', 'BUSINESS ADMIN', 'BUSINESS ADMINISTRATION',
    'DS', 'DATA SCIENCE',
    'FN', 'FND', 'FINANCIAL MARKETS', 'FOOD NUTRITION', 'FOOD & NUTRITION', 'FOOD, NUTRITION & DIETETICS',
    'AI', 'ARTIFICIAL INTELLIGENCE',
    'IT', 'INFORMATION TECHNOLOGY',
    'TYP', 'TYPOGRAPHY'
}

def is_skill_subject(text: Any) -> bool:
    if not text:
        return False
    s_raw = str(text).strip().upper()
    if 'SKILL' in s_raw:
        return True
    s_norm = re.sub(r'[^A-Z0-9]', '', s_raw)
    for code in SKILL_SUBJECT_CODES:
        c_norm = re.sub(r'[^A-Z0-9]', '', code)
        if s_norm == c_norm or s_raw == code:
            return True
    return False

# --- HEADER MATCHING HELPERS ---
def normalize_header(col_name: str) -> str:
    if not isinstance(col_name, str):
        col_name = str(col_name)
    return re.sub(r'[^a-z0-9]', '', col_name.strip().lower())

ROLL_HEADERS = {'roll', 'rollno', 'rollnumber', 'examno', 'examnumber', 'studentid', 'id', 'regno', 'registerno', 'candidateid', 'admissionno'}
NAME_HEADERS = {'name', 'studentname', 'candidatename', 'fullname', 'nameofstudent'}
GRADE_HEADERS = {'grade', 'class', 'gradeclass', 'classgrade', 'section', 'standard', 'division'}
GROUP_HEADERS = {'group', 'gp', 'stream'}
GENDER_HEADERS = {'gender', 'sex'}
SPECIAL_HEADERS = {'specialneeds', 'pwd', 'accessible', 'disability', 'handicapped', 'specialrequirement'}
SUBJECT_HEADERS = {'subjects', 'subjectcodes', 'enrolledsubjects', 'courses', 'subjectcode', 'subject'}

ROOM_NAME_HEADERS = {'roomname', 'room', 'hall', 'roomno', 'classroom', 'hallname', 'examhall'}
BUILDING_HEADERS = {'building', 'block', 'wing', 'buildingname'}
FLOOR_HEADERS = {'floor', 'level'}
CAPACITY_HEADERS = {'capacity', 'cap', 'totalseats', 'seats', 'maxcapacity'}
ROWS_HEADERS = {'rows', 'rowcount', 'numrows', 'totalrows'}
COLS_HEADERS = {'cols', 'columns', 'colcount', 'numcols', 'totalcolumns'}
BENCH_HEADERS = {'benchtype', 'bench', 'seatingtype', 'type'}
ACTIVE_HEADERS = {'active', 'isactive', 'status', 'enabled'}

def match_column(col_candidates: List[str], target_set: set) -> Optional[str]:
    for col in col_candidates:
        norm = normalize_header(col)
        if norm in target_set:
            return col
    for col in col_candidates:
        norm = normalize_header(col)
        for target in target_set:
            if target in norm:
                return col
    return None

class ExcelService:
    @staticmethod
    def scan_source_files() -> List[Dict[str, Any]]:
        """Scans all source directories and lists found Excel and CSV files."""
        results = []
        seen_paths = set()

        for source_dir in get_all_source_dirs():
            if not source_dir.exists():
                continue
            for entry in source_dir.iterdir():
                if entry.name.startswith("~$") or entry.name.startswith("."):
                    continue
                if entry.suffix.lower() in [".xlsx", ".xls", ".csv"] and entry.is_file():
                    abs_path = str(entry.resolve())
                    if abs_path in seen_paths:
                        continue
                    seen_paths.add(abs_path)

                    summary = {
                        "fileName": entry.name,
                        "filePath": abs_path,
                        "fileSizeBytes": entry.stat().st_size,
                        "modifiedTime": datetime.datetime.fromtimestamp(entry.stat().st_mtime, tz=datetime.timezone.utc).isoformat(),
                        "sheets": [],
                        "detectedTypes": [],
                        "recordsCount": {},
                        "status": "ready",
                        "message": "File detected"
                    }

                    try:
                        if entry.suffix.lower() == ".csv":
                            summary["sheets"] = ["Sheet1"]
                            detected, count = ExcelService._quick_inspect_df(pd.read_csv(entry, header=None, nrows=50))
                            summary["detectedTypes"] = [detected]
                            summary["recordsCount"][detected] = count
                        else:
                            with pd.ExcelFile(entry) as xl:
                                summary["sheets"] = xl.sheet_names
                                detected_list = []
                                for sheet in xl.sheet_names:
                                    df = xl.parse(sheet, header=None, nrows=50)
                                    detected, count = ExcelService._quick_inspect_df(df, sheet)
                                    if detected not in ["unknown", "summary"]:
                                        detected_list.append(detected)
                                        summary["recordsCount"][f"{sheet.strip()} ({detected})"] = count
                                summary["detectedTypes"] = list(set(detected_list))
                    except Exception as e:
                        summary["status"] = "error"
                        summary["message"] = str(e)

                    results.append(summary)

        return results

    @staticmethod
    def _quick_inspect_df(df: pd.DataFrame, sheet_name: str = "") -> Tuple[str, int]:
        s_norm = sheet_name.lower().replace(" ", "").replace("-", "")

        # Summary or overall sheets - contain school classroom layout & capacities!
        if "overall" in s_norm or "summary" in s_norm:
            return "rooms", len(df)

        # Room sheets
        if "room" in s_norm or "hall" in s_norm:
            return "rooms", max(0, len(df) - 1)

        # Subject sheets
        if "subject" in s_norm or "course" in s_norm:
            return "subjects", max(0, len(df) - 1)

        # Session sheets
        if "session" in s_norm or "slot" in s_norm or "schedule" in s_norm:
            return "sessions", max(0, len(df) - 1)

        # Inspect top 6 rows for header patterns
        for r in range(min(6, len(df))):
            row_vals = [str(x).strip().lower() for x in df.iloc[r].dropna().tolist()]
            has_roll = any(any(k in v for k in ["exam", "roll", "regno", "admno"]) for v in row_vals)
            has_name = any("name" in v for v in row_vals)
            has_sub = any("sub" in v for v in row_vals)
            has_cap = any(any(k in v for k in ["capacity", "cap", "bldg", "bench"]) for v in row_vals)

            if (has_roll and has_name) or (has_roll and has_sub):
                return "students", max(0, len(df) - (r + 1))
            if has_cap:
                return "rooms", max(0, len(df) - (r + 1))

        # Check section letters (e.g. 'A', 'B', 'C', 'Dcep', etc.)
        if len(s_norm) <= 7 and not any(k in s_norm for k in ["room", "hall", "date", "slot"]):
            for r in range(min(6, len(df))):
                row_str = " ".join([str(x).lower() for x in df.iloc[r].dropna()])
                if "exam" in row_str or "roll" in row_str or "name" in row_str:
                    return "students", max(0, len(df) - (r + 1))

        return "unknown", len(df)

    @staticmethod
    def sync_source_folder(db: Session) -> Dict[str, Any]:
        """Reads all Excel and CSV files from the source folder and imports records into DB."""
        primary_dir = get_primary_source_dir()
        existing_files = [f for f in primary_dir.iterdir() if f.suffix.lower() in [".xlsx", ".xls", ".csv"] and not f.name.startswith("~$")]

        # Generate sample template only if no user files exist
        # if not existing_files:
        #     ExcelService.generate_sample_master_excel(primary_dir / "exam_master_template.xlsx")

        total_imported = {
            "students": 0,
            "rooms": 0,
            "subjects": 0,
            "sessions": 0,
            "files_processed": 0,
            "errors": []
        }

        for source_dir in get_all_source_dirs():
            if not source_dir.exists():
                continue
            for entry in sorted(source_dir.iterdir()):
                if entry.name.startswith("~$") or entry.name.startswith("."):
                    continue
                if "template" in entry.name.lower():
                    continue
                if entry.suffix.lower() in [".xlsx", ".xls", ".csv"] and entry.is_file():
                    try:
                        res = ExcelService.import_file_to_db(entry, db)
                        total_imported["files_processed"] += 1
                        total_imported["students"] += res.get("students", 0)
                        total_imported["rooms"] += res.get("rooms", 0)
                        total_imported["subjects"] += res.get("subjects", 0)
                        total_imported["sessions"] += res.get("sessions", 0)
                    except Exception as e:
                        total_imported["errors"].append(f"Failed {entry.name}: {str(e)}")

        return total_imported

    @staticmethod
    def import_file_to_db(file_path: Path, db: Session) -> Dict[str, int]:
        counts = {"students": 0, "rooms": 0, "subjects": 0, "sessions": 0}

        if file_path.suffix.lower() == ".csv":
            df = pd.read_csv(file_path, header=None)
            dtype, _ = ExcelService._quick_inspect_df(df, file_path.stem)
            if dtype == "students":
                counts["students"] = ExcelService._parse_students_df(df, db, file_path.stem)
            elif dtype == "rooms":
                counts["rooms"] = ExcelService._parse_rooms_df(df, db)
            elif dtype == "subjects":
                counts["subjects"] = ExcelService._parse_subjects_df(df, db)
            elif dtype == "sessions":
                counts["sessions"] = ExcelService._parse_sessions_df(df, db)
            return counts

        with pd.ExcelFile(file_path) as xl:
            # 1. Parse OVER ALL sheet for school classrooms & capacities
            for sheet_name in xl.sheet_names:
                s_norm = sheet_name.lower().replace(" ", "").replace("-", "")
                if "overall" in s_norm or "summary" in s_norm:
                    df = xl.parse(sheet_name, header=None)
                    counts["rooms"] += ExcelService._parse_overall_sheet_for_rooms(df, db)

            # 2. Parse rooms, subjects, and sessions if explicitly defined
            for sheet_name in xl.sheet_names:
                s_norm = sheet_name.lower().replace(" ", "").replace("-", "")
                if "overall" in s_norm or "summary" in s_norm:
                    continue
                df = xl.parse(sheet_name, header=None)
                if df.empty:
                    continue
                dtype, _ = ExcelService._quick_inspect_df(df, sheet_name)
                if dtype == "subjects":
                    counts["subjects"] += ExcelService._parse_subjects_df(df, db)
                elif dtype == "rooms":
                    counts["rooms"] += ExcelService._parse_rooms_df(df, db)
                elif dtype == "sessions":
                    counts["sessions"] += ExcelService._parse_sessions_df(df, db)

            # 3. Parse student section sheets
            for sheet_name in xl.sheet_names:
                s_norm = sheet_name.lower().replace(" ", "").replace("-", "")
                if "overall" in s_norm or "summary" in s_norm:
                    continue
                if "(2)" in sheet_name or "(3)" in sheet_name:
                    continue
                df = xl.parse(sheet_name, header=None)
                if df.empty:
                    continue
                dtype, _ = ExcelService._quick_inspect_df(df, sheet_name)
                if dtype == "students":
                    counts["students"] += ExcelService._parse_students_df(df, db, sheet_name)

            # 4. Dynamically sync classroom capacities to exact enrolled student count in database
            all_rooms = db.query(models.ExamRoom).all()
            for rm in all_rooms:
                st_count = db.query(models.Student).filter(models.Student.grade == rm.name).count()
                if st_count > 0:
                    rm.capacity = st_count
                    rm.rows = max(4, -(-st_count // rm.cols))
                    rm.notes = f"Classroom {rm.name} (Strength: {st_count} students)"

            # 5. Ensure default exam sessions exist
            counts["sessions"] += ExcelService._ensure_default_sessions(db)

        db.commit()
        return counts

    @staticmethod
    def _parse_overall_sheet_for_rooms(df: pd.DataFrame, db: Session) -> int:
        """Extracts classroom names and seating capacities from the OVER ALL sheet for both Grade 11 and Grade 12."""
        if df.empty:
            return 0

        rooms_found: Dict[str, int] = {}
        max_r, max_c = df.shape

        for r in range(max_r):
            for c in range(max_c):
                val = df.iloc[r, c]
                if pd.notna(val) and isinstance(val, str):
                    m = re.match(r'^((?:XI|XII)\s*[-–]\s*[A-H])\b', val.strip(), re.IGNORECASE)
                    if m:
                        sec_name = re.sub(r'\s+', ' ', m.group(1).upper().replace('–', '-')).strip()
                        if sec_name not in rooms_found:
                            cap = 30
                            for r2 in range(r, min(r + 8, max_r)):
                                for c2 in range(max_c):
                                    t_val = df.iloc[r2, c2]
                                    if pd.notna(t_val) and isinstance(t_val, str) and 'TOTAL' in t_val.upper():
                                        for c3 in range(c2 + 1, min(c2 + 4, max_c)):
                                            n_val = df.iloc[r2, c3]
                                            if pd.notna(n_val) and isinstance(n_val, (int, float)) and n_val > 0:
                                                cap = int(n_val)
                                                break
                                        if cap != 30:
                                            break
                                    elif pd.notna(t_val) and isinstance(t_val, (int, float)) and t_val in [21, 25, 28, 30, 31, 32, 33, 34, 37]:
                                        cap = int(t_val)
                            rooms_found[sec_name] = cap

        # Ensure XI - H has correct count (33) if present at bottom
        for r in range(max_r):
            row_str = " ".join([str(x) for x in df.iloc[r].dropna()])
            if "XI - H" in row_str:
                for r2 in range(r, min(r + 6, max_r)):
                    for c2 in range(max_c):
                        v = df.iloc[r2, c2]
                        if pd.notna(v) and isinstance(v, (int, float)) and v in [33, 34]:
                            rooms_found["XI - H"] = int(v)

        count = 0
        for r_name, cap in rooms_found.items():
            clean_code = r_name.lower().replace(" ", "").replace("-", "")
            room_id = f"room-{clean_code}"
            
            # Classroom layout: standard 6 columns (paired benches), enough rows for capacity
            rows = max(4, -(-cap // 6))
            cols = 6
            calc_cap = cap

            existing = db.query(models.ExamRoom).filter(
                (models.ExamRoom.id == room_id) | (models.ExamRoom.name == r_name) | (models.ExamRoom.name == f"Room {r_name}")
            ).first()

            is_xi_wing = "XI" in r_name and "XII" not in r_name
            building_name = "Senior Secondary Block (Wing XI)" if is_xi_wing else "Senior Secondary Block (Wing XII)"
            floor_name = "1st Floor" if any(x in r_name for x in ["A", "B", "C", "D"]) else "2nd Floor"

            if existing:
                existing.name = r_name
                existing.building = building_name
                existing.floor = floor_name
                existing.capacity = calc_cap
                existing.rows = rows
                existing.cols = cols
                existing.bench_type = "paired"
                existing.is_active = True
            else:
                new_room = models.ExamRoom(
                    id=room_id,
                    name=r_name,
                    building=building_name,
                    floor=floor_name,
                    capacity=calc_cap,
                    rows=rows,
                    cols=cols,
                    bench_type="paired",
                    is_active=True,
                    notes=f"Classroom {r_name} (Capacity {cap})"
                )
                db.add(new_room)
                count += 1

        db.flush()
        return count

    @staticmethod
    def _ensure_section_classrooms(db: Session) -> int:
        """Ensures every student section has an active classroom."""
        sections = db.query(models.Student.grade).distinct().all()
        count = 0
        for (sec_name,) in sections:
            if not sec_name or sec_name.lower() in ["general", "all", "none"]:
                continue
            clean_name = sec_name.strip()
            room_id = f"room-{clean_name.lower().replace(' ', '').replace('-', '')}"
            existing = db.query(models.ExamRoom).filter(
                (models.ExamRoom.id == room_id) | (models.ExamRoom.name == clean_name) | (models.ExamRoom.name == f"Room {clean_name}")
            ).first()
            if not existing:
                st_count = db.query(models.Student).filter(models.Student.grade == sec_name).count()
                cap = max(30, st_count)
                rows = max(5, -(-cap // 6))
                new_room = models.ExamRoom(
                    id=room_id,
                    name=clean_name,
                    building="Senior Secondary Wing",
                    floor="1st Floor" if any(x in clean_name for x in ["A", "B", "C", "D"]) else "2nd Floor",
                    capacity=rows * 6,
                    rows=rows,
                    cols=6,
                    bench_type="paired",
                    is_active=True,
                    notes=f"Classroom {clean_name}"
                )
                db.add(new_room)
                count += 1
        db.flush()
        return count

    @staticmethod
    def _ensure_default_sessions(db: Session) -> int:
        """Ensures default exam sessions exist for the school curriculum, only if none exist."""
        if db.query(models.ExamSession).count() > 0:
            return 0

        all_subs = db.query(models.Subject).all()
        sub_by_code = {s.code.upper(): s for s in all_subs}

        default_sessions_data = [
            ("Term Exam - English Language Core", "09:00 AM - 12:00 PM", ["ENG"]),
            ("Term Exam - Math & Additional Subjects", "09:00 AM - 12:00 PM", ["MATH", "A.M", "CS", "PSY", "ENTRE"]),
            ("Term Exam - Biology & Additional Subjects", "01:30 PM - 04:30 PM", ["BIO", "CS", "PSY", "ENTRE"]),
            ("Term Exam - Physics & Economics", "09:00 AM - 12:00 PM", ["PHY", "ECO"]),
            ("Term Exam - Chemistry & Business Subjects", "01:30 PM - 04:30 PM", ["CHE", "BS", "ACC"])
        ]
        count = 0
        today_str = datetime.date.today().isoformat()
        for name, time_slot, sub_codes in default_sessions_data:
            sess_id = f"sess-{name.lower().replace(' ', '-').replace('&', 'and')}"
            matched_subs = [sub_by_code[c] for c in sub_codes if c in sub_by_code]
            new_sess = models.ExamSession(
                id=sess_id,
                name=name,
                date=today_str,
                time_slot=time_slot,
                subjects=matched_subs
            )
            db.add(new_sess)
            count += 1
        db.flush()
        return count

    @staticmethod
    def _parse_students_df(df: pd.DataFrame, db: Session, sheet_name: str = "") -> int:
        """Parses students from either the real school format or flat table format."""
        if df.empty:
            return 0

        # Find header row
        header_row_idx = 0
        for r in range(min(6, len(df))):
            row_str = " ".join([str(x).lower() for x in df.iloc[r].dropna()])
            has_id = any(k in row_str for k in ["exam", "roll", "student id", "studentid", "regno", "admno"])
            has_name_or_sub = any(k in row_str for k in ["name", "sub"])
            if has_id and has_name_or_sub:
                header_row_idx = r
                break

        # Grade / Section from cell (0, 0) or sheet name
        first_cell = str(df.iloc[0, 0]).strip() if len(df) > 0 and pd.notna(df.iloc[0, 0]) else ""
        if any(token in first_cell.upper() for token in ["XI", "XII", "GRADE", "CLASS"]):
            default_grade = re.sub(r'\s+', ' ', first_cell).strip()
        else:
            clean_s = sheet_name.strip()
            default_grade = f"Class XI - {clean_s}" if len(clean_s) <= 4 else clean_s

        raw_headers = [str(x).strip() for x in df.iloc[header_row_idx].tolist()]

        roll_col = None
        name_col = None
        grade_col = None
        gender_col = None
        special_col = None
        sub_cols = []
        comma_sub_col = None

        for c_idx, h in enumerate(raw_headers):
            h_norm = normalize_header(h)
            if match_column([h], ROLL_HEADERS) and roll_col is None:
                roll_col = c_idx
            elif match_column([h], NAME_HEADERS) and name_col is None:
                name_col = c_idx
            elif match_column([h], GRADE_HEADERS) and grade_col is None:
                grade_col = c_idx
            elif match_column([h], GENDER_HEADERS) and gender_col is None:
                gender_col = c_idx
            elif match_column([h], SPECIAL_HEADERS) and special_col is None:
                special_col = c_idx
            elif "sub" in h_norm and re.search(r'\d', h_norm):
                if "sub6" in h_norm or "skill" in h_norm:
                    continue  # EXCLUDE skill subjects
                sub_cols.append(c_idx)
            elif match_column([h], SUBJECT_HEADERS) and comma_sub_col is None:
                comma_sub_col = c_idx

        if roll_col is None or name_col is None:
            return 0

        # Pre-load subjects
        all_subs = db.query(models.Subject).all()
        sub_code_map = {s.code.upper(): s for s in all_subs}

        def get_or_create_subject(raw_code: str) -> models.Subject:
            clean_code = raw_code.strip().upper()
            if clean_code in sub_code_map:
                return sub_code_map[clean_code]

            # Check canonical alias
            if clean_code in CANONICAL_SUBJECT_MAP:
                c_code, c_name, c_color = CANONICAL_SUBJECT_MAP[clean_code]
                if c_code in sub_code_map:
                    return sub_code_map[c_code]
            else:
                c_code = clean_code
                c_name = f"{clean_code} Exam"
                c_color = "#4F46E5"

            new_sub = models.Subject(
                id=f"sub-{c_code.lower().replace('.', '').replace(' ', '-')}",
                code=c_code,
                name=c_name,
                grade_level=default_grade,
                color=c_color
            )
            db.add(new_sub)
            db.flush()
            sub_code_map[c_code] = new_sub
            sub_code_map[clean_code] = new_sub
            return new_sub

        count = 0
        for r in range(header_row_idx + 1, len(df)):
            row = df.iloc[r]
            roll_val = row[roll_col] if roll_col is not None else None
            name_val = row[name_col] if name_col is not None else None

            if pd.isna(roll_val) or pd.isna(name_val):
                continue

            roll_str = str(roll_val).strip()
            if roll_str.endswith(".0"):
                roll_str = roll_str[:-2]

            # Stop or skip if row is a footer, total, or teacher name
            lower_roll = roll_str.lower()
            name_str = str(name_val).strip()
            lower_name = name_str.lower()

            if (
                not roll_str or
                lower_roll in ["total", "nan", "ct:", "act:", "class teacher", "s.no."] or
                "total" in lower_name or
                lower_name.startswith("mr.") or
                lower_name.startswith("ms.")
            ):
                continue

            # Determine grade
            student_grade = default_grade
            if grade_col is not None and pd.notna(row[grade_col]):
                g_str = str(row[grade_col]).strip()
                if g_str and g_str.lower() != "nan":
                    student_grade = g_str

            # Determine gender
            gender = "M"
            if gender_col is not None and pd.notna(row[gender_col]):
                g_val = str(row[gender_col]).strip().upper()
                if g_val in ["M", "F", "OTHER"]:
                    gender = g_val

            # Determine special needs
            special_needs = False
            if special_col is not None and pd.notna(row[special_col]):
                s_val = str(row[special_col]).strip().lower()
                special_needs = s_val in ["yes", "true", "1", "y", "pwd"]

            # Collect enrolled subjects
            enrolled_objs = []
            if sub_cols:
                for sc in sub_cols:
                    sub_val = row[sc]
                    if pd.notna(sub_val):
                        s_text = str(sub_val).strip()
                        if s_text and s_text.lower() != "nan":
                            if is_skill_subject(s_text):
                                continue
                            sub_obj = get_or_create_subject(s_text)
                            if sub_obj and sub_obj not in enrolled_objs:
                                enrolled_objs.append(sub_obj)
            elif comma_sub_col is not None and pd.notna(row[comma_sub_col]):
                raw_subs = str(row[comma_sub_col])
                tokens = re.split(r'[,;|/\n]', raw_subs)
                for t in tokens:
                    s_text = t.strip()
                    if s_text and s_text.lower() != "nan":
                        if is_skill_subject(s_text):
                            continue
                        sub_obj = get_or_create_subject(s_text)
                        if sub_obj and sub_obj not in enrolled_objs:
                            enrolled_objs.append(sub_obj)

            student_id = f"stud-{roll_str.lower().replace(' ', '-')}"
            existing = db.query(models.Student).filter(
                (models.Student.roll_no == roll_str) | (models.Student.id == student_id)
            ).first()

            if existing:
                existing.name = name_str
                existing.grade = student_grade
                existing.gender = gender
                existing.special_needs = special_needs
                if enrolled_objs:
                    existing.enrolled_subjects = enrolled_objs
            else:
                new_student = models.Student(
                    id=student_id,
                    roll_no=roll_str,
                    name=name_str,
                    grade=student_grade,
                    gender=gender,
                    special_needs=special_needs
                )
                if enrolled_objs:
                    new_student.enrolled_subjects = enrolled_objs
                db.add(new_student)
                count += 1

        db.flush()
        return count

    @staticmethod
    def _parse_rooms_df(df: pd.DataFrame, db: Session) -> int:
        if df.empty:
            return 0

        # Header row detection
        h_idx = 0
        for r in range(min(5, len(df))):
            row_str = " ".join([str(x).lower() for x in df.iloc[r].dropna()])
            if any(k in row_str for k in ["room", "hall", "capacity", "cap"]):
                h_idx = r
                break

        headers = [str(x).strip() for x in df.iloc[h_idx].tolist()]
        name_col = None
        bldg_col = None
        floor_col = None
        cap_col = None
        rows_col = None
        cols_col = None
        bench_col = None
        active_col = None

        for c_idx, h in enumerate(headers):
            if match_column([h], ROOM_NAME_HEADERS) and name_col is None:
                name_col = c_idx
            elif match_column([h], BUILDING_HEADERS) and bldg_col is None:
                bldg_col = c_idx
            elif match_column([h], FLOOR_HEADERS) and floor_col is None:
                floor_col = c_idx
            elif match_column([h], CAPACITY_HEADERS) and cap_col is None:
                cap_col = c_idx
            elif match_column([h], ROWS_HEADERS) and rows_col is None:
                rows_col = c_idx
            elif match_column([h], COLS_HEADERS) and cols_col is None:
                cols_col = c_idx
            elif match_column([h], BENCH_HEADERS) and bench_col is None:
                bench_col = c_idx
            elif match_column([h], ACTIVE_HEADERS) and active_col is None:
                active_col = c_idx

        count = 0
        for r in range(h_idx + 1, len(df)):
            row = df.iloc[r]
            name = str(row[name_col]).strip() if name_col is not None and pd.notna(row[name_col]) else ""
            if not name or name.lower() in ["nan", "total"]:
                continue

            bldg = str(row[bldg_col]).strip() if bldg_col is not None and pd.notna(row[bldg_col]) else "Main Academic Block"
            floor = str(row[floor_col]).strip() if floor_col is not None and pd.notna(row[floor_col]) else "1st Floor"

            try:
                capacity = int(row[cap_col]) if cap_col is not None and pd.notna(row[cap_col]) else 30
            except:
                capacity = 30

            try:
                rows_val = int(row[rows_col]) if rows_col is not None and pd.notna(row[rows_col]) else max(1, round(capacity / 6))
            except:
                rows_val = max(1, round(capacity / 6))

            try:
                cols_val = int(row[cols_col]) if cols_col is not None and pd.notna(row[cols_col]) else max(1, -(-capacity // rows_val))
            except:
                cols_val = max(1, -(-capacity // rows_val))

            bench_raw = str(row[bench_col]).strip().lower() if bench_col is not None and pd.notna(row[bench_col]) else "single"
            bench_type = "paired" if "pair" in bench_raw or "double" in bench_raw or "2" in bench_raw else "single"

            is_active = True
            if active_col is not None and pd.notna(row[active_col]):
                val = str(row[active_col]).strip().lower()
                is_active = val not in ["no", "false", "0", "n", "disabled", "inactive"]

            room_id = f"room-{name.lower().replace(' ', '-')}"
            existing = db.query(models.ExamRoom).filter(
                (models.ExamRoom.id == room_id) | (models.ExamRoom.name == name)
            ).first()

            if existing:
                existing.building = bldg
                existing.floor = floor
                existing.capacity = capacity
                existing.rows = rows_val
                existing.cols = cols_val
                existing.bench_type = bench_type
                existing.is_active = is_active
            else:
                new_room = models.ExamRoom(
                    id=room_id,
                    name=name,
                    building=bldg,
                    floor=floor,
                    capacity=capacity,
                    rows=rows_val,
                    cols=cols_val,
                    bench_type=bench_type,
                    is_active=is_active
                )
                db.add(new_room)
                count += 1

        db.flush()
        return count

    @staticmethod
    def _parse_subjects_df(df: pd.DataFrame, db: Session) -> int:
        if df.empty:
            return 0

        h_idx = 0
        for r in range(min(5, len(df))):
            row_str = " ".join([str(x).lower() for x in df.iloc[r].dropna()])
            if "code" in row_str or "subject" in row_str:
                h_idx = r
                break

        headers = [str(x).strip() for x in df.iloc[h_idx].tolist()]
        code_col = None
        name_col = None
        grade_col = None
        color_col = None

        for c_idx, h in enumerate(headers):
            if match_column([h], {'code', 'subjectcode', 'subcode'}) and code_col is None:
                code_col = c_idx
            elif match_column([h], {'name', 'subjectname', 'title'}) and name_col is None:
                name_col = c_idx
            elif match_column([h], {'gradelevel', 'grade', 'class'}) and grade_col is None:
                grade_col = c_idx
            elif match_column([h], {'color', 'hexcolor', 'theme'}) and color_col is None:
                color_col = c_idx

        count = 0
        colors = ["#2563EB", "#16A34A", "#D97706", "#9333EA", "#DC2626", "#0D9488", "#4F46E5"]
        for r in range(h_idx + 1, len(df)):
            row = df.iloc[r]
            code = str(row[code_col]).strip().upper() if code_col is not None and pd.notna(row[code_col]) else ""
            if not code or code.lower() in ["nan", "total"]:
                continue

            name = str(row[name_col]).strip() if name_col is not None and pd.notna(row[name_col]) else code
            grade = str(row[grade_col]).strip() if grade_col is not None and pd.notna(row[grade_col]) else "Class XI"
            color = str(row[color_col]).strip() if color_col is not None and pd.notna(row[color_col]) else colors[count % len(colors)]

            sub_id = f"sub-{code.lower().replace('.', '').replace(' ', '-')}"
            existing = db.query(models.Subject).filter(
                (models.Subject.code == code) | (models.Subject.id == sub_id)
            ).first()

            if existing:
                existing.name = name
                existing.grade_level = grade
                existing.color = color
            else:
                new_sub = models.Subject(
                    id=sub_id,
                    code=code,
                    name=name,
                    grade_level=grade,
                    color=color
                )
                db.add(new_sub)
                count += 1

        db.flush()
        return count

    @staticmethod
    def _parse_sessions_df(df: pd.DataFrame, db: Session) -> int:
        if df.empty:
            return 0

        h_idx = 0
        for r in range(min(5, len(df))):
            row_str = " ".join([str(x).lower() for x in df.iloc[r].dropna()])
            if any(k in row_str for k in ["session", "date", "slot", "exam"]):
                h_idx = r
                break

        headers = [str(x).strip() for x in df.iloc[h_idx].tolist()]
        name_col = None
        date_col = None
        time_col = None
        subs_col = None

        for c_idx, h in enumerate(headers):
            if match_column([h], {'sessionname', 'name', 'examname', 'session'}) and name_col is None:
                name_col = c_idx
            elif match_column([h], {'date', 'examdate', 'sessiondate'}) and date_col is None:
                date_col = c_idx
            elif match_column([h], {'time', 'timeslot', 'slot', 'duration'}) and time_col is None:
                time_col = c_idx
            elif match_column([h], {'subjects', 'subjectcodes', 'papers'}) and subs_col is None:
                subs_col = c_idx

        all_subjects = {s.code.upper(): s for s in db.query(models.Subject).all()}
        count = 0

        for r in range(h_idx + 1, len(df)):
            row = df.iloc[r]
            name = str(row[name_col]).strip() if name_col is not None and pd.notna(row[name_col]) else ""
            if not name or name.lower() in ["nan", "total"]:
                continue

            date_val = str(row[date_col]).strip() if date_col is not None and pd.notna(row[date_col]) else datetime.date.today().isoformat()
            time_val = str(row[time_col]).strip() if time_col is not None and pd.notna(row[time_col]) else "09:00 AM - 12:00 PM"

            session_id = f"sess-{name.lower().replace(' ', '-')}"
            existing = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()

            session_subs = []
            if subs_col is not None and pd.notna(row[subs_col]):
                tokens = re.split(r'[,;|/\n]', str(row[subs_col]))
                for t in tokens:
                    c = t.strip().upper()
                    if c in all_subjects:
                        session_subs.append(all_subjects[c])
                    elif c in CANONICAL_SUBJECT_MAP:
                        canon_code = CANONICAL_SUBJECT_MAP[c][0]
                        if canon_code in all_subjects:
                            session_subs.append(all_subjects[canon_code])

            if existing:
                existing.name = name
                existing.date = date_val
                existing.time_slot = time_val
                if session_subs:
                    existing.subjects = session_subs
            else:
                new_session = models.ExamSession(
                    id=session_id,
                    name=name,
                    date=date_val,
                    time_slot=time_val,
                    subjects=session_subs
                )
                db.add(new_session)
                count += 1

        db.flush()
        return count

    @staticmethod
    def generate_sample_master_excel(output_path: Path):
        """Generates the master school Excel template matching the real Class XI Subject-wise layout."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 1. Section XI - A (Science: Math / Bio / CS)
        students_xia = [
            {"S.No.": "", "EXAM NO": "", "Name": "", "Group": "", "SUB 1": "", "SUB 2": "", "SUB 3": "", "SUB 4": "", "SUB 5": "", "SUB 6": ""}
        ]

        # 2. Section XI - B (Science / Tech / Entrepreneurship)
        students_xib = [
            {"S.No.": "", "EXAM NO": "", "Name": "", "Group": "", "SUB 1": "", "SUB 2": "", "SUB 3": "", "SUB 4": "", "SUB 5": "", "SUB 6": ""}
        ]

        # 3. Section XI - G (Commerce Stream: Business Studies / Economics / Accountancy)
        students_xig = [
            {"S.No.": "", "EXAM NO": "", "Name": "", "Group": "", "SUB 1": "", "SUB 2": "", "SUB 3": "", "SUB 4": "", "SUB 5": "", "SUB 6": ""}
        ]

        # 4. Rooms sheet
        rooms_data = [
            {"Room Name": "", "Building": "", "Floor": "", "Capacity": "", "Rows": "", "Columns": "", "Bench Type": "", "Active": ""}
        ]

        # 5. Sessions
        sessions_data = [
            {"Session Name": "", "Date": "", "Time Slot": "", "Subjects": ""}
        ]

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            # Write section sheets with Cell (0,0) as Class Section Title and Row 2 as headers
            for sec_name, st_list in [("XI - A", students_xia), ("XI - B", students_xib), ("XI - G", students_xig)]:
                df_sec = pd.DataFrame(st_list)
                # Add row 0 header title
                df_sec.to_excel(writer, sheet_name=sec_name, startrow=1, index=False)
                ws = writer.sheets[sec_name]
                ws.cell(row=1, column=1, value=sec_name)

            pd.DataFrame(rooms_data).to_excel(writer, sheet_name="Rooms", index=False)
            pd.DataFrame(sessions_data).to_excel(writer, sheet_name="Sessions", index=False)
