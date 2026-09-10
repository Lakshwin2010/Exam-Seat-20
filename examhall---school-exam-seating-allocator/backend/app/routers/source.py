from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pathlib import Path
import shutil

from app.database import get_db
from app.excel_service import ExcelService
from app.config import get_primary_source_dir
from app import schemas

router = APIRouter(prefix="/api/source", tags=["source"])

@router.get("/files", response_model=List[schemas.SourceFileSummary])
def get_source_files():
    """Scans and lists all Excel (.xlsx, .xls) and .csv files found in the source directory."""
    return ExcelService.scan_source_files()

@router.post("/sync")
def sync_source_folder(db: Session = Depends(get_db)):
    """Reads all Excel and CSV files from the source folder and synchronizes records into SQLite."""
    result = ExcelService.sync_source_folder(db)
    return {
        "status": "success",
        "message": f"Source folder synchronized successfully. {result['files_processed']} file(s) processed.",
        "imported": result
    }

@router.post("/upload")
async def upload_excel_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload an Excel or CSV file directly to the source folder and auto-ingest it."""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files are supported.")

    primary_dir = get_primary_source_dir()
    destination = primary_dir / file.filename

    with open(destination, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Immediately ingest
    counts = ExcelService.import_file_to_db(destination, db)

    return {
        "status": "success",
        "fileName": file.filename,
        "savedTo": str(destination),
        "imported": counts
    }

@router.get("/template")
def download_master_template():
    """Download/Generate the master Excel template with sample Students, Rooms, Subjects, and Sessions."""
    primary_dir = get_primary_source_dir()
    template_path = primary_dir / "exam_master_template.xlsx"
    if not template_path.exists():
        ExcelService.generate_sample_master_excel(template_path)

    return FileResponse(
        path=str(template_path),
        filename="exam_master_template.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
