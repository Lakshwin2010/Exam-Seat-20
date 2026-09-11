@echo off
title Push ExamHall to GitHub
echo ========================================================
echo   Pushing ExamHall to:
echo   https://github.com/Lakshwin2010/Exam-Seat-20
echo ========================================================
echo.
cd /d "%~dp0"
git push -u origin main
echo.
echo ========================================================
if %ERRORLEVEL% equ 0 (
    echo   [SUCCESS] Code successfully pushed to GitHub!
) else (
    echo   [FAILED] Push failed. Please check error message above.
)
echo ========================================================
echo.
pause
