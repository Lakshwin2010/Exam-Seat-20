@echo off
title ExamHall - Unified Server (Port 8000)
echo ========================================================
echo   ExamHall - Unified Frontend + Backend Application
echo   Port: http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Source Folder: E:\Ye not me\Antigravity\source
echo ========================================================
cd /d "%~dp0backend"
python run.py
pause
