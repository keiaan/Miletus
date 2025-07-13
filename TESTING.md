# Testing the Modern Next.js Frontend

## 🚀 Quick Start

### Option 1: Automated Startup (Recommended)
```bash
./start_dev.sh
```

### Option 2: Manual Startup
```bash
# Terminal 1 - Start Flask Backend
python run_localhost.py

# Terminal 2 - Start Next.js Frontend
cd frontend && npm run dev -- --port 3001
```

## 🌐 Access Points

- **Modern Frontend**: http://localhost:3001
- **Original Flask UI**: http://localhost:5001

## 🧪 Testing Checklist

### 1. Basic Interface Testing
- [ ] Page loads with dark theme
- [ ] Route parameters display correctly
- [ ] Navigation is responsive
- [ ] All animations work smoothly

### 2. Address Input Testing
- [ ] **Manual Entry**:
  - [ ] Add addresses one by one
  - [ ] Remove addresses with trash icon
  - [ ] Reset depot address button works
- [ ] **CSV Upload**:
  - [ ] Download template works
  - [ ] Upload and preview CSV
  - [ ] Remove rows from preview
- [ ] **Database Tab**: Shows "coming soon" message

### 3. Route Optimization Testing
- [ ] Enter depot: "Redditch, Worcestershire, UK"
- [ ] Add 3-5 delivery addresses around Redditch/Birmingham area
- [ ] Click "Optimize Routes"
- [ ] Loading spinner appears with quirky messages
- [ ] Results display with route cards
- [ ] Map shows routes with colored lines and markers
- [ ] Click markers to see popups

### 4. Results Features Testing
- [ ] Each route card shows:
  - [ ] Driver name
  - [ ] Total time and distance
  - [ ] Route stops with depot icons
  - [ ] Google Maps and Apple Maps links work
  - [ ] "Add to Dashboard" button functions
- [ ] Map displays:
  - [ ] Depot marker (blue with warehouse icon)
  - [ ] Stop markers (purple with numbers)
  - [ ] Route lines in different colors
  - [ ] Legend showing routes
  - [ ] Missed addresses (red with warning icon) if any

### 5. Error Handling Testing
- [ ] Try optimizing without depot address
- [ ] Try optimizing without delivery addresses
- [ ] Test with invalid CSV format
- [ ] Verify error messages display correctly

### 6. Responsive Design Testing
- [ ] Test on desktop (full width)
- [ ] Test on tablet (medium width)
- [ ] Test on mobile (narrow width)
- [ ] Verify all elements scale appropriately

## 🔧 Backend Integration Testing

### API Endpoints
- [ ] `POST /optimize` - Route optimization works
- [ ] `POST /add_to_dashboard` - Dashboard integration works
- [ ] CORS headers allow frontend requests

### Data Flow
- [ ] Frontend sends correct data format to Flask
- [ ] Flask processes optimization and returns results
- [ ] Frontend displays results accurately
- [ ] Map visualization matches route data

## 🎨 Visual/UX Testing

### Dark Theme
- [ ] Consistent dark colors throughout
- [ ] Purple accent colors (#8B5CF6) used correctly
- [ ] Good contrast for accessibility
- [ ] Glass-morphism effects visible

### Animations
- [ ] Hover effects on cards and buttons
- [ ] Loading spinner animation
- [ ] Fade-in animations for results
- [ ] Smooth transitions

### Modern Elements
- [ ] Custom scrollbars
- [ ] Rounded corners and shadows
- [ ] Icon usage (Lucide React icons)
- [ ] Typography hierarchy

## 🐛 Common Issues & Solutions

### "Module not found: leaflet"
```bash
cd frontend && npm install leaflet @types/leaflet react-leaflet
```

### "Port 3001 already in use"
```bash
lsof -ti:3001 | xargs kill -9
# Or use a different port: npm run dev -- --port 3002
```

### Map not loading
- Check browser console for errors
- Verify Leaflet CSS is imported
- Ensure geocoding API is accessible

### Routes not optimizing
- Check Flask backend is running on port 5001
- Verify CORS headers in Flask app
- Check browser network tab for API errors

## ✅ Success Criteria

The frontend is working correctly if:
1. All interface elements load and function
2. Route optimization produces results
3. Map displays routes visually
4. No console errors in browser
5. Responsive design works across devices
6. Integration with Flask backend is seamless

## 📝 Feedback Points

When testing, pay attention to:
- **Performance**: Page load times and responsiveness
- **User Experience**: Intuitive workflow and clear feedback
- **Visual Design**: Professional appearance and consistency
- **Functionality**: All features work as expected
- **Mobile Experience**: Usability on smaller screens