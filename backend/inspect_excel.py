import pandas as pd
import os

file_path = r'd:\Antigravity\cruise-ship-app\frontend\public\dunedin_sunrise_sunset_2026_2028.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("First few rows:")
    print(df.head())
except Exception as e:
    print(f"Error reading excel: {e}")
