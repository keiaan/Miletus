'use client'

import React, { useState, useEffect } from 'react'
import { 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Truck,
  Navigation as NavigationIcon,
  RefreshCw,
  Play,
  Square,
  ExternalLink,
  Package,
  User,
  Phone,
  MessageSquare,
  Camera,
  X
} from 'lucide-react'
import { useParams } from 'next/navigation'
import axios from 'axios'

interface DeliveryStop {
  address: string
  status: 'pending' | 'completed' | 'failed'
  notes?: string
  timestamp?: string
}

interface RouteData {
  route_id: string
  driver: string
  route: string[]
  total_time: string
  total_distance: string
  num_stops: number
  status: string
  start_time?: string
  estimated_completion?: string
  deliveries: DeliveryStop[]
  current_location?: { lat: number; lng: number }
}

export default function DriverViewPage() {
  const params = useParams()
  const routeId = params.id as string
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [selectedStop, setSelectedStop] = useState<number | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [elapsedTime, setElapsedTime] = useState('00:00')

  const fetchRouteData = async () => {
    try {
      console.log('Fetching route data for:', routeId)
      
      const response = await axios.get(`http://localhost:5001/route/${routeId}/status`, {
        withCredentials: true,
        timeout: 10000
      })
      console.log('Flask response:', response.data)
      const flaskResponse = response.data
      
      // Validate response structure
      if (!flaskResponse || typeof flaskResponse !== 'object') {
        throw new Error('Invalid response format')
      }
      
      // Handle different response structures
      let routeInfo = {}
      let deliveryData = {}
      
      if (flaskResponse.route_data) {
        routeInfo = flaskResponse.route_data
      } else if (flaskResponse.route_id) {
        // Direct route data format
        routeInfo = flaskResponse
      }
      
      if (flaskResponse.delivery_status) {
        deliveryData = flaskResponse.delivery_status
      }
      
      // Create deliveries array from route addresses
      const routeAddresses = Array.isArray(routeInfo.route) ? routeInfo.route : []
      const deliveryStatus = deliveryData.deliveries || {}
      
      const deliveries = routeAddresses.map((address: string, index: number) => {
        const delivery = deliveryStatus[address] || {}
        return {
          address,
          status: delivery.status || 'pending',
          notes: delivery.notes || '',
          timestamp: delivery.timestamp || ''
        }
      })
      
      // Transform to match expected interface
      const transformedData = {
        route_id: flaskResponse.route_id || routeId,
        driver: routeInfo.driver_name || 'Unknown Driver',
        route: routeAddresses,
        total_time: routeInfo.total_time || '',
        total_distance: routeInfo.total_distance || '',
        num_stops: routeInfo.num_stops || routeAddresses.length,
        status: routeInfo.status || 'pending',
        start_time: flaskResponse.checkin_time || routeInfo.created_at,
        estimated_completion: '',
        deliveries,
        current_location: null
      }
      
      console.log('Transformed data:', transformedData)
      setRouteData(transformedData)
      setError('') // Clear any previous errors
      
      // Find current stop (first pending delivery)
      const pendingIndex = deliveries.findIndex(d => d.status === 'pending')
      if (pendingIndex !== -1) {
        setCurrentStopIndex(pendingIndex)
      }
    } catch (error: any) {
      console.error('Error fetching route data:', error)
      
      if (error.code === 'ECONNABORTED') {
        setError('Request timed out')
      } else if (error.response) {
        console.error('Response status:', error.response.status)
        console.error('Response data:', error.response.data)
        setError(`Failed to load route data: ${error.response.data?.error || error.message}`)
      } else if (error.request) {
        setError('Network error - please check your connection')
      } else {
        setError(`Failed to load route data: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (routeId) {
      fetchRouteData()
    }
  }, [routeId])

  useEffect(() => {
    if (!routeId) return
    
    // Auto-refresh every 30 seconds for live tracking
    const interval = setInterval(() => {
      if (!isLoading) {
        fetchRouteData()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [routeId])

  // Calculate elapsed time for active routes
  useEffect(() => {
    if (routeData?.start_time && routeData.status === 'active') {
      const timer = setInterval(() => {
        const startTime = new Date(routeData.start_time!)
        const now = new Date()
        const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        
        const hours = Math.floor(diff / 3600)
        const minutes = Math.floor((diff % 3600) / 60)
        
        if (hours > 0) {
          setElapsedTime(`${hours}h ${minutes}m`)
        } else {
          setElapsedTime(`${minutes}m`)
        }
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [routeData])

  const checkInToRoute = async () => {
    try {
      await axios.post(`http://localhost:5001/route/${routeId}/checkin`, {}, {
        withCredentials: true
      })
      updateLocation() // Update location on check-in
      fetchRouteData()
    } catch (error) {
      console.error('Error checking in:', error)
    }
  }

  const checkOutFromRoute = async () => {
    try {
      await axios.post(`http://localhost:5001/route/${routeId}/checkout`, {}, {
        withCredentials: true
      })
      fetchRouteData()
    } catch (error) {
      console.error('Error checking out:', error)
    }
  }

  const updateDeliveryStatus = async (status: 'completed' | 'failed', notes?: string) => {
    if (selectedStop === null) return
    
    try {
      await axios.post(`http://localhost:5001/route/${routeId}/update_delivery`, {
        delivery_index: selectedStop,
        status,
        notes: notes || deliveryNotes
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      
      // Update location after delivery update
      updateLocation()
      
      setShowDeliveryModal(false)
      setDeliveryNotes('')
      setSelectedStop(null)
      fetchRouteData()
    } catch (error) {
      console.error('Error updating delivery:', error)
    }
  }

  const updateLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          await axios.post(`http://localhost:5001/route/${routeId}/update_location`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          }, {
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error('Error updating location:', error)
        }
      })
    }
  }

  const openGoogleMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank')
  }

  const openAppleMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`http://maps.apple.com/?daddr=${encodedAddress}`, '_blank')
  }

  const openDeliveryModal = (stopIndex: number) => {
    setSelectedStop(stopIndex)
    setShowDeliveryModal(true)
    setDeliveryNotes('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400">Loading your route...</p>
        </div>
      </div>
    )
  }

  if (error || !routeData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Route Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The requested route could not be found.'}</p>
          <p className="text-sm text-gray-500 mb-4">Route ID: {routeId}</p>
          <button 
            onClick={() => {
              setError('')
              setIsLoading(true)
              fetchRouteData()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentStop = routeData.deliveries?.[currentStopIndex]
  const completedCount = routeData.deliveries?.filter(d => d.status === 'completed').length || 0
  const totalStops = routeData.num_stops
  const progressPercent = totalStops > 0 ? (completedCount / totalStops) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Professional Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Route {routeData.route_id}</h1>
              <p className="text-sm text-gray-600">{completedCount} of {totalStops} delivered</p>
            </div>
            
            {routeData.status === 'active' && (
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-900">Active</span>
                </div>
                <p className="text-xs text-gray-500">{elapsedTime}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Check In/Out Section */}
      {routeData.status === 'pending' && (
        <div className="p-6">
          <button
            onClick={checkInToRoute}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-colors"
          >
            Start Route
          </button>
        </div>
      )}

      {routeData.status === 'active' && (
        <>
          {/* Current Stop */}
          {currentStop && (
            <div className="p-6 bg-white border-b border-gray-200">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-600">NEXT STOP</span>
                  <span className="text-sm text-gray-500">Stop {currentStopIndex + 1}</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                  {currentStop.address}
                </h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => openGoogleMaps(currentStop.address)}
                  className="flex items-center justify-center space-x-2 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                >
                  <NavigationIcon className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Directions</span>
                </button>
                <button
                  onClick={() => openDeliveryModal(currentStopIndex)}
                  className="flex items-center justify-center space-x-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Package className="w-4 h-4" />
                  <span className="font-medium">Complete</span>
                </button>
              </div>
            </div>
          )}

          {/* Route Progress */}
          <div className="p-6 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Route Progress</h3>
              <span className="text-sm text-gray-600">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* All Stops */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">All Stops</h3>
            
            <div className="space-y-3">
              {routeData.route.map((address, index) => {
                const delivery = routeData.deliveries?.[index]
                const status = delivery?.status || 'pending'
                const isCurrent = index === currentStopIndex && status === 'pending'
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border transition-all ${
                      isCurrent 
                        ? 'border-blue-200 bg-blue-50' 
                        : status === 'completed'
                        ? 'border-green-200 bg-green-50'
                        : status === 'failed'
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        status === 'completed' ? 'bg-green-600 text-white' :
                        status === 'failed' ? 'bg-red-600 text-white' :
                        isCurrent ? 'bg-blue-600 text-white' :
                        'bg-gray-300 text-gray-700'
                      }`}>
                        {status === 'completed' ? '✓' : 
                         status === 'failed' ? '✗' : 
                         index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{address}</p>
                        {delivery?.notes && (
                          <p className="text-xs text-gray-600 mt-1">{delivery.notes}</p>
                        )}
                        {delivery?.timestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(delivery.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      
                      {status === 'pending' && !isCurrent && (
                        <button
                          onClick={() => openDeliveryModal(index)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={updateLocation}
                className="flex items-center justify-center space-x-2 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
              >
                <MapPin className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900">Update Location</span>
              </button>
              <button
                onClick={checkOutFromRoute}
                className="flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">End Route</span>
              </button>
            </div>
          </div>

          {/* Bottom spacing for fixed actions */}
          <div className="h-20"></div>
        </>
      )}

      {/* Delivery Completion Modal */}
      {showDeliveryModal && selectedStop !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Complete Delivery</h3>
                <button 
                  onClick={() => setShowDeliveryModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-gray-600 mb-4 text-sm">
                {routeData.route[selectedStop]}
              </p>
              
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Add notes (optional)..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 min-h-[80px] resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateDeliveryStatus('completed')}
                  className="flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Delivered</span>
                </button>
                <button
                  onClick={() => updateDeliveryStatus('failed')}
                  className="flex items-center justify-center space-x-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Failed</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}