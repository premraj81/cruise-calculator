# Port Otago Applications - Deployment Guide

This repository contains the "Cruise Ship Window Calculator" and "Other Vessel Calculator" applications.
The stack is a **React Frontend** communicating with a **Python FastAPI Backend**.

## 1. Project Structure

- `frontend/`: React Application (source code).
- `backend/`: Python API (source code).
- `frontend/public/vessel_rules.json`: **Configuration file for Vessel Rules.**

## 2. Rule Updates (No Code Changes Required)

To update the operational rules (Wind limits, UKC, Tugs) for the "Other Vessel Calculator":

1.  Navigate to `frontend/public/vessel_rules.json`.
2.  Edit the values in the JSON file. Use a text editor (Notepad, VS Code).
3.  **If Running Locally**: Refresh the browser.
4.  **If on Production Server**:
    - Locate the `vessel_rules.json` file in the web server's root folder (e.g., `/var/www/html/vessel_rules.json`).
    - Edit it directly.
    - Changes take effect immediately upon page refresh (no rebuild needed).

## 3. Deployment Instructions (For IT)

### A. Backend (Python API)

The backend runs on Python and provides tide data and calculation endpoints.

1.  **Install Python 3.10+**.
2.  Navigate to `backend/`.
3.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # Linux/Mac
    .\venv\Scripts\activate   # Windows
    ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Run the Server (Using Uvicorn):
    ```bash
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```
    *Note: For production, run this as a service (Systemd) or use Gunicorn.*

### B. Frontend (React)

The frontend must be built int static HTML/JS files.

1.  **Install Node.js (LTS)**.
2.  Navigate to `frontend/`.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Build the project:
    ```bash
    npm run build
    ```
    This creates a `dist/` folder containing the production files.
5.  **Serve the `dist/` folder**:
    - Copy the contents of `dist/` to your web server (Nginx, Apache, IIS).
    - Ensure `index.html` is served for the root path.

### C. Server Configuration (Nginx Example)

The web server should serve the Frontend files and proxy API requests to the Backend.

```nginx
server {
    listen 80;
    server_name port-calculations.local;

    # Frontend
    location / {
        root /var/www/cruise-app/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
         # Assuming backend runs on port 8000
         proxy_pass http://127.0.0.1:8000;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Vessel Rules (Ensure JSON is accessible)
    location /vessel_rules.json {
        root /var/www/cruise-app/dist;
    }
}
```

## 4. Updates & Maintenance

- **Code Updates**: Pull new code, run `npm run build` in frontend, and restart backend service if python files changed.
- **Rule Updates**: Just edit `vessel_rules.json` on the server.
