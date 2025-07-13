import json
import os

DRIVERS_FILE = 'drivers.json'

def init_drivers():
    # Convert existing drivers if the file exists
    existing_drivers = []
    if os.path.exists(DRIVERS_FILE):
        try:
            with open(DRIVERS_FILE, 'r') as f:
                existing_drivers = json.load(f)
        except:
            print("Could not read existing drivers file")

    # Create new structure
    drivers_data = {
        "company_drivers": {
            "EightNode": existing_drivers if isinstance(existing_drivers, list) else [
                {
                    "name": "Jess",
                    "phone": "1",
                    "notes": ""
                },
                {
                    "name": "Keiaan",
                    "phone": "1",
                    "notes": ""
                }
            ]
        }
    }
    
    # Save the new structure
    with open(DRIVERS_FILE, 'w') as f:
        json.dump(drivers_data, f, indent=4)
    print("Created drivers.json with company-specific structure")

if __name__ == "__main__":
    init_drivers()