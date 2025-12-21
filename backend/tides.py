import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from dataclasses import dataclass

@dataclass
class TideEvent:
    dt: datetime
    height: float
    type: str  # "HW" or "LW"

class TideRepository:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.events: List[TideEvent] = []
        self._load_data()

    def _load_data(self):
        try:
            df = pd.read_excel(self.file_path, sheet_name="Sheet1")
        except FileNotFoundError:
            print(f"Error: File not found at {self.file_path}")
            return
        except Exception as e:
            print(f"Error reading Excel: {e}")
            return

        raw_events = []
        
        # Iterate over rows
        for _, row in df.iterrows():
            date_val = row['Date']
            if isinstance(date_val, str):
                try:
                    date_val = datetime.strptime(date_val, "%Y-%m-%d").date()
                except ValueError:
                    continue
            elif hasattr(date_val, 'date'):
                date_val = date_val.date()
                
            for i in range(1, 5):
                time_col = f"Time {i}"
                height_col = f"Height {i}"
                
                if time_col not in df.columns or height_col not in df.columns:
                    continue
                    
                t_val = row[time_col]
                h_val = row[height_col]
                
                if pd.isna(t_val) or pd.isna(h_val):
                    continue
                
                if isinstance(t_val, str):
                    try:
                        t_obj = datetime.strptime(t_val, "%H:%M").time()
                    except ValueError:
                        continue
                elif hasattr(t_val, 'hour'):
                     t_obj = t_val if isinstance(t_val, type(datetime.now().time())) else t_val.time()
                else:
                    continue

                full_dt = datetime.combine(date_val, t_obj)
                raw_events.append({'dt': full_dt, 'height': float(h_val)})

        raw_events.sort(key=lambda x: x['dt'])
        self.events = self._classify_tides(raw_events)
        print(f"Loaded {len(self.events)} tide events.")

    def _classify_tides(self, raw_events: List[Dict]) -> List[TideEvent]:
        classified = []
        n = len(raw_events)
        if n == 0:
            return []

        for i in range(n):
            curr = raw_events[i]
            prev = raw_events[i-1] if i > 0 else None
            next = raw_events[i+1] if i < n-1 else None
            
            h_curr = curr['height']
            h_prev = prev['height'] if prev else h_curr
            h_next = next['height'] if next else h_curr
            
            t_type = "Unclassified"
            
            is_peak = True
            is_trough = True
            
            if prev and h_curr < h_prev: is_peak = False
            if next and h_curr < h_next: is_peak = False
            
            if prev and h_curr > h_prev: is_trough = False
            if next and h_curr > h_next: is_trough = False
            
            if is_peak:
                t_type = "HW"
            elif is_trough:
                t_type = "LW"
            
            classified.append(TideEvent(dt=curr['dt'], height=h_curr, type=t_type))
            
        return classified

    def get_events_for_date(self, target_date: datetime.date) -> List[TideEvent]:
        return [e for e in self.events if e.dt.date() == target_date]
    
    def get_events_after(self, start_dt: datetime) -> List[TideEvent]:
        return [e for e in self.events if e.dt >= start_dt]
