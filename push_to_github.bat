@echo off
echo ========================================================
echo        Pushing Security Updates to GitHub
echo ========================================================
echo.
echo 1. Committing Security Changes...
git add .
git commit -m "Implement Security: API Key Authentication"
echo.
echo 2. Pushing to GitHub...
echo.
git push -u origin main
echo.
if %errorlevel% neq 0 (
    echo [ERROR] Push failed.
) else (
    echo [SUCCESS] Security updates pushed!
    echo Render will rebuild automatically.
)
echo.
pause
