from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from tides import TideRepository
from calculator import WindowCalculator
import os

app = FastAPI(title="Cruise Ship Window Calculator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine path to excel file (relative to this script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "port_chalmers_tides.xlsx")

if not os.path.exists(DATA_PATH):
    print(f"WARNING: Data file not found at {DATA_PATH}")

repo = TideRepository(DATA_PATH)
calculator = WindowCalculator(repo)

# Security: Get Password from Env or fallback
APP_PASSWORD = os.getenv("APP_PASSWORD", "CRUISE@ship25")

async def verify_token(x_auth_token: str = Header(..., alias="X-Auth-Token")):
    if x_auth_token != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_auth_token

@app.get("/api/tides", dependencies=[Depends(verify_token)])
def get_tides(date: str = Query(..., description="YYYY-MM-DD")):
    try:
        dt = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    events = repo.get_events_for_date(dt)
    return [
        {"dt": e.dt.isoformat(), "height": e.height, "type": e.type}
        for e in events
    ]

@app.get("/api/windows", dependencies=[Depends(verify_token)])
def get_windows(
    ship_type: str = Query(..., regex="^(princess|ovation)$", description="princess or ovation"),
    movement: str = Query(..., regex="^(arrival|departure)$", description="arrival or departure"),
    date: str = Query(..., description="YYYY-MM-DD")
):
    try:
        dt = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    result = calculator.calculate_windows(ship_type, movement, dt)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
