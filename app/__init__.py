# At the top of app/__init__.py, update import paths:
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
import numpy as np
import pandas as pd
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import requests
import folium
import polyline
from twilio.rest import Client
import urllib.parse
import json
import os
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
import time
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.orm import Session
try:
    from app.models.base import SessionLocal
    from app.models.models import Route, RouteJob, Job, Location, Driver as DBDriver
except ImportError:
    # Fallback for when running directly
    SessionLocal = None
    Route = RouteJob = Job = Location = None
from datetime import datetime, timedelta
from io import StringIO
from collections import OrderedDict
import uuid

app = Flask(__name__)
app.secret_key = '5e446e2e3f70c3c3e1c1f1e0d2b8a6b9c7d4e1f2a3b4c5d6e7f8a9b0c1d2e3f'  # Change this in production

# Enable CORS for Next.js frontend
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3001')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Configuration
GOOGLE_MAPS_API_KEY = 'AIzaSyCHBzKvpPE6lyMrBLf4EZtmWUu1wLaolgM'
TWILIO_ACCOUNT_SID = 'AC6c80189ca1c3c34bd6f644427d1d3a15'
TWILIO_AUTH_TOKEN = 'c4577b09678329861f60511e4d1ea5aa'
TWILIO_PHONE_NUMBER = '+447830366494'


# Initialize Twilio client
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# File paths
DRIVERS_FILE = 'drivers.json'
ROUTE_SETTINGS_FILE = 'route_settings.json'
SETTINGS_FILE = 'settings.json'
USERS_FILE = 'users.json'
ROUTE_HISTORY_FILE = 'route_history.json'

# Decorators for authentication and authorization
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session or session['privilege'] not in ['admin', 'global_admin']:
            flash('Admin privileges required')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def global_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session or session['privilege'] != 'global_admin':
            flash('Global admin privileges required')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def save_route_to_db(route_data, company_id):
    """Save route results to database"""
    if SessionLocal is None:
        print("Database not available, skipping database save")
        return True
    try:
        with SessionLocal() as db:
            # Create locations for each address if they don't exist
            for route in route_data['results']:
                route_record = Route(
                    company_id=company_id,
                    driver_name=route['driver'],
                    total_distance=float(route['total_distance'].replace(' miles', '')),
                    total_time=route['total_time'],
                    date=route_data.get('schedule_date', datetime.now()),
                    status='completed'
                )
                db.add(route_record)
                db.flush()

                # Add each stop as a RouteJob
                for i, address in enumerate(route['route']):
                    # Skip depot addresses (first and last)
                    if i == 0 or i == len(route['route']) - 1:
                        continue

                    # Create or get location
                    location = db.query(Location).filter_by(
                        address_line1=address,
                        company_id=company_id
                    ).first()

                    if not location:
                        location = Location(
                            address_line1=address,
                            company_id=company_id
                        )
                        db.add(location)
                        db.flush()

                    # Create job record
                    job = Job(
                        reference=f"ROUTE-{route_record.id}-STOP-{i}",
                        location_id=location.id,
                        company_id=company_id,
                        schedule_date=route_data.get('schedule_date', datetime.now())
                    )
                    db.add(job)
                    db.flush()

                    # Create route job record
                    route_job = RouteJob(
                        route_id=route_record.id,
                        job_id=job.id,
                        sequence=i
                    )
                    db.add(route_job)

            db.commit()
    except Exception as e:
        print(f"Error saving route to database: {str(e)}")

    # Save individual routes for driver tracking (always do this regardless of database)
    try:
        routes_db = {}
        if os.path.exists('routes.json'):
            with open('routes.json', 'r') as f:
                routes_db = json.load(f)

        route_ids = []
        # Create individual route entries for each driver
        for i, result in enumerate(route_data.get('results', [])):
            route_id = str(uuid.uuid4())[:8]  # Short route ID
            route_ids.append(route_id)

            route_entry = {
                'route_id': route_id,
                'driver_name': result['driver'],
                'route': result['route'],
                'total_time': result['total_time'],
                'total_distance': result['total_distance'],
                'num_stops': result['num_stops'],
                'google_maps': result.get('google_maps', ''),
                'apple_maps': result.get('apple_maps', ''),
                'created_at': datetime.now().isoformat(),
                'company_id': company_id,
                'stop_counts': result.get('stop_counts', {})
            }

            routes_db[route_id] = route_entry

        # Save routes database
        with open('routes.json', 'w') as f:
            json.dump(routes_db, f, indent=2)

        return route_ids
    except Exception as e:
        print(f"Error saving routes for driver tracking: {str(e)}")
        return []

# Load users from JSON file
def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)['users']
    return []

# Save users to JSON file
def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump({'users': users}, f, indent=2)

# Load drivers from JSON file
def load_drivers(company_name=None):
    if os.path.exists(DRIVERS_FILE):
        with open(DRIVERS_FILE, 'r') as f:
            data = json.load(f)
            if company_name:
                drivers = data.get('company_drivers', {}).get(company_name, [])
                # Only return drivers available for scheduling
                return [d for d in drivers if d.get('available_for_schedule', True)]
            return data
    return {'company_drivers': {}} if company_name is None else []

# Load all drivers including unavailable ones for management
def load_all_drivers(company_name=None):
    if os.path.exists(DRIVERS_FILE):
        with open(DRIVERS_FILE, 'r') as f:
            data = json.load(f)
            if company_name:
                return data.get('company_drivers', {}).get(company_name, [])
            return data
    return {'company_drivers': {}} if company_name is None else []

# Save drivers to JSON file
def save_drivers(drivers, company_name):
    all_drivers = load_drivers()
    if 'company_drivers' not in all_drivers:
        all_drivers['company_drivers'] = {}
    all_drivers['company_drivers'][company_name] = drivers
    with open(DRIVERS_FILE, 'w') as f:
        json.dump(all_drivers, f, indent=2)

# Load route settings from JSON file
def load_route_settings(company_name=None):
    if os.path.exists(ROUTE_SETTINGS_FILE):
        with open(ROUTE_SETTINGS_FILE, 'r') as f:
            settings = json.load(f)
            if company_name:
                return settings['company_settings'].get(company_name, settings['default_settings'])
            return settings
    default_settings = {
        'max_miles': 100,
        'max_time': 8,
        'max_stops': 20,
        'drop_penalty': 1000
    }
    return default_settings

# Save route settings to JSON file
def save_route_settings_to_file(settings, company_name):
    if os.path.exists(ROUTE_SETTINGS_FILE):
        with open(ROUTE_SETTINGS_FILE, 'r') as f:
            all_settings = json.load(f)
    else:
        all_settings = {
            'company_settings': {},
            'default_settings': {
                'max_miles': 100,
                'max_time': 8,
                'max_stops': 20,
                'drop_penalty': 1000
            }
        }

    if 'company_settings' not in all_settings:
        all_settings['company_settings'] = {}
    all_settings['company_settings'][company_name] = settings

    with open(ROUTE_SETTINGS_FILE, 'w') as f:
        json.dump(all_settings, f, indent=2)

# Load general settings from JSON file
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {'google_maps_api_key': GOOGLE_MAPS_API_KEY}

# Save general settings to JSON file
def save_settings(settings):
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)

# Get list of all companies
def get_all_companies():
    users = load_users()
    companies = set()
    for user in users:
        companies.add(user['company_name'])
    return sorted(list(companies))

# Route audit functionality
def load_route_history(company_name=None):
    """Load route history from JSON file with company isolation"""
    if os.path.exists(ROUTE_HISTORY_FILE):
        with open(ROUTE_HISTORY_FILE, 'r') as f:
            data = json.load(f)
            if company_name:
                return data.get('route_history', {}).get(company_name, [])
            return data
    return {'route_history': {}} if company_name is None else []

def save_route_history(route_data, company_name):
    """Save route history to JSON file with company isolation"""
    all_history = load_route_history()
    if 'route_history' not in all_history:
        all_history['route_history'] = {}
    if company_name not in all_history['route_history']:
        all_history['route_history'][company_name] = []

    # Add timestamp and unique ID to route data
    route_entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.now().isoformat(),
        'company': company_name,
        'data': route_data
    }

    all_history['route_history'][company_name].append(route_entry)

    with open(ROUTE_HISTORY_FILE, 'w') as f:
        json.dump(all_history, f, indent=2)

# Authentication routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user' in session:
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        users = load_users()
        user = next((u for u in users if u['username'] == username), None)

        if user and check_password_hash(user['password_hash'], password):
            session['user'] = username
            session['company'] = user['company_name']
            session['company_depot'] = user['company_depot']
            session['privilege'] = user['privilege']

            # Generate company_id if not present (for backward compatibility)
            company_id = user.get('company_id')
            if not company_id:
                # Generate a simple hash-based ID from company name
                import hashlib
                company_id = hashlib.md5(user['company_name'].encode()).hexdigest()[:8]
                print(f"Generated company_id {company_id} for company {user['company_name']}")

            session['company_id'] = company_id
            return redirect(url_for('index'))

        return render_template('login.html', error='Invalid username or password')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/session')
@login_required
def get_session():
    """API endpoint to get current user session information"""
    return jsonify({
        'user': session.get('user'),
        'company': session.get('company'),
        'company_depot': session.get('company_depot'),
        'privilege': session.get('privilege'),
        'company_id': session.get('company_id')
    })

@app.route('/api/drivers')
@login_required
@admin_required
def get_drivers_api():
    """API endpoint to get drivers for the current user's company"""
    company_name = session.get('company')
    drivers = load_all_drivers(company_name)
    return jsonify({
        'drivers': drivers,
        'company': company_name
    })

