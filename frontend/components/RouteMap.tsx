'use client'

import React, { useEffect, useRef } from 'react'
import { MapPin, Warehouse, AlertCircle } from 'lucide-react'

interface RouteResult {
  driver: string
  route: string[]
  total_time: string
  total_distance: string
  num_stops: number
}

interface RouteMapProps {
  routes: RouteResult[]
  depot: string
  missedAddresses: [string, string][]
}

const RouteMap: React.FC<RouteMapProps> = ({ routes, depot, missedAddresses }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  const routeColors = [
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#14B8A6', // Teal
    '#A855F7'  // Violet
  ]

  useEffect(() => {
    if (!mapRef.current) return

    // Dynamically import Leaflet to avoid SSR issues
    const initMap = async () => {
      setIsLoading(true)
      const L = (await import('leaflet')).default

      // Fix for default markers - more robust approach
      try {
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })
      } catch (iconError) {
        console.warn('Could not fix default markers:', iconError)
      }

      // Remove existing map if it exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      // Initialize map
      if (!mapRef.current) return
      const map = L.map(mapRef.current, {
        center: [52.3068, -1.9465], // Redditch, UK
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true
      })

      // Add dark theme tiles
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
        maxZoom: 20,
        minZoom: 3
      }).addTo(map)

      mapInstanceRef.current = map

      const bounds: [number, number][] = []
      const markers: any[] = []

      // Create custom depot icon using Warehouse SVG
      const depotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #4F46E5;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M0 9 L0 21 A2 2 0 0 0 2 23 L22 23 A2 2 0 0 0 24 21 L24 9 L12 2 Z"/>
              <polyline points="0,9 12,2 24,9"/>
              <polyline points="6,19 6,13 18,13 18,19"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      // Create custom route markers
      const createRouteIcon = (color: string, label: string) => {
        return L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="
              width: 30px;
              height: 30px;
              border-radius: 50%;
              background: ${color};
              border: 2px solid white;
              box-shadow: 0 2px 5px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            ">
              ${label}
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }

      // Create missed address icon
      const missedIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #EF4444;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">
            ⚠️
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })

      // Geocode function using a free geocoding service
      const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
          )
          const data = await response.json()
          if (data && data.length > 0) {
            return {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            }
          }
          return null
        } catch (error) {
          console.error('Geocoding error:', error)
          return null
        }
      }

      // Get route between two points using OSRM (free routing service)
      const getRoute = async (start: [number, number], end: [number, number]): Promise<[number, number][] | null> => {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
          )
          const data = await response.json()
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates
            return coordinates.map((coord: [number, number]) => [coord[1], coord[0]]) // Swap lng,lat to lat,lng
          }
          return null
        } catch (error) {
          console.error('Routing error:', error)
          return null
        }
      }

      // Add depot marker
      try {
        const depotCoords = await geocodeAddress(depot)
        if (depotCoords) {
          try {
            const depotMarker = L.marker([depotCoords.lat, depotCoords.lng], { icon: depotIcon }).addTo(map)
            depotMarker.bindPopup(`
              <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-weight: bold; margin-bottom: 8px; color: #8B5CF6;">Depot Location</div>
                <div style="font-size: 13px;">📍 ${depot}</div>
              </div>
            `)
            bounds.push([depotCoords.lat, depotCoords.lng])
            markers.push(depotMarker)
          } catch (markerError) {
            console.error('Error creating depot marker:', markerError)
            // Fallback: try with default marker
            try {
              const fallbackMarker = L.marker([depotCoords.lat, depotCoords.lng]).addTo(map)
              fallbackMarker.bindPopup(`<div>Depot: ${depot}</div>`)
              bounds.push([depotCoords.lat, depotCoords.lng])
              markers.push(fallbackMarker)
            } catch (fallbackError) {
              console.error('Error creating fallback depot marker:', fallbackError)
            }
          }
        }
      } catch (error) {
        console.error('Error adding depot marker:', error)
      }

      // Add route markers and lines
      for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
        const route = routes[routeIndex]
        const routeColor = routeColors[routeIndex % routeColors.length]
        const routeCoords: [number, number][] = []

        // Geocode all addresses in the route
        for (let stopIndex = 0; stopIndex < route.route.length; stopIndex++) {
          const address = route.route[stopIndex]
          
          try {
            const coords = await geocodeAddress(address)
            if (coords) {
              routeCoords.push([coords.lat, coords.lng])
              bounds.push([coords.lat, coords.lng])

              // Only add markers for non-depot stops (skip first and last if they're depot)
              const isDepot = stopIndex === 0 || stopIndex === route.route.length - 1
              if (!isDepot || stopIndex === 0) { // Add depot marker only once
                try {
                  const icon = isDepot ? depotIcon : createRouteIcon(routeColor, stopIndex.toString())
                  const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map)
                  
                  marker.bindPopup(`
                    <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                      <div style="font-weight: bold; margin-bottom: 8px; color: ${routeColor};">
                        ${isDepot ? 'Depot Location' : `Stop ${stopIndex}`}
                      </div>
                      <div style="font-size: 13px; margin-bottom: 4px;">📍 ${address}</div>
                      ${!isDepot ? `<div style="font-size: 13px;">🚚 ${route.driver}</div>` : ''}
                    </div>
                  `)
                  markers.push(marker)
                } catch (markerError) {
                  console.error(`Error creating marker for ${address}:`, markerError)
                  // Fallback: try with default marker
                  try {
                    const fallbackMarker = L.marker([coords.lat, coords.lng]).addTo(map)
                    fallbackMarker.bindPopup(`<div>${isDepot ? 'Depot' : `Stop ${stopIndex}`}: ${address}</div>`)
                    markers.push(fallbackMarker)
                  } catch (fallbackError) {
                    console.error(`Error creating fallback marker for ${address}:`, fallbackError)
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error geocoding address ${address}:`, error)
          }
        }

        // Add route line with proper road routing
        if (routeCoords.length > 1) {
          const allRoutePoints: [number, number][] = []
          
          // Get detailed route between each pair of consecutive points
          for (let i = 0; i < routeCoords.length - 1; i++) {
            const start = routeCoords[i]
            const end = routeCoords[i + 1]
            
            try {
              const routeSegment = await getRoute(start, end)
              if (routeSegment) {
                // Add route points (skip the first point for subsequent segments to avoid duplicates)
                const pointsToAdd = i === 0 ? routeSegment : routeSegment.slice(1)
                allRoutePoints.push(...pointsToAdd)
              } else {
                // Fallback to straight line if routing fails
                if (i === 0) allRoutePoints.push(start)
                allRoutePoints.push(end)
              }
            } catch (error) {
              console.error('Error getting route segment:', error)
              // Fallback to straight line
              if (i === 0) allRoutePoints.push(start)
              allRoutePoints.push(end)
            }
          }

          const routeLine = L.polyline(allRoutePoints, {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
            dashArray: routeIndex % 2 === 1 ? '10, 5' : undefined
          }).addTo(map)

          // Add route info popup on click
          routeLine.on('click', (e) => {
            L.popup()
              .setLatLng(e.latlng)
              .setContent(`
                <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                  <div style="font-weight: bold; margin-bottom: 8px; color: ${routeColor};">${route.driver}</div>
                  <div style="font-size: 13px; margin-bottom: 4px;">⏱️ ${route.total_time}</div>
                  <div style="font-size: 13px; margin-bottom: 4px;">📏 ${route.total_distance}</div>
                  <div style="font-size: 13px;">🎯 ${route.num_stops} stops</div>
                </div>
              `)
              .openOn(map)
          })
        }
      }

      // Add missed address markers
      for (const [address, reason] of missedAddresses) {
        try {
          const coords = await geocodeAddress(address)
          if (coords) {
            try {
              const marker = L.marker([coords.lat, coords.lng], { icon: missedIcon }).addTo(map)
              marker.bindPopup(`
                <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                  <div style="font-weight: bold; margin-bottom: 8px; color: #EF4444;">Missed Address</div>
                  <div style="font-size: 13px; margin-bottom: 4px;">📍 ${address}</div>
                  <div style="font-size: 13px; color: #FCA5A5;">⚠️ ${reason}</div>
                </div>
              `)
              bounds.push([coords.lat, coords.lng])
              markers.push(marker)
            } catch (markerError) {
              console.error(`Error creating missed address marker for ${address}:`, markerError)
              // Fallback: try with default marker
              try {
                const fallbackMarker = L.marker([coords.lat, coords.lng]).addTo(map)
                fallbackMarker.bindPopup(`<div>Missed: ${address} - ${reason}</div>`)
                bounds.push([coords.lat, coords.lng])
                markers.push(fallbackMarker)
              } catch (fallbackError) {
                console.error(`Error creating fallback missed address marker for ${address}:`, fallbackError)
              }
            }
          }
        } catch (error) {
          console.error(`Error geocoding missed address ${address}:`, error)
        }
      }

      // Fit map to bounds
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] })
      }

      // Add legend
      const legend = (L as any).control({ position: 'bottomleft' })
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'info legend')
        div.style.background = 'rgba(26, 26, 26, 0.9)'
        div.style.border = '1px solid rgba(255, 255, 255, 0.1)'
        div.style.padding = '8px'
        div.style.borderRadius = '6px'
        div.style.color = 'white'
        div.style.fontSize = '12px'

        let legendHTML = '<div style="font-weight: bold; margin-bottom: 8px;">Routes</div>'
        routes.forEach((route, index) => {
          const color = routeColors[index % routeColors.length]
          legendHTML += `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 16px; height: 3px; background: ${color}; margin-right: 8px;"></div>
              <span style="font-size: 11px;">${route.driver}</span>
            </div>
          `
        })
        
        if (missedAddresses.length > 0) {
          legendHTML += `
            <div style="display: flex; align-items: center; margin-top: 8px;">
              <div style="width: 12px; height: 12px; background: #EF4444; border-radius: 50%; margin-right: 8px;"></div>
              <span style="font-size: 11px;">Missed Addresses</span>
            </div>
          `
        }

        div.innerHTML = legendHTML
        return div
      }
      legend.addTo(map)
      
      // Map loading complete
      setIsLoading(false)
    }

    initMap().catch((error) => {
      console.error('Error initializing map:', error)
      setIsLoading(false)
    })

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [routes, depot, missedAddresses])

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-zinc-900 rounded-lg flex items-center justify-center z-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
            <p className="text-zinc-400 text-sm">Loading route map...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      <style jsx global>{`
        .leaflet-container {
          background: #1A1A1A !important;
        }
        .leaflet-popup-content-wrapper {
          background: #2A2A2A !important;
          color: white !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-popup-tip {
          background: #2A2A2A !important;
        }
        .leaflet-control-attribution {
          background: rgba(26, 26, 26, 0.8) !important;
          color: white !important;
        }
        .leaflet-control-attribution a {
          color: #8B5CF6 !important;
        }
      `}</style>
    </div>
  )
}

export default RouteMap