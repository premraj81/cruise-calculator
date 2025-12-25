import pandas as pd
import json

file_path = r'd:\Antigravity\cruise-ship-app\frontend\public\dunedin_sunrise_sunset_2026_2028.xlsx'
output_path = r'd:\Antigravity\cruise-ship-app\frontend\public\sunrise_sunset_dn.json'

try:
    # Read ignoring the first title row, so row 2 (index 1) becomes header
    df = pd.read_excel(file_path, header=1)
    
    # Rename columns explicitly to handle variations
    df.columns = ['date_obj', 'sunrise_obj', 'sunset_obj']
    
    data_list = []
    
    for index, row in df.iterrows():
        try:
            d = row['date_obj']
            r = row['sunrise_obj']
            s = row['sunset_obj']
            
            # Ensure proper datetime types
            d = pd.to_datetime(d)
            r = pd.to_datetime(r)
            s = pd.to_datetime(s)
            
            entry = {
                "date": d.strftime('%Y-%m-%d'),
                "sunrise": r.strftime('%H:%M'),
                "sunset": s.strftime('%H:%M')
            }
            data_list.append(entry)
        except Exception as e:
            print(f"Skipping row {index}: {e}")
            continue
            
    with open(output_path, 'w') as f:
        json.dump(data_list, f, indent=2)
        
    print(f"Successfully created {output_path} with {len(data_list)} entries.")

except Exception as e:
    print(f"Failed to process: {e}")
