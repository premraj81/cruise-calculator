# Deployment Guide: Port Otago Cruise Calculator

This guide explains how to deploy your application for free so your friends can use it. We will use **Render** for the backend (Python/API) and **Vercel** for the frontend (React/Website).

## Prerequisites
1.  **GitHub Account**: You need to upload your code to GitHub.
2.  **Render Account**: Create a free account at [render.com](https://render.com).
3.  **Vercel Account**: Create a free account at [vercel.com](https://vercel.com).

---

## Part 1: Prepare Your Code (Already Done by Me)
I have already prepared your code for deployment:
1.  **Backend**: Moved the Excel file into the `backend` folder and updated the code to read it from there. Created `requirements.txt`.
2.  **Frontend**: Updated the code to look for the API URL from a setting (Environment Variable).

---

## Part 2: Upload to GitHub
1.  Create a new Repository on GitHub (e.g., `cruise-calculator`).
2.  Push your code (`d:\Antigravity\cruise-ship-app`) to this repository.
    *   *If you are not sure how to use Git, let me know and I can help you initialize it.*

---

## Part 3: Deploy Backend (Render)
1.  Log in to **RenderDashboard**.
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings**:
    *   **Name**: `cruise-backend` (or similar)
    *   **Root Directory**: `backend` (Important! This tells Render the app is in the backend folder).
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5.  Click **Create Web Service**.
6.  Wait for it to deploy. Once done, copy the URL (e.g., `https://cruise-backend.onrender.com`).
    *   *Note: Free tier spins down after inactivity, so the first request might take 50 seconds.*

---

## Part 4: Deploy Frontend (Vercel)
1.  Log in to **Vercel Dashboard**.
2.  Click **Add New...** -> **Project**.
3.  Import the same GitHub repository.
4.  **Configure Project**:
    *   **Framework Preset**: Vite
    *   **Root Directory**: Click Edit and select `frontend`.
5.  **Environment Variables**:
    *   Click to expand **Environment Variables**.
    *   **Key**: `VITE_API_URL`
    *   **Value**: The URL you copied from Render + `/api` (e.g., `https://cruise-backend.onrender.com/api`).
    *   *Make sure to include `/api` at the end!*
6.  Click **Deploy**.

---

## Part 5: Share!
Vercel will give you a domain (e.g., `cruise-calculator.vercel.app`). Send this link to your friends!
