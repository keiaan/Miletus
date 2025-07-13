'use client'

import React, { useEffect, useRef } from 'react'

interface DeliveryStop {
  address: string
  status: 'pending' | 'completed' | 'failed'
  notes?: string
  timestamp?: string
}

interface DriverLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
  last_updated: string
}

interface AdminRouteMapProps {
  route: string[]
  driverLocation: DriverLocation | null
  deliveryStatus: Record<string, DeliveryStop>
  depot: string
}

export default function AdminRouteMap({ route, driverLocation, deliveryStatus, depot }: AdminRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isMounted, setIsMounted] = React.useState(false)

  // Client-side only mounting
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || !mapRef.current) return

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

      // Initialize map - double check element exists
      if (!mapRef.current || mapInstanceRef.current) return
      
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

      // Create custom depot icon
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
            🏢
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      // Create stop marker function
      const createStopIcon = (status: string, number: number) => {
        let color = '#6b7280' // gray for pending
        switch (status) {
          case 'completed':
            color = '#10b981' // green
            break
          case 'failed':
            color = '#ef4444' // red
            break
          default:
            color = '#f59e0b' // orange for pending
        }

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
              ${number}
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }

      // Create driver icon
      const driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #dc2626;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            🚛
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

      // Get route between two points using OSRM
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

      // Process route stops
      const routeCoords: [number, number][] = []
      for (let i = 0; i < route.length; i++) {
        const address = route[i]
        const delivery = deliveryStatus[address]
        
        try {
          const coords = await geocodeAddress(address)
          if (coords) {
            const coordPair: [number, number] = [coords.lat, coords.lng]
            routeCoords.push(coordPair)
            bounds.push(coordPair)

            // Create marker based on position and status
            const isDepot = i === 0 || i === route.length - 1
            let icon: any

            if (isDepot) {
              icon = depotIcon
            } else {
              const status = delivery?.status || 'pending'
              icon = createStopIcon(status, i)
            }

            try {
              if (!map || !mapRef.current) return
              const marker = L.marker(coordPair, { icon }).addTo(map)
              
              const popupContent = `
                <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                  <div style="font-weight: bold; margin-bottom: 8px; color: #8B5CF6;">
                    ${isDepot ? 'Depot Location' : `Stop ${i}`}
                  </div>
                  <div style="font-size: 13px; margin-bottom: 4px;">📍 ${address}</div>
                  ${!isDepot && delivery ? `
                    <div style="font-size: 13px; margin-bottom: 4px;">Status: ${delivery.status}</div>
                    ${delivery.notes ? `<div style="font-size: 13px;">Notes: ${delivery.notes}</div>` : ''}
                  ` : ''}
                </div>
              `
              marker.bindPopup(popupContent)
              markers.push(marker)
            } catch (markerError) {
              console.error(`Error creating marker for ${address}:`, markerError)
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
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8
        }).addTo(map)
      }

      // Add driver location if available
      if (driverLocation) {
        const driverCoords: [number, number] = [driverLocation.latitude, driverLocation.longitude]
        bounds.push(driverCoords)

        // Add accuracy circle
        L.circle(driverCoords, {
          radius: driverLocation.accuracy,
          fillColor: '#3b82f6',
          color: '#3b82f6',
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.1
        }).addTo(map)

        // Add driver marker
        try {
          if (!map || !mapRef.current) return
          const driverMarker = L.marker(driverCoords, { icon: driverIcon }).addTo(map)
          
          const driverPopupContent = `
            <div style="background: #2A2A2A; color: white; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="font-weight: bold; margin-bottom: 8px; color: #dc2626;">🚛 Driver Location</div>
              <div style="font-size: 13px;">Lat: ${driverLocation.latitude.toFixed(6)}</div>
              <div style="font-size: 13px;">Lng: ${driverLocation.longitude.toFixed(6)}</div>
              <div style="font-size: 13px;">Accuracy: ${driverLocation.accuracy}m</div>
              <div style="font-size: 13px;">Updated: ${new Date(driverLocation.last_updated).toLocaleString()}</div>
            </div>
          `
          driverMarker.bindPopup(driverPopupContent)
          markers.push(driverMarker)
        } catch (driverMarkerError) {
          console.error('Error creating driver marker:', driverMarkerError)
        }
      }

      // Fit map to bounds
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] })
      }
      
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
        try {
          mapInstanceRef.current.remove()
        } catch (error) {
          console.error('Error removing map:', error)
        }
        mapInstanceRef.current = null
      }
    }
  }, [isMounted, route, depot, deliveryStatus, driverLocation])

  // Don't render anything until mounted on client
  if (!isMounted) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute inset-0 bg-zinc-900 rounded-lg flex items-center justify-center z-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
            <p className="text-zinc-400 text-sm">Initializing map...</p>
          </div>
        </div>
      </div>
    )
  }

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
      {!route.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 rounded-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-zinc-400">No route data available</p>
          </div>
        </div>
      )}
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