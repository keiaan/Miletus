#!/usr/bin/env python3
"""
Startup script to run the Flask application on localhost
"""
import os
import sys

# Add the current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from app import app

if __name__ == '__main__':
    print("Starting Flask application on localhost:5001")
    print("Access the application at: http://localhost:5001")
    print("Press CTRL+C to quit")
    
    # Run the application on localhost
    app.run(
        debug=True,
        host='localhost',
        port=5001,
        threaded=True
    )
