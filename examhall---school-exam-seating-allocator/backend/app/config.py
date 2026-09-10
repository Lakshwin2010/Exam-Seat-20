import os
from pathlib import Path
from typing import List

# Backend base directory
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Data directory for SQLite DB
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'exam_hall.db'}")

# Workspace root: e:/Ye not me/Antigravity
WORKSPACE_DIR = BACKEND_DIR.parent.parent

# Candidate source directories in priority order:
SOURCE_DIRS: List[Path] = [
    WORKSPACE_DIR / "source",
    BACKEND_DIR.parent / "source",
    BACKEND_DIR / "source"
]

def get_primary_source_dir() -> Path:
    """Returns the primary source folder where Excel sheets should be placed, creating it if needed."""
    primary = SOURCE_DIRS[0]
    primary.mkdir(parents=True, exist_ok=True)
    return primary

def get_all_source_dirs() -> List[Path]:
    """Returns all source directories that exist."""
    dirs = []
    for d in SOURCE_DIRS:
        if d.exists() and d.is_dir():
            dirs.append(d)
    if not dirs:
        p = get_primary_source_dir()
        dirs.append(p)
    return dirs

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "*"
]
