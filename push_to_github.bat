@echo off
echo ========================================================
echo        Pushing Updates to GitHub
echo ========================================================
echo.
echo 1. Committing Changes (Logout & Timer)...
git add .
git commit -m "Add Logout Button and 10-min Inactivity Timer"
echo.
echo 2. Pushing to GitHub...
echo.
git push -u origin main
echo.
if %errorlevel% neq 0 (
    echo [ERROR] Push failed.
) else (
    echo [SUCCESS] Updates pushed!
    echo Render will rebuild automatically.
)
echo.
pause
