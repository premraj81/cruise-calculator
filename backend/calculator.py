from datetime import datetime, timedelta
from typing import List, Dict, Optional
from tides import TideRepository, TideEvent

class WindowCalculator:
    def __init__(self, repo: TideRepository):
        self.repo = repo

    def _round_time(self, dt: datetime, direction: str, interval_minutes: int = 15) -> datetime:
        # direction: 'up' or 'down'
        discard = timedelta(minutes=dt.minute % interval_minutes, 
                            seconds=dt.second, 
                            microseconds=dt.microsecond)
        dt -= discard
        if direction == 'up' and discard > timedelta(0):
            dt += timedelta(minutes=interval_minutes)
        return dt

    def calculate_windows(self, ship_type: str, movement: str, date: datetime.date) -> Dict:
        ship_type = ship_type.lower()
        movement = movement.lower()
        
        # Ovation + Departure = Any time
        if "ovation" in ship_type and "departure" in movement:
            return {
                "date": date.isoformat(),
                "windows": [],
                "message": "Ovation Class can depart any time."
            }

        daily_events = self.repo.get_events_for_date(date)
        if not daily_events:
             return {
                "date": date.isoformat(),
                "windows": [],
                "message": "No tide events found for this date."
            }

        windows = []

        # Arrival Rules
        # "Window Opens at Exactly HW... Closes 1 Hr before LW"
        if movement == "arrival":
            hw_events = [e for e in daily_events if e.type == "HW"]
            for i, hw in enumerate(hw_events):
                # Find Next LW
                future_events = self.repo.get_events_after(hw.dt)
                next_lw = None
                for e in future_events:
                    if e.type == "LW" and e.dt > hw.dt:
                        next_lw = e
                        break
                
                if next_lw:
                    raw_open = hw.dt
                    raw_close = next_lw.dt - timedelta(hours=1)
                    
                    # Rounding: Open UP, Close DOWN
                    open_time = self._round_time(raw_open, 'up')
                    close_time = self._round_time(raw_close, 'down')
                    
                    # Ensure valid window
                    if close_time > open_time:
                        windows.append({
                            "window_id": i + 1,
                            "open": open_time,
                            "close": close_time,
                            "basis": f"HW at {hw.dt.strftime('%H:%M')} -> LW at {next_lw.dt.strftime('%H:%M')}"
                        })

        # Princess + Departure
        # "Window Opens at LW + 30mins ... Closes 1 Hr after HW"
        elif "princess" in ship_type and "departure" in movement:
            lw_events = [e for e in daily_events if e.type == "LW"]
            for i, lw in enumerate(lw_events):
                # Find NEXT HW
                future_events = self.repo.get_events_after(lw.dt)
                next_hw = None
                for e in future_events:
                    if e.type == "HW" and e.dt > lw.dt:
                        next_hw = e
                        break
                
                if next_hw:
                    # Logic update: Open = LW + 30 mins
                    raw_open = lw.dt + timedelta(minutes=30)
                    raw_close = next_hw.dt + timedelta(hours=1)
                    
                    open_time = self._round_time(raw_open, 'up')
                    close_time = self._round_time(raw_close, 'down')

                    if close_time > open_time:
                         windows.append({
                            "window_id": i + 1,
                            "open": open_time,
                            "close": close_time,
                            "basis": f"LW at {lw.dt.strftime('%H:%M')} -> Next HW at {next_hw.dt.strftime('%H:%M')}"
                        })

        if not windows:
             return {
                "date": date.isoformat(),
                "windows": [],
                "message": "No applicable tide events / no window available for this date."
            }

        # Format daily tides for reference
        tides_list = [
            {
                "time": e.dt.strftime("%H:%M"),
                "height": e.height,
                "type": e.type
            }
            for e in daily_events
        ]

        return {
            "date": date.isoformat(),
            "windows": windows,
            "tides": tides_list,
            "message": None
        }
