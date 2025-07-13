import json
import os
from werkzeug.security import generate_password_hash

USERS_FILE = 'users.json'

def init_users():
    if not os.path.exists(USERS_FILE):
        default_users = {
            "users": [
                {
                    "username": "admin",
                    "password_hash": generate_password_hash("admin123"),  # Change this password!
                    "company_name": "EightNode",
                    "company_depot": "Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK",
                    "privilege": "global_admin"
                }
            ]
        }
        
        with open(USERS_FILE, 'w') as f:
            json.dump(default_users, f, indent=2)
        print("Created users.json with default admin user")
        print("Default credentials:")
        print("Username: admin")
        print("Password: admin123")
        print("IMPORTANT: Change these credentials immediately after first login!")
    else:
        print("users.json already exists. Skipping initialization.")

if __name__ == "__main__":
    init_users()