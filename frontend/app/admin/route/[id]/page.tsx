'use client'

import React, { useState, useEffect } from 'react'
import { 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Truck,
  Users,
  Navigation as NavigationIcon,
  RefreshCw,
  ExternalLink,
  Shield,
  Timer,
  Zap,
  Package,
  Route as RouteIcon,
  User
} from 'lucide-react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import dynamic from 'next/dynamic'

// Dynamically import map component
const AdminRouteMap = dynamic(() => import('../../../../components/AdminRouteMap'), { ssr: false })

interface DeliveryStop {
  address: string
  status: 'pending' | 'completed' | 'failed'
  notes?: string
  timestamp?: string
  package_count?: number
}

interface DriverLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
  last_updated: string
  nearby_address?: string
  distance_to_next?: string
}

interface RouteData {
  route_id: string
  driver_name: string
  route: string[]
  total_time: string
  total_distance: string
  num_stops: number
  created_at: string
  company_id: string
  stop_counts: Record<string, number>
  status: string
  checkin_time?: string
}

interface DeliveryStatus {
  deliveries: Record<string, DeliveryStop>
  route_id: string
  completed_count: number
  failed_count: number
  pending_count: number
  completion_rate: number
}

export default function AdminRouteTrackingPage() {
  const params = useParams()
  const routeId = params.id as string
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    // Load user info from localStorage
    const username = localStorage.getItem('username') || 'Admin'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchRouteData = async () => {
    try {
      setError('')
      const response = await axios.get(`http://localhost:5001/route/${routeId}/status`, {
        withCredentials: true
      })
      
      const flaskResponse = response.data
      const routeInfo = flaskResponse.route_data || {}
      
      // Transform route data
      const transformedRouteData: RouteData = {
        route_id: flaskResponse.route_id || routeId,
        driver_name: routeInfo.driver_name || 'Unknown Driver',
        route: routeInfo.route || [],
        total_time: routeInfo.total_time || '',
        total_distance: routeInfo.total_distance || '',
        num_stops: routeInfo.num_stops || 0,
        created_at: routeInfo.created_at || '',
        company_id: routeInfo.company_id || '',
        stop_counts: routeInfo.stop_counts || {},
        status: routeInfo.status || 'pending',
        checkin_time: flaskResponse.checkin_time
      }
      
      // Transform delivery status
      const deliveryData = flaskResponse.delivery_status
      if (deliveryData) {
        const deliveries = deliveryData.deliveries || {}
        const completed = Object.values(deliveries).filter((d: any) => d.status === 'completed').length
        const failed = Object.values(deliveries).filter((d: any) => d.status === 'failed').length
        const pending = Object.values(deliveries).filter((d: any) => d.status === 'pending').length
        
        setDeliveryStatus({
          deliveries,
          route_id: routeId,
          completed_count: completed,
          failed_count: failed,
          pending_count: pending,
          completion_rate: routeInfo.num_stops > 0 ? (completed / routeInfo.num_stops) * 100 : 0
        })
      }
      
      setRouteData(transformedRouteData)
    } catch (error) {
      console.error('Error fetching route data:', error)
      setError('Failed to load route data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDriverLocation = async () => {
    try {
      const response = await axios.get(`http://localhost:5001/route/${routeId}/location`, {
        withCredentials: true
      })
      
      if (response.data && response.data.latitude) {
        setDriverLocation(response.data)
      }
    } catch (error) {
      console.error('Error fetching driver location:', error)
    }
  }

  useEffect(() => {
    if (routeId) {
      fetchRouteData()
      fetchDriverLocation()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchRouteData()
        fetchDriverLocation()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [routeId])

  // Calculate elapsed time for active routes
  useEffect(() => {
    if (routeData?.checkin_time && routeData.status === 'active') {
      const timer = setInterval(() => {
        const startTime = new Date(routeData.checkin_time!)
        const now = new Date()
        const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0')
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
        const seconds = (diff % 60).toString().padStart(2, '0')
        
        setElapsedTime(`${hours}:${minutes}:${seconds}`)
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [routeData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'failed': return 'text-red-400'
      case 'active': return 'text-blue-400'
      default: return 'text-zinc-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'active': return <Truck className="w-5 h-5 text-blue-400" />
      default: return <Clock className="w-5 h-5 text-zinc-400" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
          <p className="text-zinc-400">Loading admin route data...</p>
        </div>
      </div>
    )
  }

  if (error || !routeData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Route Not Found</h1>
          <p className="text-zinc-400">{error || 'The requested route could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Admin Route Control</h1>
                <p className="text-sm text-zinc-400">Route {routeData.route_id} - {routeData.driver_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.open(`/route/${routeId}`, '_blank')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors duration-200"
              >
                <ExternalLink className="w-4 h-4 text-white" />
                <span className="text-sm text-white">Driver View</span>
              </button>
              <button
                onClick={() => {
                  fetchRouteData()
                  fetchDriverLocation()
                }}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors duration-200"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center space-x-3 px-4 py-2 bg-zinc-900/50 rounded-xl border border-zinc-700/50">
                <User className="w-4 h-4 text-zinc-400" />
                <div className="text-sm">
                  <span className="text-white font-semibold">{userInfo.username}</span>
                  <span className="text-zinc-400 ml-2">({userInfo.company})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Real-time Status Banner */}
        {routeData.status === 'active' && (
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Route Active</h2>
                  <p className="text-green-100">Driver has been on route for {elapsedTime}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{Math.round(deliveryStatus?.completion_rate || 0)}%</p>
                <p className="text-green-100 text-sm">Complete</p>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="w-full bg-green-800 rounded-full h-3">
                <div 
                  className="bg-white h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${deliveryStatus?.completion_rate || 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm mt-2 text-green-100">
                <span>{deliveryStatus?.completed_count || 0} deliveries completed</span>
                <span>{deliveryStatus?.pending_count || 0} remaining</span>
              </div>
            </div>
          </div>
        )}

        {/* Route Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Route Status</span>
              {getStatusIcon(routeData.status)}
            </div>
            <p className={`text-lg font-bold ${getStatusColor(routeData.status)}`}>
              {routeData.status.toUpperCase()}
            </p>
            {routeData.status === 'active' && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Elapsed Time</span>
              <Timer className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {routeData.status === 'active' ? elapsedTime : 'Not Started'}
            </p>
            {routeData.checkin_time && (
              <p className="text-xs text-zinc-500 mt-1">
                Started: {new Date(routeData.checkin_time).toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Progress</span>
              <Package className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {deliveryStatus?.completed_count || 0}/{routeData.num_stops}
            </p>
            <div className="mt-2">
              <div className="w-full bg-zinc-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${deliveryStatus?.completion_rate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Driver Location</span>
              <MapPin className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-lg font-bold text-white">
              {driverLocation ? (
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>Live GPS</span>
                </span>
              ) : (
                <span className="text-zinc-500">No Signal</span>
              )}
            </p>
            {driverLocation && (
              <p className="text-xs text-zinc-400 mt-1">
                Accuracy: {driverLocation.accuracy}m
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Route Information */}
          <div className="space-y-6">
            {/* Route Details */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <RouteIcon className="w-5 h-5 mr-2" />
                Route Details
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Driver</p>
                    <p className="text-white font-medium">{routeData.driver_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Route ID</p>
                    <p className="text-white font-mono text-sm">{routeData.route_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Distance</p>
                    <p className="text-white font-medium">{routeData.total_distance}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Est. Time</p>
                    <p className="text-white font-medium">{routeData.total_time}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Total Stops</p>
                    <p className="text-white font-medium">{routeData.num_stops}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">Created</p>
                    <p className="text-white font-medium">
                      {routeData.created_at ? new Date(routeData.created_at).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                </div>

                {routeData.checkin_time && (
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-sm text-zinc-400 mb-1">Started</p>
                    <p className="text-white font-medium">
                      {new Date(routeData.checkin_time).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Driver Location */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Driver Location
              </h2>
              
              {driverLocation ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium">GPS Active</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-400">Latitude</p>
                      <p className="text-white font-mono">{driverLocation.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Longitude</p>
                      <p className="text-white font-mono">{driverLocation.longitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Accuracy</p>
                      <p className="text-white">{driverLocation.accuracy}m</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Last Update</p>
                      <p className="text-white">{new Date(driverLocation.last_updated).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {driverLocation.nearby_address && (
                    <div className="pt-3 border-t border-zinc-800">
                      <p className="text-zinc-400 text-sm">Nearby Address</p>
                      <p className="text-white">{driverLocation.nearby_address}</p>
                    </div>
                  )}

                  {driverLocation.distance_to_next && (
                    <div>
                      <p className="text-zinc-400 text-sm">Distance to Next Stop</p>
                      <p className="text-white">{driverLocation.distance_to_next}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MapPin className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400">No GPS data available</p>
                  <p className="text-zinc-500 text-sm">Driver location will appear when available</p>
                </div>
              )}
            </div>

            {/* Delivery Progress */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Delivery Progress
              </h2>
              
              {deliveryStatus && (
                <div className="space-y-4">
                  <div className="w-full bg-zinc-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${deliveryStatus.completion_rate}%` }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-400">{deliveryStatus.completed_count}</p>
                      <p className="text-sm text-zinc-400">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">{deliveryStatus.failed_count}</p>
                      <p className="text-sm text-zinc-400">Failed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-400">{deliveryStatus.pending_count}</p>
                      <p className="text-sm text-zinc-400">Pending</p>
                    </div>
                  </div>

                  {Object.keys(deliveryStatus.deliveries).length > 0 && (
                    <div className="pt-4 border-t border-zinc-800">
                      <h4 className="text-sm font-medium text-zinc-300 mb-3">Recent Updates</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {Object.entries(deliveryStatus.deliveries).map(([address, delivery], index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <span className="text-white">{address.length > 50 ? address.slice(0, 50) + '...' : address}</span>
                              {delivery.notes && (
                                <div className="text-zinc-400 text-xs mt-1">{delivery.notes}</div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                delivery.status === 'completed' ? 'bg-green-700 text-green-100' :
                                delivery.status === 'failed' ? 'bg-red-700 text-red-100' :
                                'bg-orange-700 text-orange-100'
                              }`}>
                                {delivery.status}
                              </span>
                              {delivery.timestamp && (
                                <span className="text-zinc-500 text-xs">
                                  {new Date(delivery.timestamp).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Route Map */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <NavigationIcon className="w-5 h-5 mr-2" />
                Live Route Map
              </h2>
              <button
                onClick={fetchDriverLocation}
                className="flex items-center space-x-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors duration-200"
              >
                <RefreshCw className="w-4 h-4 text-white" />
                <span className="text-sm text-white">Refresh Location</span>
              </button>
            </div>
            
            <div className="h-[600px] rounded-lg overflow-hidden">
              <AdminRouteMap 
                route={routeData.route}
                driverLocation={driverLocation}
                deliveryStatus={deliveryStatus?.deliveries || {}}
                depot={routeData.route[0]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}