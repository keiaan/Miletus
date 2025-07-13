import json
import os

ROUTE_SETTINGS_FILE = 'route_settings.json'

def init_route_settings():
    settings = {
        "company_settings": {
            "EightNode": {
                "max_miles": 9000.0,
                "max_time": 1.0,
                "max_stops": 4,
                "drop_penalty": 1000
            }
        },
        "default_settings": {
            "max_miles": 100,
            "max_time": 8,
            "max_stops": 20,
            "drop_penalty": 1000
        }
    }
    
    with open(ROUTE_SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=4)
    print("Created route_settings.json with default settings")

if __name__ == "__main__":
    init_route_settings()