@app.route('/api/dashboard')
@login_required
def get_dashboard_api():
    """API endpoint to get dashboard data for the current user's company"""
    company_name = session.get('company')
    privilege = session.get('privilege')
    company_id = session.get('company_id')
    
    # Load active routes
    try:
        with open('routes.json', 'r') as f:
            routes_data = json.load(f)
    except FileNotFoundError:
        routes_data = {}
    
    # Extract routes - they are stored as individual route objects at root level
    active_routes = []
    
    for key, route in routes_data.items():
        if key == "company_routes":
            continue  # Skip the company_routes structure if it exists
        
        if isinstance(route, dict) and 'route_id' in route:
            # Filter by company_id or show all for global admin
            if privilege == 'global_admin':
                active_routes.append(route)
            elif route.get('company_id') == company_id:
                active_routes.append(route)
    
    # Transform routes data for frontend
    dashboard_routes = []
    for route in active_routes:
        # Extract driver name (remove phone number in parentheses)
        driver_name = route.get('driver_name', '')
        if '(' in driver_name:
            driver_name = driver_name.split('(')[0].strip()
        
        dashboard_routes.append({
            'route_id': route.get('route_id', ''),
            'driver': driver_name,
            'status': route.get('status', 'active'),
            'total_stops': route.get('num_stops', 0),
            'completed_stops': 0,  # Will need to check delivery status separately
            'start_time': route.get('created_at', ''),
            'estimated_completion': '',
            'company': company_name,
            'total_distance': route.get('total_distance', ''),
            'total_time': route.get('total_time', '')
        })
    
    return jsonify({
        'routes': dashboard_routes,
        'company': company_name
    })

@app.route('/api/route_settings')
@login_required
@admin_required
def get_route_settings_api():
    """API endpoint to get route settings for the current user's company"""
    company_name = session.get('company')
    settings = load_route_settings(company_name)
    return jsonify({
        'settings': settings,
        'company': company_name
    })

@app.route('/api/route_settings', methods=['POST'])
@login_required
@admin_required
def save_route_settings_api():
    """API endpoint to save route settings for the current user's company"""
    company_name = session.get('company')
    data = request.get_json()
    
    settings = {
        'max_miles': float(data.get('max_miles', 100)),
        'max_time': float(data.get('max_time', 8)),
        'max_stops': int(data.get('max_stops', 20)),
        'drop_penalty': int(data.get('drop_penalty', 1000))
    }
    
    save_route_settings_to_file(settings, company_name)
    
    return jsonify({
        'success': True,
        'message': 'Route settings saved successfully',
        'settings': settings
    })

@app.route('/api/route_parameters')
@login_required
def get_route_parameters_api():
    """API endpoint to get route parameters including settings and driver counts"""
    company_name = session.get('company')
    
    # Get route settings
    settings = load_route_settings(company_name)
    
    # Get available drivers count
    available_drivers = load_drivers(company_name)
    all_drivers = load_all_drivers(company_name)
    
    return jsonify({
        'settings': settings,
        'available_drivers': len(available_drivers),
        'total_drivers': len(all_drivers),
        'company': company_name
    })

# Route optimization helper functions
def get_distance_matrix(addresses):
    """Get distance and time matrix from Google Maps API"""
    matrix = []
    for origin in addresses:
        row = []
        for destination in addresses:
            if origin == destination:
                row.append((0, 0))
            else:
                encoded_origin = urllib.parse.quote(origin)
                encoded_dest = urllib.parse.quote(destination)
                url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={encoded_origin}&destinations={encoded_dest}&key={GOOGLE_MAPS_API_KEY}"
                response = requests.get(url)
                data = response.json()
                if data.get('status') == 'OK' and data.get('rows', [{}])[0].get('elements', [{}])[0].get('status') == 'OK':
                    duration = data['rows'][0]['elements'][0]['duration']['value']
                    distance = data['rows'][0]['elements'][0]['distance']['value']
                    row.append((duration, distance))
                else:
                    print(f"Error getting distance matrix: {data.get('status')} - {data.get('error_message', 'No error message')}")
                    raise Exception(f"Failed to get distance for {origin} to {destination}")
        matrix.append(row)
    return matrix

def solve_vrp(num_drivers, addresses_to_use, depot, all_addresses, distance_matrix, max_miles, max_time, max_stops):
    """
    Solve VRP using greedy initialization followed by optimization
    max_miles: in miles (will be converted to meters internally)
    max_time: in seconds
    max_stops: number of stops
    """
    print(f"\n{'='*80}")
    print(f"🚛 STARTING VRP OPTIMIZATION")
    print(f"{'='*80}")
    print(f"📊 Problem Parameters:")
    print(f"   • Drivers available: {num_drivers}")
    print(f"   • Addresses to route: {len(addresses_to_use)}")
    print(f"   • Max miles per route: {max_miles}")
    print(f"   • Max time per route: {max_time/3600:.1f} hours")
    print(f"   • Max stops per route: {max_stops}")
    print(f"   • Depot: {depot}")
    
    # Convert miles to meters for internal calculations
    max_miles_meters = int(max_miles * 1609.34)

    # Create distance matrix for VRP (including depot)
    vrp_addresses = [depot] + addresses_to_use
    valid_distance_matrix = [[distance_matrix[all_addresses.index(i)][all_addresses.index(j)]
                            for j in vrp_addresses] for i in vrp_addresses]

    # Step 1: Create initial solution using greedy algorithm
    def greedy_solution():
        print(f"\n🎯 PHASE 1: GREEDY INITIALIZATION")
        print(f"{'─'*50}")

        routes = []
        unassigned_addresses = list(range(1, len(vrp_addresses)))  # Start from 1 to skip depot
        dropped_nodes = []
        total_greedy_time = 0
        total_greedy_distance = 0

        for driver_idx in range(num_drivers):
            if not unassigned_addresses:
                break

            print(f"\n🚗 Driver {driver_idx + 1} route construction:")
            route = [0]  # Start at depot
            route_distance = 0
            route_time = 0
            route_stops = 0

            while unassigned_addresses and route_stops < max_stops:
                best_next_stop = None
                best_added_time = float('inf')
                best_added_distance = 0

                for address in unassigned_addresses:
                    added_time = valid_distance_matrix[route[-1]][address][0] + valid_distance_matrix[address][0][0]
                    added_distance = valid_distance_matrix[route[-1]][address][1] + valid_distance_matrix[address][0][1]

                    if (route_time + added_time <= max_time and
                        route_distance + added_distance <= max_miles_meters):
                        if added_time < best_added_time:
                            best_next_stop = address
                            best_added_time = added_time
                            best_added_distance = added_distance

                if best_next_stop is not None:
                    route.append(best_next_stop)
                    segment_time = valid_distance_matrix[route[-2]][best_next_stop][0]
                    segment_distance = valid_distance_matrix[route[-2]][best_next_stop][1]
                    route_time += segment_time
                    route_distance += segment_distance
                    route_stops += 1
                    unassigned_addresses.remove(best_next_stop)

                    print(f"   ✓ Added stop {route_stops}: {vrp_addresses[best_next_stop]}")
                    print(f"     Time: +{segment_time/60:.1f}min (total: {route_time/60:.1f}min)")
                    print(f"     Distance: +{segment_distance/1609.34:.1f}mi (total: {route_distance/1609.34:.1f}mi)")
                else:
                    print(f"   ⚠️  No more valid stops (constraints exceeded)")
                    break

            if len(route) > 1:  # Only include routes with at least one stop
                # Add return to depot
                return_time = valid_distance_matrix[route[-1]][0][0]
                return_distance = valid_distance_matrix[route[-1]][0][1]
                route_time += return_time
                route_distance += return_distance
                route.append(0)  # Return to depot
                routes.append(route)

                total_greedy_time += route_time
                total_greedy_distance += route_distance

                print(f"   🏁 Route complete: {route_stops} stops, {route_time/60:.1f}min, {route_distance/1609.34:.1f}mi")
            else:
                print(f"   ❌ No valid route for driver {driver_idx + 1}")

            dropped_nodes = unassigned_addresses

        print(f"\n📊 GREEDY SOLUTION SUMMARY:")
        print(f"   • Routes created: {len(routes)}")
        print(f"   • Addresses served: {len(addresses_to_use) - len(dropped_nodes)}")
        print(f"   • Addresses dropped: {len(dropped_nodes)}")
        print(f"   • Total time: {total_greedy_time/60:.1f} minutes")
        print(f"   • Total distance: {total_greedy_distance/1609.34:.1f} miles")
        if dropped_nodes:
            print(f"   • Dropped addresses: {[vrp_addresses[i] for i in dropped_nodes]}")

        return routes, dropped_nodes

    # Get initial solution
    initial_routes, initial_dropped = greedy_solution()

    # Step 2: Optimize using OR-Tools VRP solver
    print(f"\n🔧 PHASE 2: VRP OPTIMIZATION WITH OR-TOOLS")
    print(f"{'─'*50}")
    print(f"🏗️  Setting up VRP model...")
    print(f"   • Nodes: {len(vrp_addresses)} (including depot)")
    print(f"   • Vehicles: {num_drivers}")
    print(f"   • Depot index: 0")

    manager = pywrapcp.RoutingIndexManager(len(vrp_addresses), num_drivers, 0)
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(valid_distance_matrix[from_node][to_node][0])

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(valid_distance_matrix[from_node][to_node][1])

    # Register callbacks
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Add Distance constraint
    routing.AddDimension(
        transit_callback_index,
        0,  # no slack
        max_miles_meters,  # vehicle maximum travel distance in meters
        True,  # start cumul to zero
        'Distance')
    distance_dimension = routing.GetDimensionOrDie('Distance')
    distance_dimension.SetGlobalSpanCostCoefficient(100)

    # Add Time constraint
    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_callback_index,
        0,  # no slack
        int(max_time),  # vehicle maximum travel time as integer
        True,  # start cumul to zero
        'Time')
    time_dimension = routing.GetDimensionOrDie('Time')
    time_dimension.SetGlobalSpanCostCoefficient(100)

    # Add Capacity (stops) constraint
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return 1 if from_node != 0 else 0  # Depot has no demand

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [max_stops] * num_drivers,  # vehicle maximum stops
        True,  # start cumul to zero
        'Capacity')

    # Set initial solution
    print(f"🎯 Loading greedy solution as initial solution...")
    initial_solution = routing.ReadAssignmentFromRoutes(initial_routes, True)

    # Set search parameters
    print(f"⚙️  Configuring search parameters:")
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION)
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    search_parameters.time_limit.seconds = 30

    print(f"   • First solution strategy: PARALLEL_CHEAPEST_INSERTION")
    print(f"   • Local search metaheuristic: GUIDED_LOCAL_SEARCH")
    print(f"   • Time limit: 30 seconds")
    print(f"   • Using greedy solution as starting point")

    # Solve the problem starting from the greedy solution
    print(f"\n🚀 STARTING VRP OPTIMIZATION...")
    print(f"   ⏱️  Time limit: 30 seconds")

    start_time = time.time()
    solution = routing.SolveFromAssignmentWithParameters(initial_solution, search_parameters)
    solve_time = time.time() - start_time

    # Extract solution
    routes = []
    dropped_nodes = set(initial_dropped)
    total_time = 0
    total_distance = 0
    served_addresses = 0

    print(f"\n📈 VRP OPTIMIZATION RESULTS:")
    print(f"   ⏱️  Solve time: {solve_time:.2f} seconds")

    if solution:
        print(f"   ✅ Improved solution found!")
        print(f"   📊 Solution status: {routing.status()}")

        # Calculate detailed metrics for VRP solution
        vrp_routes_detail = []
        for vehicle_id in range(num_drivers):
            index = routing.Start(vehicle_id)
            route = [0]  # Start with depot
            route_time = 0
            route_distance = 0
            route_stops = 0

            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                if node != 0:  # Not depot
                    route.append(node)
                    served_addresses += 1
                    route_stops += 1
                    if node in dropped_nodes:
                        dropped_nodes.remove(node)
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                segment_time = time_callback(previous_index, index)
                segment_distance = distance_callback(previous_index, index)
                route_time += segment_time
                route_distance += segment_distance

            route.append(0)  # End with depot
            if len(route) > 2:  # Only include non-empty routes
                route_addresses = [vrp_addresses[i] for i in route]
                routes.append(route_addresses)
                total_time += route_time
                total_distance += route_distance
                vrp_routes_detail.append({
                    'vehicle': vehicle_id + 1,
                    'stops': route_stops,
                    'time': route_time,
                    'distance': route_distance,
                    'addresses': route_addresses
                })

        print(f"\n🚗 VRP ROUTE DETAILS:")
        for route_detail in vrp_routes_detail:
            print(f"   Vehicle {route_detail['vehicle']}: {route_detail['stops']} stops, "
                  f"{route_detail['time']/60:.1f}min, {route_detail['distance']/1609.34:.1f}mi")

    else:
        print(f"   ⚠️  No improved solution found. Using initial greedy solution.")
        routes = [[vrp_addresses[i] for i in route] for route in initial_routes]

        # Calculate metrics for greedy fallback
        for route in initial_routes:
            route_time = 0
            route_distance = 0
            for i in range(len(route) - 1):
                route_time += valid_distance_matrix[route[i]][route[i+1]][0]
                route_distance += valid_distance_matrix[route[i]][route[i+1]][1]
            total_time += route_time
            total_distance += route_distance
            served_addresses += len(route) - 2  # Exclude depot start/end

    # Calculate greedy solution metrics for comparison
    greedy_total_time = 0
    greedy_total_distance = 0
    greedy_served = 0
    for route in initial_routes:
        route_time = 0
        route_distance = 0
        for i in range(len(route) - 1):
            route_time += valid_distance_matrix[route[i]][route[i+1]][0]
            route_distance += valid_distance_matrix[route[i]][route[i+1]][1]
        greedy_total_time += route_time
        greedy_total_distance += route_distance
        greedy_served += len(route) - 2  # Exclude depot start/end

    # Print comprehensive comparison
    print(f"\n{'='*80}")
    print(f"🏆 GREEDY vs VRP COMPARISON SUMMARY")
    print(f"{'='*80}")
    print(f"📊 GREEDY SOLUTION:")
    print(f"   • Routes: {len(initial_routes)}")
    print(f"   • Addresses served: {greedy_served}")
    print(f"   • Total time: {greedy_total_time/60:.1f} minutes")
    print(f"   • Total distance: {greedy_total_distance/1609.34:.1f} miles")
    print(f"   • Dropped addresses: {len(initial_dropped)}")

    print(f"\n📊 VRP OPTIMIZED SOLUTION:")
    print(f"   • Routes: {len(routes)}")
    print(f"   • Addresses served: {served_addresses}")
    print(f"   • Total time: {total_time/60:.1f} minutes")
    print(f"   • Total distance: {total_distance/1609.34:.1f} miles")
    print(f"   • Dropped addresses: {len(dropped_nodes)}")

    # Calculate improvements
    if solution:
        time_improvement = ((greedy_total_time - total_time) / greedy_total_time) * 100
        distance_improvement = ((greedy_total_distance - total_distance) / greedy_total_distance) * 100
        address_improvement = served_addresses - greedy_served

        print(f"\n🎯 VRP IMPROVEMENTS:")
        print(f"   • Time saved: {time_improvement:+.1f}% ({(greedy_total_time - total_time)/60:+.1f} minutes)")
        print(f"   • Distance saved: {distance_improvement:+.1f}% ({(greedy_total_distance - total_distance)/1609.34:+.1f} miles)")
        print(f"   • Additional addresses served: {address_improvement:+d}")

        if time_improvement > 0 or distance_improvement > 0 or address_improvement > 0:
            print(f"   ✅ VRP optimization provided measurable improvements!")
        else:
            print(f"   ℹ️  VRP confirmed greedy solution was already optimal")
    else:
        print(f"\n⚠️  VRP OPTIMIZATION STATUS:")
        print(f"   • No improvement found - greedy solution was optimal")
        print(f"   • This can happen with simple problems or tight constraints")

    print(f"{'='*80}")

    return routes, total_time, list(dropped_nodes), served_addresses

