import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from app.config import CORS_ORIGINS, get_primary_source_dir
from app.database import init_db, SessionLocal
from app.excel_service import ExcelService
from app.routers import (
    source,
    students,
    monitoring,
    rooms,
    subjects,
    sessions,
    allocations
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    
    # Auto-seed from source folder if DB is empty
    db = SessionLocal()
    try:
        from app import models
        student_count = db.query(models.Student).count()
        if student_count == 0:
            print("Database is empty. Synchronizing Excel sheets from source folder...")
            ExcelService.sync_source_folder(db)
    except Exception as e:
        print(f"Initial sync warning: {e}")
    finally:
        db.close()
        
    yield
    # Shutdown logic if any

app = FastAPI(
    title="ExamHall - Seating Allocator & Student Monitoring System",
    description="Full-stack unified application for school/college exam room seating allocation, student monitoring, and automatic Excel source ingestion.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include All Backend API Routers
app.include_router(source.router)
app.include_router(students.router)
app.include_router(monitoring.router)
app.include_router(rooms.router)
app.include_router(subjects.router)
app.include_router(sessions.router)
app.include_router(allocations.router)

@app.get("/api")
def api_root():
    return {
        "service": "ExamHall Seating & Student Monitoring API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "sourceDirectory": str(get_primary_source_dir())
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "connected"}

# Frontend Integration: Mount built static assets and serve SPA
frontend_dist = Path(__file__).resolve().parent.parent.parent / "dist"
if not frontend_dist.exists():
    frontend_dist = Path(__file__).resolve().parent.parent / "dist"

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_spa_root():
        return FileResponse(frontend_dist / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        # Prevent intercepting API routes or Swagger docs
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json"]:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        target = frontend_dist / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def root_fallback():
        return {
            "service": "ExamHall Backend API",
            "status": "online",
            "frontend": "Build frontend with 'bun run build' to serve from root URL",
            "docs": "/docs"
        }
