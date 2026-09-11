import json
import base64
import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.config import DATA_DIR
from app import models

router = APIRouter(prefix="/api/email", tags=["email"])

RECIPIENTS_FILE = DATA_DIR / "email_recipients.json"

DEFAULT_RECIPIENTS = {
    "XI - A": {"email": "erd_s1401728@csacademy.in", "teacherName": "Class Teacher (XI-A)"},
    "XI - B": {"email": "erd_s1803155@csacademy.in", "teacherName": "Class Teacher (XI-B)"},
    "XI - C": {"email": "", "teacherName": "Class Teacher (XI-C)"},
    "XI - D": {"email": "", "teacherName": "Class Teacher (XI-D)"},
    "XI - E": {"email": "", "teacherName": "Class Teacher (XI-E)"},
    "XI - F": {"email": "", "teacherName": "Class Teacher (XI-F)"},
    "XI - G": {"email": "", "teacherName": "Class Teacher (XI-G)"},
    "XI - H": {"email": "", "teacherName": "Class Teacher (XI-H)"},
}

def load_recipients() -> Dict[str, Dict[str, str]]:
    if not RECIPIENTS_FILE.exists():
        save_recipients(DEFAULT_RECIPIENTS)
        return DEFAULT_RECIPIENTS
    try:
        with open(RECIPIENTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure defaults exist
            for k, v in DEFAULT_RECIPIENTS.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception:
        return DEFAULT_RECIPIENTS

def save_recipients(data: Dict[str, Dict[str, str]]):
    with open(RECIPIENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

@router.get("/recipients")
def get_email_recipients(db: Session = Depends(get_db)):
    """Returns the list of all 8 XI sections with student count and configured recipient email."""
    recipients_map = load_recipients()
    
    # Query student counts grouped by grade
    all_sections = ["XI - A", "XI - B", "XI - C", "XI - D", "XI - E", "XI - F", "XI - G", "XI - H"]
    result = []
    
    for sec in all_sections:
        student_count = db.query(models.Student).filter(models.Student.grade == sec).count()
        cfg = recipients_map.get(sec, {"email": "", "teacherName": f"Class Teacher ({sec})"})
        result.append({
            "section": sec,
            "studentCount": student_count,
            "email": cfg.get("email", ""),
            "teacherName": cfg.get("teacherName", f"Class Teacher ({sec})"),
            "isConfigured": bool(cfg.get("email", "").strip())
        })
        
    return {
        "status": "success",
        "totalSections": len(result),
        "sections": result
    }

@router.post("/recipients")
def update_email_recipients(payload: Dict[str, Any]):
    """Updates recipient emails for one or more sections."""
    current = load_recipients()
    updates = payload.get("recipients", {})
    for sec, info in updates.items():
        if isinstance(info, str):
            if sec not in current:
                current[sec] = {"teacherName": f"Class Teacher ({sec})", "email": ""}
            current[sec]["email"] = info.strip()
        elif isinstance(info, dict):
            current[sec] = {
                "email": info.get("email", "").strip(),
                "teacherName": info.get("teacherName", f"Class Teacher ({sec})")
            }
    save_recipients(current)
    return {"status": "success", "recipients": current}

def generate_class_excel(grade_class: str, db: Session) -> tuple:
    # Normalize grade class string (e.g. 'XI-A' -> 'XI - A')
    norm = grade_class.strip()
    if "-" in norm and " - " not in norm:
        parts = norm.split("-")
        norm = f"{parts[0].strip()} - {parts[1].strip()}"
        
    students = (
        db.query(models.Student)
        .filter(models.Student.grade == norm)
        .order_by(models.Student.roll_no.asc())
        .all()
    )
    
    if not students:
        # Try fallback matching
        students = (
            db.query(models.Student)
            .filter(models.Student.grade.ilike(f"%{grade_class.strip()}%"))
            .order_by(models.Student.roll_no.asc())
            .all()
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Class {grade_class.replace(' ', '')}"
    ws.views.sheetView[0].showGridLines = True

    # Styles
    title_font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    alt_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    regular_font = Font(name="Calibri", size=10)
    bold_font = Font(name="Calibri", size=10, bold=True)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    # Title Banner
    ws.merge_cells("A1:F1")
    ws["A1"] = f"CS ACADEMY - STUDENT & EXAM DETAILS"
    ws["A1"].font = title_font
    ws["A1"].alignment = center_align

    ws.merge_cells("A2:F2")
    ws["A2"] = f"Class: {norm}  |  Total Enrolled: {len(students)} Students  |  Exported: {datetime.datetime.now().strftime('%d-%b-%Y %I:%M %p')}"
    ws["A2"].font = subtitle_font
    ws["A2"].alignment = center_align

    ws.row_dimensions[1].height = 24
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[4].height = 24

    # Table Headers
    headers = ["S.No.", "Exam / Roll No", "Student Name", "Gender", "Enrolled Subjects", "Seating Desk / Room"]
    for col_num, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_num, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

    # Populate Students
    for row_idx, st in enumerate(students, 1):
        current_row = 4 + row_idx
        ws.row_dimensions[current_row].height = 20
        
        subjects_str = ", ".join([s.code for s in st.enrolled_subjects]) if st.enrolled_subjects else "-"
        
        seating_str = "Not Allocated"
        if st.allocations:
            alloc = st.allocations[0]
            room_name = alloc.room.name if alloc.room else "Room"
            seating_str = f"Seat {alloc.seat_label} ({room_name})"

        row_data = [
            row_idx,
            st.roll_no,
            st.name,
            st.gender or "M",
            subjects_str,
            seating_str
        ]

        is_alt = (row_idx % 2 == 0)
        for col_num, val in enumerate(row_data, 1):
            cell = ws.cell(row=current_row, column=col_num, value=val)
            cell.font = bold_font if col_num in (2, 3) else regular_font
            cell.border = thin_border
            if is_alt:
                cell.fill = alt_fill
            cell.alignment = center_align if col_num in (1, 2, 4, 6) else left_align

    # Adjust Column Widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.row > 2 and cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    filename = f"Class_{norm.replace(' ', '')}_Details.xlsx"
    return wb, filename, len(students)

@router.get("/class-sheet/{grade_class}")
def get_class_sheet(
    grade_class: str,
    download: bool = Query(False, description="If true, returns binary excel file download"),
    db: Session = Depends(get_db)
):
    """Generates and returns the clean Excel workbook for a class section (as base64 or direct file download)."""
    wb, filename, student_count = generate_class_excel(grade_class, db)
    
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    xlsx_bytes = bio.getvalue()

    if download:
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # Return base64 for direct browser Gmail API dispatch
    base64_data = base64.b64encode(xlsx_bytes).decode("utf-8")
    return {
        "status": "success",
        "section": grade_class,
        "filename": filename,
        "studentCount": student_count,
        "base64": base64_data,
        "sizeBytes": len(xlsx_bytes)
    }