@app.route('/optimize', methods=['POST'])
@login_required
def optimize():
    try:
        print("Starting optimization process...")
        data = request.json
        company_name = session['company']
        # Use custom depot if provided, otherwise use company default
        company_depot = data.get('mainDepot', session['company_depot'])
        company_drivers = load_drivers(company_name)

        source_type = data.get('source_type', 'manual')

        # Handle different input sources
        if source_type == 'manual':
            raw_addresses = data['deliveryAddresses'].split('\n')
        elif source_type == 'csv':
            df = pd.read_csv(StringIO(data['csvData']))
            raw_addresses = df.apply(
                lambda row: f"{row['Address Line 1']}, {row['City']}, {row['Postcode']}",
                axis=1
            ).tolist()
        else:
            return jsonify({'error': 'Invalid source type'}), 400

        # Track address frequencies while preserving order
        address_counts = OrderedDict()
        for addr in (a.strip() for a in raw_addresses if a.strip()):
            address_counts[addr] = address_counts.get(addr, 0) + 1
        addresses = list(address_counts.keys())

        all_addresses = [company_depot] + addresses

        # Load route settings
        route_settings = load_route_settings(company_name)
        max_miles_raw = float(route_settings['max_miles'])  # Keep in miles for now
        max_time = int(float(route_settings['max_time']) * 3600)  # Convert hours to seconds as integer
        max_stops = int(route_settings['max_stops'])

        print(f"Addresses: {all_addresses}")
        print(f"Route settings: max_miles={max_miles_raw} miles, max_time={max_time/3600} hours, max_stops={max_stops}")

        # Get distance matrix
        try:
            distance_matrix = get_distance_matrix(all_addresses)
            print("Distance matrix obtained successfully")
        except Exception as e:
            print(f"Error in get_distance_matrix: {str(e)}")
            return jsonify({'error': 'Failed to get distance matrix. Please check your Google Maps API key and network connection.'}), 500

        # Filter out addresses that are too far from the depot
        valid_addresses = []
        missed_addresses = []
        remaining_deliveries = address_counts.copy()

        for i, address in enumerate(addresses, 1):
            try:
                distance = distance_matrix[0][i][1]  # Distance from depot to this address
                time = distance_matrix[0][i][0]      # Time from depot to this address
                distance_miles = km_to_miles(distance / 1000)
                time_hours = time / 3600

                if distance_miles > max_miles_raw:
                    missed_addresses.append((address, f"Exceeds max distance (Distance: {distance_miles:.2f} miles)"))
                    del remaining_deliveries[address]
                elif time_hours > max_time / 3600:  # Convert max_time back to hours for comparison
                    missed_addresses.append((address, f"Exceeds max time (Time: {time_hours:.2f} hours)"))
                    del remaining_deliveries[address]
                else:
                    valid_addresses.append(address)
            except Exception as e:
                print(f"Error processing address {address}: {str(e)}")
                missed_addresses.append((address, "Error processing this address"))
                if address in remaining_deliveries:
                    del remaining_deliveries[address]

        if len(valid_addresses) == 0:
            return jsonify({'error': 'No valid addresses to route after filtering.',
                          'missed_addresses': missed_addresses}), 400

        # Sort valid addresses by time from depot
        valid_addresses_with_time = [(addr, distance_matrix[0][all_addresses.index(addr)][0])
                                   for addr in valid_addresses]
        valid_addresses_with_time.sort(key=lambda x: x[1])
        sorted_valid_addresses = [addr for addr, _ in valid_addresses_with_time]

        # Determine the maximum number of stops based on available drivers
        max_drivers = min(len(company_drivers), len(sorted_valid_addresses))
        if max_drivers == 0:
            return jsonify({'error': 'No drivers available. Please add drivers before optimizing routes.'}), 400

        total_available_stops = max_drivers * max_stops
        print(f"Max drivers: {max_drivers}, Total available stops: {total_available_stops}")

        # Try different numbers of drivers and compare results
        best_solution = None
        best_total_time = float('inf')
        best_num_drivers = 0
        best_dropped_nodes = []
        best_served_addresses = 0

        print(f"\n🔄 TESTING DIFFERENT DRIVER CONFIGURATIONS:")
        print(f"{'─'*60}")

        for num_drivers in range(1, max_drivers + 1):
            print(f"\n🧪 Testing configuration: {num_drivers} driver(s)")
            routes, total_time, dropped_nodes, served_addresses = solve_vrp(
                num_drivers, sorted_valid_addresses, company_depot, all_addresses,
                distance_matrix, max_miles_raw, max_time, max_stops)

            if routes:
                print(f"\n📋 Configuration {num_drivers} results:")
                print(f"   • Addresses served: {served_addresses}/{len(sorted_valid_addresses)}")
                print(f"   • Total time: {total_time/60:.1f} minutes")
                print(f"   • Routes created: {len(routes)}")
                print(f"   • Dropped addresses: {len(dropped_nodes)}")

                # First priority: maximize served addresses
                if served_addresses > best_served_addresses:
                    best_served_addresses = served_addresses
                    best_total_time = total_time
                    best_solution = routes
                    best_num_drivers = num_drivers
                    best_dropped_nodes = dropped_nodes
                    print(f"   🏆 NEW BEST: More addresses served!")
                # If same number of addresses served, then minimize time
                elif served_addresses == best_served_addresses and total_time < best_total_time:
                    best_total_time = total_time
                    best_solution = routes
                    best_num_drivers = num_drivers
                    best_dropped_nodes = dropped_nodes
                    print(f"   🏆 NEW BEST: Same addresses, less time!")
                else:
                    print(f"   ⚪ Not better than current best")
            else:
                print(f"   ❌ No valid solution found for {num_drivers} drivers")

        if not best_solution:
            print(f"\n❌ OPTIMIZATION FAILED: No valid solution found")
            return jsonify({'error': 'No valid solution found'}), 400

        # Print final optimization summary
        print(f"\n{'='*80}")
        print(f"🎉 FINAL OPTIMIZATION RESULTS")
        print(f"{'='*80}")
        print(f"🏆 SELECTED SOLUTION:")
        print(f"   • Configuration: {best_num_drivers} driver(s)")
        print(f"   • Addresses served: {best_served_addresses}/{len(sorted_valid_addresses)} ({best_served_addresses/len(sorted_valid_addresses)*100:.1f}%)")
        print(f"   • Total time: {best_total_time/60:.1f} minutes")
        print(f"   • Routes created: {len(best_solution)}")
        print(f"   • Algorithm: Greedy + VRP Optimization (OR-Tools)")
        print(f"   • Metaheuristic: Guided Local Search")
        print(f"{'='*80}")

        # Track served deliveries across all routes
        served_deliveries = {}
        for route in best_solution:
            for address in route:
                if address != company_depot and address in remaining_deliveries:
                    served_deliveries[address] = served_deliveries.get(address, 0) + 1

        # Update missed_addresses with remaining required deliveries
        for address, required_count in remaining_deliveries.items():
            served_count = served_deliveries.get(address, 0)
            if served_count < required_count:
                missed_visits = required_count - served_count
                if served_count == 0:
                    missed_addresses.append((address, "Could not be included in any route due to constraints"))
                else:
                    missed_addresses.append((address,
                        f"Only {served_count}/{required_count} deliveries possible due to route constraints"))

        # Prepare results and create map
        results = []
        m = folium.Map(location=[52.3068, -1.9465], zoom_start=12)

        for vehicle_id, route in enumerate(best_solution):
            route_coords = []
            total_time = 0
            total_distance = 0

            for i in range(len(route) - 1):
                origin = route[i]
                destination = route[i+1]
                route_segment = get_route_details(origin, destination)
                if route_segment:
                    route_coords.extend(route_segment)

                origin_index = all_addresses.index(origin)
                dest_index = all_addresses.index(destination)
                segment_time = distance_matrix[origin_index][dest_index][0]
                segment_distance = distance_matrix[origin_index][dest_index][1]
                total_time += segment_time
                total_distance += segment_distance

            hours, remainder = divmod(total_time, 3600)
            minutes, seconds = divmod(remainder, 60)
            total_miles = km_to_miles(total_distance / 1000)

            google_maps_url = generate_google_maps_url(route)
            apple_maps_url = generate_apple_maps_url(route)
            short_google_url = shorten_url(google_maps_url)
            short_apple_url = shorten_url(apple_maps_url)

            folium.PolyLine(route_coords,
                           color=['red', 'blue', 'green', 'purple', 'orange'][vehicle_id % 5],
                           weight=2, opacity=0.8).add_to(m)

            route_stop_counts = {addr: served_deliveries.get(addr, 0) for addr in route
                               if addr != company_depot}

            results.append({
                'driver': f"{company_drivers[vehicle_id]['name']} ({company_drivers[vehicle_id]['phone']})"
                         if vehicle_id < len(company_drivers) else f"Extra Route {vehicle_id + 1}",
                'route': route,
                'stop_counts': route_stop_counts,
                'total_time': f"{hours} hours, {minutes} minutes, {seconds} seconds",
                'total_distance': f"{total_miles:.2f} miles",
                'num_stops': len(route) - 2,  # Subtract depot visits
                'google_maps': short_google_url,
                'apple_maps': short_apple_url
            })

        # Add markers for all addresses
        for address in all_addresses:
            try:
                url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={GOOGLE_MAPS_API_KEY}"
                response = requests.get(url)
                data = response.json()
                lat = data['results'][0]['geometry']['location']['lat']
                lng = data['results'][0]['geometry']['location']['lng']

                if address == company_depot:
                    folium.Marker(
                        [lat, lng],
                        popup=address,
                        icon=folium.Icon(color='green', icon='info-sign')
                    ).add_to(m)
                else:
                    served_count = served_deliveries.get(address, 0)
                    required_count = address_counts.get(address, 0)

                    if served_count >= required_count:
                        popup_text = f"{address}\nDeliveries: {served_count}/{required_count}"
                        icon_color = 'blue'
                    elif served_count > 0:
                        popup_text = f"{address}\nDeliveries: {served_count}/{required_count}"
                        icon_color = 'orange'
                    else:
                        popup_text = f"{address}\nNot served"
                        icon_color = 'red'

                    folium.Marker(
                        [lat, lng],
                        popup=popup_text,
                        icon=folium.Icon(color=icon_color, icon='info-sign')
                    ).add_to(m)
            except Exception as e:
                print(f"Error adding marker for address {address}: {str(e)}")

        map_html = m._repr_html_()
        print("Optimization process completed successfully")

        results_data = {
            'results': results,
            'map_html': map_html,
            'missed_addresses': missed_addresses,
            'num_drivers_used': best_num_drivers,
            'total_addresses_served': best_served_addresses,
            'delivery_counts': {
                'total_required': sum(address_counts.values()),
                'total_served': sum(served_deliveries.values()),
                'addresses': {
                    addr: {
                        'required': address_counts.get(addr, 0),
                        'served': served_deliveries.get(addr, 0)
                    } for addr in address_counts.keys()
                }
            }
        }

        # Routes are no longer automatically added to dashboard
        # They will only be added when "Add to Dashboard" button is clicked

        # Save route history for audit trail
        save_route_history(results_data, company_name)

        return jsonify(results_data)
    except Exception as e:
        print(f"Unexpected error in optimize function: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred. Please check the server logs for more information.'}), 500

@app.route('/add_to_dashboard', methods=['POST'])
@login_required
def add_to_dashboard():
    """Manually add a route to the dashboard (for test schedules)"""
    try:
        data = request.json
        route_data = data.get('route_data')
        company_id = session.get('company_id')
        company_name = session.get('company')

        # Generate company_id if not in session (for existing sessions)
        if not company_id and company_name:
            import hashlib
            company_id = hashlib.md5(company_name.encode()).hexdigest()[:8]
            session['company_id'] = company_id
            print(f"Generated company_id {company_id} for session company {company_name}")



        if not route_data:
            return jsonify({'error': 'Route data required'}), 400

        # Save route to dashboard with current timestamp
        route_ids = save_route_to_db(route_data, company_id)

        return jsonify({
            'success': True,
            'message': 'Route added to dashboard successfully',
            'route_ids': route_ids
        })
    except Exception as e:
        print(f"Error adding route to dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to add route to dashboard'}), 500

@app.route('/remove_from_dashboard/<route_id>', methods=['POST'])
@login_required
def remove_from_dashboard(route_id):
    """Remove a route from the dashboard"""
    try:
        company_name = session.get('company')

        if not os.path.exists('routes.json'):
            return jsonify({'error': 'No routes found'}), 404

        with open('routes.json', 'r') as f:
            routes_db = json.load(f)

        # Check if route exists and belongs to user's company
        if route_id not in routes_db:
            return jsonify({'error': 'Route not found'}), 404

        route_data = routes_db[route_id]

        # Verify company ownership
        users = load_users()
        company_ids = []
        for u in users:
            if u['company_name'] == company_name:
                company_id = u.get('company_id')
                if not company_id:
                    import hashlib
                    company_id = hashlib.md5(u['company_name'].encode()).hexdigest()[:8]
                company_ids.append(company_id)

        if route_data.get('company_id') not in company_ids:
            return jsonify({'error': 'Unauthorized to remove this route'}), 403

        # Remove the route
        del routes_db[route_id]

        # Save updated routes
        with open('routes.json', 'w') as f:
            json.dump(routes_db, f, indent=2)

        # Also remove delivery status if it exists
        try:
            if os.path.exists('delivery_status.json'):
                with open('delivery_status.json', 'r') as f:
                    status_db = json.load(f)
                if route_id in status_db:
                    del status_db[route_id]
                    with open('delivery_status.json', 'w') as f:
                        json.dump(status_db, f, indent=2)
        except Exception as e:
            print(f"Error removing delivery status: {str(e)}")

        # Remove driver location if it exists
        try:
            if os.path.exists('driver_locations.json'):
                with open('driver_locations.json', 'r') as f:
                    location_db = json.load(f)
                if route_id in location_db:
                    del location_db[route_id]
                    with open('driver_locations.json', 'w') as f:
                        json.dump(location_db, f, indent=2)
        except Exception as e:
            print(f"Error removing driver location: {str(e)}")



        return jsonify({
            'success': True,
            'message': 'Route removed from dashboard successfully'
        })
    except Exception as e:
        print(f"Error removing route from dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to remove route from dashboard'}), 500

@app.route('/route/<route_id>/checkin', methods=['POST'])
def route_checkin(route_id):
    """Check in to start a route"""
    try:
        data = request.get_json()
        checkin_time = data.get('checkin_time')

        if not checkin_time:
            return jsonify({'error': 'Check-in time required'}), 400

        # Load existing route checkins
        checkin_file = 'route_checkins.json'
        checkins = {}
        if os.path.exists(checkin_file):
            with open(checkin_file, 'r') as f:
                checkins = json.load(f)

        # Store check-in
        checkins[route_id] = {
            'checkin_time': checkin_time,
            'status': 'active'
        }

        # Save checkins
        with open(checkin_file, 'w') as f:
            json.dump(checkins, f, indent=2)



        return jsonify({
            'success': True,
            'checkin_time': checkin_time
        })
    except Exception as e:
        print(f"Error checking in route {route_id}: {str(e)}")
        return jsonify({'error': 'Failed to check in route'}), 500

@app.route('/route/<route_id>/checkout', methods=['POST'])
def route_checkout(route_id):
    """Check out to complete a route"""
    try:
        data = request.get_json()
        checkin_time = data.get('checkin_time')
        checkout_time = data.get('checkout_time')
        final_location = data.get('final_location')

        if not checkout_time:
            return jsonify({'error': 'Checkout time required'}), 400

        # Load existing route checkins
        checkin_file = 'route_checkins.json'
        checkins = {}
        if os.path.exists(checkin_file):
            with open(checkin_file, 'r') as f:
                checkins = json.load(f)

        # Update or create checkout record
        if route_id not in checkins:
            checkins[route_id] = {}

        checkins[route_id].update({
            'checkin_time': checkin_time,
            'checkout_time': checkout_time,
            'final_location': final_location,
            'status': 'completed'
        })

        # Save checkins
        with open(checkin_file, 'w') as f:
            json.dump(checkins, f, indent=2)

        print(f"Route {route_id} checked out at {checkout_time}")

        return jsonify({
            'success': True,
            'checkout_time': checkout_time,
            'checkin_time': checkin_time
        })

    except Exception as e:
        print(f"Error in route checkout: {e}")
        return jsonify({'error': 'Failed to check out'}), 500

@app.route('/admin/route/<route_id>')
@login_required
def admin_route_tracking(route_id):
    """Admin view of route tracking with GPS location and delivery status"""
    try:
        company_name = session.get('company')

        # Load route data
        route_data = load_route_from_db(route_id)
        if not route_data:
            return render_template('error.html',
                                 error_message="Route not found",
                                 error_details="The route ID you're looking for doesn't exist."), 404

        # Verify company ownership
        users = load_users()
        company_ids = []
        for u in users:
            if u['company_name'] == company_name:
                company_id = u.get('company_id')
                if not company_id:
                    import hashlib
                    company_id = hashlib.md5(u['company_name'].encode()).hexdigest()[:8]
                company_ids.append(company_id)

        if route_data.get('company_id') not in company_ids:
            return render_template('error.html',
                                 error_message="Unauthorized",
                                 error_details="You don't have permission to view this route."), 403

        # Load delivery status
        delivery_status = load_delivery_status(route_id)

        # Load driver location
        driver_location = load_driver_locations().get(route_id)

        return render_template('admin_route_tracking.html',
                             route_data=route_data,
                             route_id=route_id,
                             delivery_status=delivery_status,
                             driver_location=driver_location,
                             company_name=company_name)
    except Exception as e:
        print(f"Error loading admin route tracking for route {route_id}: {str(e)}")
        return render_template('error.html',
                             error_message="Error loading route",
                             error_details="There was an error loading the route data."), 500

@app.route('/test_dashboard_route')
@login_required
def test_dashboard_route():
    """Create a test route for dashboard testing"""
    try:
        company_id = session.get('company_id')
        company_name = session.get('company')

        # Create test route data
        test_route_data = {
            'results': [
                {
                    'driver': 'Test Driver (07123456789)',
                    'route': ['Test Depot', '123 Test Street, Test City', '456 Another Road, Test Town', 'Test Depot'],
                    'total_time': '1 hour, 30 minutes, 0 seconds',
                    'total_distance': '25.5 miles',
                    'num_stops': 2,
                    'google_maps': 'https://google.com/maps',
                    'apple_maps': 'https://maps.apple.com',
                    'stop_counts': {
                        '123 Test Street, Test City': 1,
                        '456 Another Road, Test Town': 1
                    }
                }
            ],
            'num_drivers_used': 1,
            'total_addresses_served': 2
        }

        # Save test route
        route_ids = save_route_to_db(test_route_data, company_id)

        return jsonify({
            'success': True,
            'message': f'Test route created successfully for company {company_name}',
            'route_ids': route_ids,
            'company_id': company_id
        })
    except Exception as e:
        print(f"Error creating test route: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to create test route'}), 500

@app.route('/fix_route_company_ids')
@login_required
def fix_route_company_ids():
    """Fix existing routes that have null company_id"""
    try:
        if not os.path.exists('routes.json'):
            return jsonify({'message': 'No routes file found'})

        with open('routes.json', 'r') as f:
            routes_db = json.load(f)

        # Generate company IDs for known companies
        import hashlib
        company_ids = {
            'EightNode': hashlib.md5('EightNode'.encode()).hexdigest()[:8],
            'Ask Retrofit': hashlib.md5('Ask Retrofit'.encode()).hexdigest()[:8]
        }

        fixed_count = 0
        for route_id, route_data in routes_db.items():
            if route_id == 'company_routes':  # Skip the old structure
                continue

            if route_data.get('company_id') is None:
                # Assume routes with null company_id belong to EightNode (since that's the main test company)
                route_data['company_id'] = company_ids['EightNode']
                fixed_count += 1
                print(f"Fixed route {route_id}: assigned company_id {company_ids['EightNode']} (EightNode)")

        # Save updated routes
        with open('routes.json', 'w') as f:
            json.dump(routes_db, f, indent=2)

        return jsonify({
            'success': True,
            'message': f'Fixed {fixed_count} routes with missing company_id',
            'company_ids': company_ids
        })
    except Exception as e:
        print(f"Error fixing route company IDs: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fix route company IDs'}), 500

# Route for getting map markers
def get_coordinates(address):
    encoded_address = urllib.parse.quote(address)
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={encoded_address}&key={GOOGLE_MAPS_API_KEY}"
    response = requests.get(url)
    data = response.json()
    if data.get('status') == 'OK' and data.get('results'):
        lat = data['results'][0]['geometry']['location']['lat']
        lng = data['results'][0]['geometry']['location']['lng']
        return lat, lng
    else:
        print(f"Error geocoding address: {data.get('status')} - {data.get('error_message', 'No error message')}")
        raise Exception(f"Failed to geocode address: {address}")

def generate_google_maps_url(addresses):
    base_url = "https://www.google.com/maps/dir/"
    waypoints = "/".join(address.replace(" ", "+") for address in addresses)
    return f"{base_url}{waypoints}"

def generate_apple_maps_url(addresses):
    base_url = "http://maps.apple.com/?daddr="
    waypoints = "+to:".join(urllib.parse.quote(address) for address in addresses[1:])
    return f"{base_url}{waypoints}"

def get_route_details(origin, destination):
    encoded_origin = urllib.parse.quote(origin)
    encoded_dest = urllib.parse.quote(destination)
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={encoded_origin}&destination={encoded_dest}&key={GOOGLE_MAPS_API_KEY}"
    response = requests.get(url)
    data = response.json()
    if data.get('status') == 'OK' and data.get('routes'):
        route = data['routes'][0]['overview_polyline']['points']
        return polyline.decode(route)
    else:
        print(f"Error getting route details: {data.get('status')} - {data.get('error_message', 'No error message')}")
        return None

def shorten_url(long_url):
    try:
        url = f"http://tinyurl.com/api-create.php?url={long_url}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        short_url = response.text
        if short_url.startswith('http'):
            return short_url
        else:
            print(f"URL shortening failed. Using original URL.")
            return long_url
    except requests.exceptions.RequestException as e:
        print(f"Error occurred while shortening URL: {e}")
        return long_url

def calculate_route_distance(route, distance_matrix, all_addresses):
    total_distance = 0
    for i in range(len(route) - 1):
        origin_index = all_addresses.index(route[i])
        dest_index = all_addresses.index(route[i+1])
        total_distance += distance_matrix[origin_index][dest_index][1]
    return total_distance

def calculate_route_time(route, distance_matrix, all_addresses):
    total_time = 0
    for i in range(len(route) - 1):
        origin_index = all_addresses.index(route[i])
        dest_index = all_addresses.index(route[i+1])
        total_time += distance_matrix[origin_index][dest_index][0]
    return total_time

def km_to_miles(km):
    return km * 0.621371

@app.route('/')
@login_required
def index():
    settings = load_settings()
    company_name = session['company']
    route_settings = load_route_settings(company_name)
    
    # Get all drivers first
    all_drivers = load_all_drivers(company_name)
    # Then get available drivers
    available_drivers = [d for d in all_drivers if d.get('available_for_schedule', True)]
    
    return render_template('index.html',
                         api_key=settings['google_maps_api_key'],
                         default_depot=session['company_depot'],
                         drivers=available_drivers,
                         available_count=len(available_drivers),
                         total_count=len(all_drivers),
                         route_settings=route_settings,
                         user=session['user'],
                         company=session['company'],
                         privilege=session['privilege'])

@app.route('/settings')
@login_required
@global_admin_required
def settings():
    current_settings = load_settings()
    return render_template('settings.html', settings=current_settings)

@app.route('/save_settings', methods=['POST'])
@login_required
@global_admin_required
def save_settings_route():
    new_settings = {
        'google_maps_api_key': request.form['googleMapsApiKey']
    }
    save_settings(new_settings)
    global GOOGLE_MAPS_API_KEY
    GOOGLE_MAPS_API_KEY = new_settings['google_maps_api_key']
    flash('Settings updated successfully')
    return redirect(url_for('settings'))

@app.route('/update_password', methods=['POST'])
@login_required
def update_password():
    current_password = request.form['current_password']
    new_password = request.form['new_password']
    confirm_password = request.form['confirm_password']

    if new_password != confirm_password:
        flash('New passwords do not match')
        return redirect(url_for('settings'))

    users = load_users()
    user = next((u for u in users if u['username'] == session['user']), None)

    if user and check_password_hash(user['password_hash'], current_password):
        user['password_hash'] = generate_password_hash(new_password)
        save_users(users)
        flash('Password updated successfully')
    else:
        flash('Current password is incorrect')

    return redirect(url_for('settings'))

# Function to send SMS notifications to drivers
def send_sms_to_driver(driver_phone, message):
    try:
        message = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=driver_phone
        )
        print(f"SMS sent to {driver_phone}: {message.sid}")
        return True
    except Exception as e:
        print(f"Error sending SMS to {driver_phone}: {e}")
        return False
# Driver management routes - add these before the error handlers
@app.route('/driver_management')
@login_required
@admin_required
def driver_management():
    is_global_admin = session['privilege'] == 'global_admin'
    company_name = request.args.get('company') if is_global_admin else session['company']

    if is_global_admin and not company_name:
        companies = get_all_companies()
        return render_template('driver_management.html',
                             companies=companies,
                             is_global_admin=True)

    drivers = load_all_drivers(company_name)
    return render_template('driver_management.html',
                         drivers=drivers,
                         company_name=company_name,
                         is_global_admin=is_global_admin)

@app.route('/add_driver', methods=['POST'])
@login_required
@admin_required
def add_driver():
    company_name = request.form.get('company') if session['privilege'] == 'global_admin' else session['company']

    if not company_name:
        flash('Please select a company')
        return redirect(url_for('driver_management'))

    name = request.form['name']
    phone = request.form['phone']
    notes = request.form['notes']
    available_for_schedule = 'available_for_schedule' in request.form

    drivers = load_all_drivers(company_name)
    new_driver = {
        'name': name,
        'phone': phone,
        'notes': notes,
        'available_for_schedule': available_for_schedule
    }
    drivers.append(new_driver)
    save_drivers(drivers, company_name)

    flash('Driver added successfully')
    if session['privilege'] == 'global_admin':
        return redirect(url_for('driver_management', company=company_name))
    return redirect(url_for('driver_management'))

@app.route('/remove_driver/<int:index>', methods=['POST'])
@login_required
@admin_required
def remove_driver(index):
    company_name = request.form.get('company') if session['privilege'] == 'global_admin' else session['company']

    if not company_name:
        flash('Company not specified')
        return redirect(url_for('driver_management'))

    drivers = load_all_drivers(company_name)
    if 0 <= index < len(drivers):
        del drivers[index]
        save_drivers(drivers, company_name)
        flash('Driver removed successfully')

    if session['privilege'] == 'global_admin':
        return redirect(url_for('driver_management', company=company_name))
    return redirect(url_for('driver_management'))

@app.route('/toggle_driver_availability/<int:index>', methods=['POST'])
@login_required
@admin_required
def toggle_driver_availability(index):
    try:
        data = request.get_json()
        company_name = data.get('company') if session['privilege'] == 'global_admin' else session['company']

        if not company_name:
            return jsonify({'error': 'Company not specified'}), 400

        drivers = load_all_drivers(company_name)
        if 0 <= index < len(drivers):
            current_status = drivers[index].get('available_for_schedule', True)
            drivers[index]['available_for_schedule'] = not current_status
            save_drivers(drivers, company_name)
            return jsonify({'status': 'success', 'available': not current_status})

        return jsonify({'error': 'Invalid driver index'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/update_driver_phone/<int:index>', methods=['POST'])
@login_required
@admin_required
def update_driver_phone(index):
    try:
        data = request.get_json()
        company_name = data.get('company') if session['privilege'] == 'global_admin' else session['company']
        new_phone = data.get('phone')

        if not company_name or not new_phone:
            return jsonify({'error': 'Company name and phone number required'}), 400

        drivers = load_all_drivers(company_name)

        if 0 <= index < len(drivers):
            drivers[index]['phone'] = new_phone
            save_drivers(drivers, company_name)
            return jsonify({'status': 'success', 'phone': new_phone})

        return jsonify({'error': 'Invalid driver index'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500



# Route management routes - add these before the error handlers
@app.route('/route_management')
@login_required
@admin_required
def route_management():
    is_global_admin = session['privilege'] == 'global_admin'
    company_name = session['company']
    selected_company = None
    companies = None

    if is_global_admin:
        companies = get_all_companies()
        selected_company = request.args.get('selected_company')
        if selected_company:
            route_settings = load_route_settings(selected_company)
        else:
            route_settings = {}
    else:
        route_settings = load_route_settings(company_name)

    return render_template('route_management.html',
                         route_settings=route_settings,
                         company_name=company_name,
                         is_global_admin=is_global_admin,
                         companies=companies,
                         selected_company=selected_company)

@app.route('/save_route_settings', methods=['POST'])
@login_required
@admin_required
def save_route_settings():
    is_global_admin = session['privilege'] == 'global_admin'

    if is_global_admin:
        company_name = request.form.get('company')
        if not company_name:
            flash('Please select a company')
            return redirect(url_for('route_management'))
    else:
        company_name = session['company']

    new_settings = {
        'max_miles': float(request.form['maxMiles']),
        'max_time': float(request.form['maxTime']),
        'max_stops': int(request.form['maxStops']),
        'drop_penalty': int(request.form.get('dropPenalty', 1000))
    }

    save_route_settings_to_file(new_settings, company_name)
    flash(f'Route settings updated successfully for {company_name}')

    if is_global_admin:
        return redirect(url_for('route_management', selected_company=company_name))
    return redirect(url_for('route_management'))

    # User management routes - add these before the error handlers
@app.route('/user_management')
@global_admin_required
def user_management():
    users = load_users()
    settings = load_settings()
    return render_template('user_management.html', users=users, api_key=settings['google_maps_api_key'])

@app.route('/add_user', methods=['POST'])
@global_admin_required
def add_user():
    username = request.form['username']
    password = request.form['password']
    company_name = request.form['company_name']
    company_depot = request.form['company_depot']
    privilege = request.form['privilege']

    users = load_users()

    if any(u['username'] == username for u in users):
        flash('Username already exists')
        return redirect(url_for('user_management'))

    new_user = {
        'username': username,
        'password_hash': generate_password_hash(password),
        'company_name': company_name,
        'company_depot': company_depot,
        'privilege': privilege
    }

    users.append(new_user)
    save_users(users)
    flash('User added successfully')
    return redirect(url_for('user_management'))

@app.route('/remove_user/<username>', methods=['POST'])
@global_admin_required
def remove_user(username):
    users = load_users()
    users = [u for u in users if u['username'] != username]
    save_users(users)
    flash('User removed successfully')
    return redirect(url_for('user_management'))

    # Error handlers
@app.errorhandler(404)
def not_found_error(error):
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Internal error: {str(error)}')
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('500.html'), 500

@app.errorhandler(Exception)
def handle_exception(error):
    app.logger.error(f'Unhandled exception: {str(error)}')
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('500.html'), 500

@app.route('/driver_availability')
@login_required
@admin_required
def driver_availability():
    is_global_admin = session['privilege'] == 'global_admin'
    company_name = request.args.get('company') if is_global_admin else session['company']

    if is_global_admin and not company_name:
        companies = get_all_companies()
        return render_template('driver_availability.html',
                             companies=companies,
                             is_global_admin=True)

    drivers = load_all_drivers(company_name)
    return render_template('driver_availability.html',
                         drivers=drivers,
                         company_name=company_name,
                         is_global_admin=is_global_admin)

@app.route('/route_audit')
@login_required
def route_audit():
    """Route audit page - shows route history for the user's company"""
    is_global_admin = session['privilege'] == 'global_admin'
    company_name = request.args.get('company') if is_global_admin else session['company']

    if is_global_admin and not company_name:
        companies = get_all_companies()
        return render_template('route_audit.html',
                             companies=companies,
                             is_global_admin=True)

    # Get route history for the company
    route_history = load_route_history(company_name)

    # Sort by timestamp (newest first)
    route_history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

    # Get filter parameters
    date_filter = request.args.get('date_filter')
    driver_filter = request.args.get('driver_filter')

    # Apply filters
    filtered_history = route_history
    if date_filter:
        try:
            filter_date = datetime.fromisoformat(date_filter).date()
            filtered_history = [r for r in filtered_history
                              if datetime.fromisoformat(r['timestamp']).date() == filter_date]
        except ValueError:
            pass

    if driver_filter:
        filtered_history = [r for r in filtered_history
                          if any(result.get('driver', '').lower() == driver_filter.lower()
                                for result in r.get('data', {}).get('results', []))]

    # Get unique drivers for filter dropdown
    all_drivers = set()
    for route in route_history:
        for result in route.get('data', {}).get('results', []):
            if result.get('driver'):
                all_drivers.add(result['driver'])

    # Enhance route history with delivery status
    enhanced_history = []
    for route_entry in filtered_history:
        # Try to find corresponding delivery status
        route_id = find_route_id_for_audit_entry(route_entry, company_name)
        delivery_status = load_delivery_status(route_id) if route_id else None

        enhanced_entry = route_entry.copy()
        enhanced_entry['delivery_status'] = delivery_status
        enhanced_entry['route_id'] = route_id
        enhanced_history.append(enhanced_entry)

    return render_template('route_audit.html',
                         route_history=enhanced_history,
                         company_name=company_name,
                         is_global_admin=is_global_admin,
                         companies=get_all_companies() if is_global_admin else None,
                         all_drivers=sorted(all_drivers),
                         date_filter=date_filter,
                         driver_filter=driver_filter)

@app.route('/api/route_audit')
@login_required
def api_route_audit():
    """API endpoint for route audit data - returns JSON for Next.js frontend"""
    try:
        is_global_admin = session['privilege'] == 'global_admin'
        company_name = request.args.get('company') if is_global_admin else session['company']
        
        print(f"API route audit called - Company: {company_name}, Is Global Admin: {is_global_admin}")

        if is_global_admin and not company_name:
            companies = get_all_companies()
            return jsonify({
                'companies': companies,
                'is_global_admin': True,
                'routes': []
            })

        # Get route history for the company
        route_history = load_route_history(company_name)
        print(f"Loaded route history for {company_name}: {len(route_history)} entries")

        if not route_history:
            print(f"No route history found for company: {company_name}")
            return jsonify({
                'routes': [],
                'company_name': company_name,
                'is_global_admin': is_global_admin,
                'debug': f'No history found for company: {company_name}'
            })

        # Sort by timestamp (newest first)
        route_history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        # Transform route history for frontend consumption
        routes = []
        for route_entry in route_history:
            print(f"Processing route entry: {route_entry.get('timestamp', 'No timestamp')}")
            results = route_entry.get('data', {}).get('results', [])
            print(f"Found {len(results)} results in this entry")
            
            for result in results:
                # Try to find corresponding route ID
                route_id = find_route_id_for_audit_entry(route_entry, company_name)
                
                route_item = {
                    'route_id': route_id or f"audit_{len(routes)}",
                    'date': route_entry.get('timestamp', '').split('T')[0] if route_entry.get('timestamp') else '',
                    'driver': result.get('driver', 'Unknown'),
                    'total_distance': result.get('total_distance', ''),
                    'total_time': result.get('total_time', ''),
                    'num_stops': result.get('num_stops', 0),
                    'company': company_name,
                    'status': 'completed'  # Historical routes are completed
                }
                routes.append(route_item)
                print(f"Added route: {route_item['route_id']} - {route_item['driver']}")

        print(f"Returning {len(routes)} routes for frontend")
        return jsonify({
            'routes': routes,
            'company_name': company_name,
            'is_global_admin': is_global_admin
        })
        
    except Exception as e:
        print(f"Error in API route audit: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to load route history'}), 500

@app.route('/api/route_audit/<route_id>')
@login_required
def api_route_audit_detail(route_id):
    """API endpoint for specific route detail - returns JSON for Next.js frontend"""
    try:
        company_name = session['company']
        print(f"API route audit detail called for route: {route_id}, company: {company_name}")
        
        # First try to find in current routes
        route_data = load_route_from_db(route_id)
        if route_data:
            print(f"Found route in current routes database")
            return jsonify({
                'route_id': route_id,
                'date': route_data.get('created_at', '').split('T')[0] if route_data.get('created_at') else '',
                'driver': route_data.get('driver_name', 'Unknown'),
                'total_distance': route_data.get('total_distance', ''),
                'total_time': route_data.get('total_time', ''),
                'num_stops': route_data.get('num_stops', 0),
                'company': company_name,
                'status': route_data.get('status', 'completed'),
                'route': route_data.get('route', []),
                'google_maps': route_data.get('google_maps', ''),
                'apple_maps': route_data.get('apple_maps', ''),
                'created_at': route_data.get('created_at', ''),
                'delivery_status': load_delivery_status(route_id)
            })
        
        # If not found in current routes, search in route history
        route_history = load_route_history(company_name)
        print(f"Searching in route history: {len(route_history)} entries")
        
        for route_entry in route_history:
            # Check if this history entry contains our route
            results = route_entry.get('data', {}).get('results', [])
            for result in results:
                # Try to find matching route by comparing route ID or driver
                entry_route_id = find_route_id_for_audit_entry(route_entry, company_name)
                if entry_route_id == route_id or route_id.startswith('audit_'):
                    print(f"Found route in history entry")
                    return jsonify({
                        'route_id': route_id,
                        'date': route_entry.get('timestamp', '').split('T')[0] if route_entry.get('timestamp') else '',
                        'driver': result.get('driver', 'Unknown'),
                        'total_distance': result.get('total_distance', ''),
                        'total_time': result.get('total_time', ''),
                        'num_stops': result.get('num_stops', 0),
                        'company': company_name,
                        'status': 'completed',  # Historical routes are completed
                        'route': result.get('route', []),
                        'google_maps': result.get('google_maps', ''),
                        'apple_maps': result.get('apple_maps', ''),
                        'created_at': route_entry.get('timestamp', ''),
                        'delivery_status': None
                    })
        
        print(f"Route {route_id} not found in database or history")
        return jsonify({'error': f'Route {route_id} not found'}), 404
        
    except Exception as e:
        print(f"Error in API route audit detail: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to load route details'}), 500

@app.route('/route_audit/<route_id>')
@login_required
def route_audit_detail(route_id):
    """View detailed information about a specific route"""
    company_name = session['company']
    if session['privilege'] == 'global_admin':
        # Global admin can view any company's routes if company is specified
        company_name = request.args.get('company', company_name)

    route_history = load_route_history(company_name)
    route_entry = next((r for r in route_history if r['id'] == route_id), None)

    if not route_entry:
        flash('Route not found')
        return redirect(url_for('route_audit'))

    return render_template('route_audit_detail.html',
                         route_entry=route_entry,
                         company_name=company_name,
                         is_global_admin=session['privilege'] == 'global_admin',
                         user=session['user'],
                         company=session['company'],
                         privilege=session['privilege'])

@app.route('/route_audit/download/<format>')
@login_required
def download_route_audit(format):
    """Download route audit data in specified format"""
    from flask import make_response
    import csv
    from io import StringIO

    company_name = session['company']
    if session['privilege'] == 'global_admin':
        company_name = request.args.get('company', company_name)

    if not company_name:
        flash('Company not specified')
        return redirect(url_for('route_audit'))

    # Get route history for the company
    route_history = load_route_history(company_name)

    # Apply filters if provided
    date_filter = request.args.get('date_filter')
    driver_filter = request.args.get('driver_filter')

    filtered_history = route_history
    if date_filter:
        try:
            filter_date = datetime.fromisoformat(date_filter).date()
            filtered_history = [r for r in filtered_history
                              if datetime.fromisoformat(r['timestamp']).date() == filter_date]
        except ValueError:
            pass

    if driver_filter:
        filtered_history = [r for r in filtered_history
                          if any(result.get('driver', '').lower() == driver_filter.lower()
                                for result in r.get('data', {}).get('results', []))]

    if format.lower() == 'csv':
        return download_csv(filtered_history, company_name)
    elif format.lower() == 'json':
        return download_json(filtered_history, company_name)
    else:
        flash('Invalid download format')
        return redirect(url_for('route_audit'))

def download_csv(route_history, company_name):
    """Generate CSV download for route history"""
    from flask import make_response
    import csv
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)

    # Write CSV headers
    writer.writerow([
        'Route ID',
        'Date',
        'Time',
        'Company',
        'Driver',
        'Total Distance',
        'Total Time',
        'Number of Stops',
        'Addresses Served',
        'Route Stops',
        'Missed Addresses'
    ])

    # Write data rows
    for route_entry in route_history:
        timestamp = datetime.fromisoformat(route_entry['timestamp'])
        date_str = timestamp.strftime('%Y-%m-%d')
        time_str = timestamp.strftime('%H:%M:%S')

        for result in route_entry.get('data', {}).get('results', []):
            # Format route stops
            route_stops = ' → '.join(result.get('route', []))

            # Format missed addresses
            missed_addresses = '; '.join([
                f"{addr}: {reason}"
                for addr, reason in route_entry.get('data', {}).get('missed_addresses', [])
            ])

            writer.writerow([
                route_entry['id'][:8],
                date_str,
                time_str,
                route_entry['company'],
                result.get('driver', ''),
                result.get('total_distance', ''),
                result.get('total_time', ''),
                result.get('num_stops', ''),
                route_entry.get('data', {}).get('total_addresses_served', ''),
                route_stops,
                missed_addresses
            ])

    # Create response
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=route_audit_{company_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

    return response

def download_json(route_history, company_name):
    """Generate JSON download for route history"""
    from flask import make_response

    # Create structured data for JSON export
    export_data = {
        'company': company_name,
        'export_date': datetime.now().isoformat(),
        'total_routes': len(route_history),
        'routes': route_history
    }

    # Create response
    response = make_response(json.dumps(export_data, indent=2))
    response.headers['Content-Type'] = 'application/json'
    response.headers['Content-Disposition'] = f'attachment; filename=route_audit_{company_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'

    return response

@app.route('/route_audit/<route_id>/download/<format>')
@login_required
def download_single_route(route_id, format):
    """Download a single route in specified format"""
    from flask import make_response

    company_name = session['company']
    if session['privilege'] == 'global_admin':
        company_name = request.args.get('company', company_name)

    route_history = load_route_history(company_name)
    route_entry = next((r for r in route_history if r['id'] == route_id), None)

    if not route_entry:
        flash('Route not found')
        return redirect(url_for('route_audit'))

    if format.lower() == 'csv':
        return download_csv([route_entry], company_name)
    elif format.lower() == 'json':
        return download_json([route_entry], company_name)
    else:
        flash('Invalid download format')
        return redirect(url_for('route_audit_detail', route_id=route_id))

# Delivery Dashboard
@app.route('/delivery_dashboard')
@login_required
def delivery_dashboard():
    """Delivery status dashboard for managers"""
    company_name = session['company']
    is_global_admin = session['privilege'] == 'global_admin'

    if is_global_admin:
        company_name = request.args.get('company', company_name)
        if not company_name:
            companies = get_all_companies()
            return render_template('delivery_dashboard.html',
                                 companies=companies,
                                 is_global_admin=True)

    # Get all active routes for the company
    active_routes = get_active_routes_for_company(company_name)

    # Get delivery status for all routes
    delivery_data = []
    for route in active_routes:
        route_id = route['route_id']
        delivery_status = load_delivery_status(route_id)

        route_info = {
            'route_id': route_id,
            'driver_name': route.get('driver_name', 'Unknown Driver'),
            'created_at': route.get('created_at', ''),
            'total_stops': route.get('num_stops', 0),
            'route': route.get('route', []),
            'deliveries': delivery_status.get('deliveries', {}) if delivery_status else {},
            'tracking_url': f"/route/{route_id}"
        }

        # Calculate completion stats
        total_deliveries = route['num_stops']
        completed = sum(1 for d in route_info['deliveries'].values() if d['status'] == 'completed')
        failed = sum(1 for d in route_info['deliveries'].values() if d['status'] == 'failed')
        pending = total_deliveries - completed - failed

        route_info['stats'] = {
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'completion_rate': (completed / total_deliveries * 100) if total_deliveries > 0 else 0
        }

        delivery_data.append(route_info)

    return render_template('delivery_dashboard.html',
                         delivery_data=delivery_data,
                         company_name=company_name,
                         is_global_admin=is_global_admin)

def get_active_routes_for_company(company_name):
    """Get all active routes for a company (routes from last 24 hours)"""
    try:
        if not os.path.exists('routes.json'):
            return []

        with open('routes.json', 'r') as f:
            routes_db = json.load(f)

        # Get company users to match company names
        users = load_users()
        company_ids = []
        for u in users:
            if u['company_name'] == company_name:
                company_id = u.get('company_id')
                if not company_id:
                    # Generate the same hash-based ID as in login
                    import hashlib
                    company_id = hashlib.md5(u['company_name'].encode()).hexdigest()[:8]
                company_ids.append(company_id)

        active_routes = []
        cutoff_time = datetime.now() - timedelta(hours=24)

        for route_id, route_data in routes_db.items():
            # Check if route belongs to company
            if route_data.get('company_id') in company_ids:
                # Check if route is from last 24 hours
                created_at_str = route_data.get('created_at')
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str)
                        if created_at > cutoff_time:
                            active_routes.append(route_data)
                    except ValueError:
                        # Include route anyway if we can't parse the date
                        active_routes.append(route_data)
                else:
                    # Include route anyway if no created_at field
                    active_routes.append(route_data)

        # Sort by creation time (newest first)
        active_routes.sort(key=lambda x: x['created_at'], reverse=True)
        return active_routes

    except Exception as e:
        print(f"Error getting active routes: {str(e)}")
        return []

def find_route_id_for_audit_entry(route_entry, company_name):
    """Find the route ID for a route audit entry by matching driver and timestamp"""
    try:
        if not os.path.exists('routes.json'):
            return None

        with open('routes.json', 'r') as f:
            routes_db = json.load(f)

        # Get company users to match company names
        users = load_users()
        company_ids = [u.get('company_id') for u in users if u['company_name'] == company_name]

        # Extract timestamp and driver info from audit entry
        audit_timestamp = datetime.fromisoformat(route_entry['timestamp'])
        audit_drivers = [result.get('driver', '') for result in route_entry.get('data', {}).get('results', [])]

        # Look for matching routes (within 1 hour of audit timestamp)
        for route_id, route_data in routes_db.items():
            if route_data.get('company_id') in company_ids:
                route_timestamp = datetime.fromisoformat(route_data['created_at'])
                time_diff = abs((audit_timestamp - route_timestamp).total_seconds())

                # If timestamps are within 1 hour and driver matches
                if time_diff < 3600:  # 1 hour
                    route_driver = route_data.get('driver_name', '')
                    if any(driver in route_driver or route_driver in driver for driver in audit_drivers):
                        return route_id

        return None
    except Exception as e:
        print(f"Error finding route ID for audit entry: {str(e)}")
        return None

# Driver tracking routes
@app.route('/route/<route_id>')
def driver_tracking(route_id):
    """Driver tracking interface - no login required"""
    try:
        # Load route data from database
        route_data = load_route_from_db(route_id)
        if not route_data:
            return render_template('error.html',
                                 error_message="Route not found",
                                 error_details="The route ID you're looking for doesn't exist or has expired."), 404

        # Load delivery status
        delivery_status = load_delivery_status(route_id)

        return render_template('driver_tracking.html',
                             route_data=route_data,
                             route_id=route_id,
                             delivery_status=delivery_status)
    except Exception as e:
        print(f"Error loading driver tracking for route {route_id}: {str(e)}")
        return render_template('error.html',
                             error_message="Error loading route",
                             error_details="There was an error loading the route data."), 500

@app.route('/route/<route_id>/update_delivery', methods=['POST'])
def update_delivery_status(route_id):
    """Update delivery status for a specific address"""
    try:
        data = request.json
        address = data.get('address')
        status = data.get('status')  # 'completed', 'failed', 'pending'
        notes = data.get('notes', '')
        timestamp = datetime.now().isoformat()

        if not address or not status:
            return jsonify({'error': 'Address and status required'}), 400

        # Update delivery status
        delivery_status = load_delivery_status(route_id)
        if not delivery_status:
            delivery_status = {'deliveries': {}, 'route_id': route_id}

        delivery_status['deliveries'][address] = {
            'status': status,
            'notes': notes,
            'timestamp': timestamp
        }

        save_delivery_status(route_id, delivery_status)

        return jsonify({'success': True, 'timestamp': timestamp})
    except Exception as e:
        print(f"Error updating delivery status: {str(e)}")
        return jsonify({'error': 'Failed to update delivery status'}), 500

@app.route('/route/<route_id>/status')
@login_required
def get_route_status(route_id):
    """Get current route status as JSON"""
    try:
        print(f"Getting route status for route_id: {route_id}")
        
        route_data = load_route_from_db(route_id)
        print(f"Route data loaded: {route_data is not None}")
        
        if not route_data:
            print(f"Route {route_id} not found in database")
            return jsonify({'error': f'Route {route_id} not found'}), 404
            
        # Verify company ownership if user is logged in
        user_company = session.get('company')
        if user_company and route_data.get('company_id'):
            # Check if user's company matches route company
            users = load_users()
            user_company_id = None
            for user in users:
                if user['company_name'] == user_company:
                    user_company_id = user.get('company_id')
                    if not user_company_id:
                        import hashlib
                        user_company_id = hashlib.md5(user['company_name'].encode()).hexdigest()[:8]
                    break
            
            if str(route_data.get('company_id')) != str(user_company_id):
                print(f"Access denied: user company {user_company_id} != route company {route_data.get('company_id')}")
                return jsonify({'error': 'Access denied'}), 403

        delivery_status = load_delivery_status(route_id)
        print(f"Delivery status loaded: {delivery_status is not None}")

        # Load check-in status
        checkin_info = None
        checkin_file = 'route_checkins.json'
        if os.path.exists(checkin_file):
            with open(checkin_file, 'r') as f:
                checkins = json.load(f)
                checkin_info = checkins.get(route_id)

        response_data = {
            'route_data': route_data,
            'delivery_status': delivery_status,
            'checkin_time': checkin_info.get('checkin_time') if checkin_info else None,
            'route_id': route_id
        }
        
        print(f"Returning response data with route_data keys: {list(route_data.keys()) if route_data else None}")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error getting route status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to get route status'}), 500

@app.route('/route/<route_id>/update_location', methods=['POST'])
def update_driver_location(route_id):
    """Update driver's GPS location"""
    try:
        data = request.json
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        accuracy = data.get('accuracy')
        timestamp = data.get('timestamp')

        if not all([latitude, longitude, timestamp]):
            return jsonify({'error': 'Latitude, longitude, and timestamp required'}), 400

        # Load existing location data
        location_data = load_driver_locations()
        if not location_data:
            location_data = {}

        # Update location for this route
        location_data[route_id] = {
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
            'timestamp': timestamp,
            'last_updated': datetime.now().isoformat()
        }

        # Save location data
        save_driver_locations(location_data)

        return jsonify({'success': True})
    except Exception as e:
        print(f"Error updating driver location: {str(e)}")
        return jsonify({'error': 'Failed to update location'}), 500

@app.route('/route/<route_id>/location', methods=['GET'])
@login_required
def get_driver_location(route_id):
    """Get driver's current GPS location"""
    try:
        # Verify route exists and user has access
        company_name = session.get('company')
        route_data = load_route_from_db(route_id)
        
        if not route_data:
            return jsonify({'error': 'Route not found'}), 404
            
        # Verify company ownership
        if str(route_data.get('company_id')) != str(session.get('company_id')):
            return jsonify({'error': 'Access denied'}), 403

        # Load driver location data
        location_data = load_driver_locations()
        driver_location = location_data.get(route_id)
        
        if not driver_location:
            return jsonify({'error': 'No location data available'}), 404
            
        return jsonify(driver_location)
    except Exception as e:
        print(f"Error getting driver location: {str(e)}")
        return jsonify({'error': 'Failed to get driver location'}), 500

# Helper functions for driver tracking
def load_route_from_db(route_id):
    """Load route data from database"""
    try:
        if os.path.exists('routes.json'):
            with open('routes.json', 'r') as f:
                routes_db = json.load(f)
                return routes_db.get(route_id)
        return None
    except Exception as e:
        print(f"Error loading route from DB: {str(e)}")
        return None

def load_delivery_status(route_id):
    """Load delivery status for a route"""
    try:
        if os.path.exists('delivery_status.json'):
            with open('delivery_status.json', 'r') as f:
                status_db = json.load(f)
                return status_db.get(route_id)
        return None
    except Exception as e:
        print(f"Error loading delivery status: {str(e)}")
        return None

def save_delivery_status(route_id, delivery_status):
    """Save delivery status for a route"""
    try:
        status_db = {}
        if os.path.exists('delivery_status.json'):
            with open('delivery_status.json', 'r') as f:
                status_db = json.load(f)

        status_db[route_id] = delivery_status

        with open('delivery_status.json', 'w') as f:
            json.dump(status_db, f, indent=2)
    except Exception as e:
        print(f"Error saving delivery status: {str(e)}")

def load_driver_locations():
    """Load driver location data"""
    try:
        if os.path.exists('driver_locations.json'):
            with open('driver_locations.json', 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading driver locations: {str(e)}")
        return {}

def save_driver_locations(location_data):
    """Save driver location data"""
    try:
        with open('driver_locations.json', 'w') as f:
            json.dump(location_data, f, indent=2)
    except Exception as e:
        print(f"Error saving driver locations: {str(e)}")


if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5001)