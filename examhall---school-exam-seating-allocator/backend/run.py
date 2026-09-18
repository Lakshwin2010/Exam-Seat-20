import os
import uvicorn
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", 8001))
    print(f"Starting ExamHall Seating Allocator & Student Monitoring Backend on port {port}...")
    print(f"API Documentation available at: http://localhost:{port}/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
