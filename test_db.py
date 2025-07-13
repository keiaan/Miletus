import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    print("Database connection successful!")
    cur = conn.cursor()
    cur.execute('SELECT version();')
    version = cur.fetchone()
    print(f"PostgreSQL version: {version[0]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error connecting to database: {e}")
