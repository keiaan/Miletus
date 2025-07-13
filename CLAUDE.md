# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a Flask-based vehicle routing and delivery management system that optimizes delivery routes using OR-Tools and Google Maps API. The application handles multi-company scheduling with role-based access control and uses JSON files for data persistence.

## Development Commands

### Running the Application
```bash
# Flask backend (default)
python run_localhost.py

# Alternative WSGI entry point
python wsgi.py

# Next.js frontend (modern UI)
cd frontend && npm run dev
```

### Testing
```bash
python test_db.py
```

### Frontend Development
```bash
# Install frontend dependencies
cd frontend && npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build
```

## Architecture & Key Components

### Core Application Structure
- **app/__init__.py**: Main Flask application with all routes and business logic (2300+ lines)
- **app/templates/**: Jinja2 HTML templates for the web interface (legacy)
- **app/static/**: CSS and JavaScript assets (legacy)
- **frontend/**: Modern Next.js frontend with dark theme and enhanced UX
- **JSON data files**: All application data stored in JSON format

### Modern Frontend (Next.js)
- **app/page.tsx**: Main route optimization interface with modern UI
- **components/RouteMap.tsx**: Interactive Leaflet map with route visualization
- **app/globals.css**: Dark theme styling with glass-morphism effects
- **Responsive design**: Mobile-first approach with Tailwind CSS
- **TypeScript**: Full type safety and better developer experience

### Data Storage (JSON Files)
The application uses **JSON files for all data persistence**:
- **routes.json**: Active route data for driver tracking
- **drivers.json**: Driver information organized by company
- **users.json**: User authentication and company information
- **delivery_status.json**: Real-time delivery status updates
- **route_history.json**: Route audit trail and historical data
- **route_settings.json**: Company-specific route optimization settings
- **settings.json**: Global application settings (API keys)
- **driver_locations.json**: GPS tracking data for active routes
- **route_checkins.json**: Driver check-in/check-out timestamps

### Route Optimization Engine
- **Primary Algorithm**: Custom greedy initialization + OR-Tools VRP solver
- **Fallback**: Pure greedy algorithm if OR-Tools fails
- **Constraints**: Distance (miles), time (hours), stops per route
- **Metaheuristic**: Guided Local Search with 30-second time limit
- **Multi-configuration testing**: Automatically tests 1 to N drivers, selects optimal solution

### Multi-Company Architecture
- Company isolation through `company_id` hash-based identifiers (MD5 of company name)
- Role-based access: `user`, `admin`, `global_admin`
- Company-specific route settings and driver pools
- Data filtering by company throughout the application

### External API Dependencies
- **Google Maps API**: Distance matrix, geocoding, route visualization, directions
- **Twilio**: SMS notifications to drivers
- **TinyURL**: URL shortening for mobile-friendly map links

## Important Configuration

### API Keys (Located in app/__init__.py)
```python
GOOGLE_MAPS_API_KEY = 'AIzaSyCHBzKvpPE6lyMrBLf4EZtmWUu1wLaolgM'
TWILIO_ACCOUNT_SID = 'AC6c80189ca1c3c34bd6f644427d1d3a15'
TWILIO_AUTH_TOKEN = 'c4577b09678329861f60511e4d1ea5aa'
```

### Route Settings Per Company (route_settings.json)
- Max miles per route (default: 100)
- Max time per route (default: 8 hours)
- Max stops per route (database model present but unused)
- Drop penalty for unassigned addresses (default: 1000)

## Key Business Logic

### VRP Optimization Process (`solve_vrp` function in app/__init__.py:377)
1. **Phase 1**: Greedy algorithm builds initial feasible routes
2. **Phase 2**: OR-Tools VRP solver optimizes the solution
3. **Detailed comparison**: Metrics comparing greedy vs optimized solutions
4. **Multi-driver testing**: Tests configurations from 1 to N available drivers
5. **Best solution selection**: Prioritizes max addresses served, then min time

### Route Management Flow
1. Route optimization creates results in memory
2. Results automatically saved to `route_history.json` for audit trail
3. Manual "Add to Dashboard" button saves active routes to `routes.json`
4. Each route gets unique 8-character ID for driver tracking
5. Real-time delivery updates stored in `delivery_status.json`

### Driver Tracking Workflow
1. Drivers access `/route/<route_id>` (no authentication required)
2. GPS location updates sent to `/route/<route_id>/update_location`
3. Delivery status updates via `/route/<route_id>/update_delivery`
4. Admin monitoring available at `/admin/route/<route_id>`
5. Check-in/check-out functionality with timestamp tracking

### Authentication & Sessions
- Flask sessions store: `user`, `company`, `company_depot`, `privilege`, `company_id`
- Password hashing using Werkzeug security functions
- Company data isolation enforced in all data access functions
- JSON file operations include company filtering

### Data Access Patterns
- **Load functions**: `load_users()`, `load_drivers(company_name)`, `load_route_settings(company_name)`
- **Save functions**: `save_users()`, `save_drivers()`, `save_route_settings_to_file()`
- **Company isolation**: Most functions accept `company_name` parameter for data filtering
- **Route tracking**: Functions like `load_route_from_db()` access routes.json by route_id