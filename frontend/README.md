# AutoScheduler Frontend

Modern Next.js frontend for the AutoScheduler route optimization system.

## Features

- **Modern Dark Theme**: Sleek, professional interface with smooth animations
- **Real-time Route Optimization**: Connect to Flask backend for route calculations
- **Interactive Mapping**: Leaflet-based map with custom markers and route visualization
- **Multiple Input Methods**: Manual entry, CSV upload, and database integration
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **TypeScript**: Full type safety throughout the application

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Start Flask Backend**:
   ```bash
   # In the parent directory
   python run_localhost.py
   ```

4. **Open Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Architecture

### Frontend Stack
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS**: Utility-first CSS framework with custom dark theme
- **Leaflet**: Interactive maps with route visualization
- **Axios**: HTTP client for API communication
- **Lucide React**: Modern icon library

### Backend Integration
- Connects to Flask backend running on `http://localhost:5001`
- Proxy configuration in `next.config.js` routes `/api/*` to Flask
- CORS enabled on Flask side for cross-origin requests

## Key Components

### Main Page (`app/page.tsx`)
- Route parameter display
- Address input (manual/CSV/database)
- Route optimization controls
- Results visualization
- Map integration

### RouteMap (`components/RouteMap.tsx`)
- Interactive Leaflet map
- Custom markers for depot, stops, and missed addresses
- Route line visualization with different colors
- Popup information windows
- Dark theme integration

## Styling

### Color Scheme
- **Primary Background**: `#1A1A1A`
- **Secondary Background**: `#2A2A2A`
- **Tertiary Background**: `#333333`
- **Accent Purple**: `#8B5CF6`
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#B0B0B0`

### Custom Components
- Glass-morphism cards with backdrop blur
- Smooth hover animations and transitions
- Custom loading spinners and progress indicators
- Responsive grid layouts

## API Integration

The frontend communicates with the Flask backend through these endpoints:

- `POST /api/optimize` - Route optimization
- `POST /api/add_to_dashboard` - Add routes to tracking dashboard
- Additional endpoints as needed

## Development Notes

- Uses `'use client'` directive for client-side components
- Dynamic imports for browser-only libraries (Leaflet)
- SSR-safe component structure
- TypeScript interfaces for type safety
- Responsive design with Tailwind breakpoints

## Testing Your Setup

1. Start both Flask backend (port 5001) and Next.js frontend (port 3000)
2. Navigate to the frontend in your browser
3. Enter a depot address and some delivery addresses
4. Click "Optimize Routes" to test the full flow
5. Verify that routes appear on the map and results are displayed

The frontend maintains the same functionality as the original Flask templates while providing a modern, responsive user experience.