'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft,
  MapPin, 
  Clock, 
  Truck,
  Calendar,
  BarChart3,
  Download,
  ExternalLink,
  Package,
  User,
  Route as RouteIcon
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import dynamic from 'next/dynamic'

// Dynamically import map component
const RouteMap = dynamic(() => import('../../../components/RouteMap'), { ssr: false })

interface RouteDetail {
  route_id: string
  date: string
  driver: string
  total_distance: string
  total_time: string
  num_stops: number
  company: string
  status: string
  route: string[]
  google_maps?: string
  apple_maps?: string
  created_at?: string
  delivery_status?: any
}

export default function RouteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const routeId = params.id as string
  const [routeDetail, setRouteDetail] = useState<RouteDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchRouteDetail = async () => {
    try {
      setIsLoading(true)
      console.log('Fetching route detail for:', routeId)
      
      // Try the route audit detail endpoint first
      const response = await axios.get(`http://localhost:5001/api/route_audit/${routeId}`, {
        withCredentials: true
      })
      
      setRouteDetail(response.data)
    } catch (error) {
      console.error('Error fetching route detail:', error)
      setError('Failed to load route details')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (routeId) {
      fetchRouteDetail()
    }
  }, [routeId])

  const downloadRouteData = async (format: 'csv' | 'json') => {
    try {
      const response = await axios.get(`http://localhost:5001/route_audit/${routeId}/download/${format}`, {
        withCredentials: true,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `route_${routeId}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading route data:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
          <p className="text-zinc-400">Loading route details...</p>
        </div>
      </div>
    )
  }

  if (error || !routeDetail) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <RouteIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Route Not Found</h1>
          <p className="text-zinc-400 mb-4">{error || 'The requested route could not be found.'}</p>
          <button 
            onClick={() => router.back()}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
          >
            Go Back
          </button>
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
              <button
                onClick={() => router.back()}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors duration-200"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <RouteIcon className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Route {routeDetail.route_id}</h1>
                <p className="text-sm text-zinc-400">Route Details & History</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => downloadRouteData('csv')}
                className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg border border-zinc-700 transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => downloadRouteData('json')}
                className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg border border-zinc-700 transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>JSON</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Route Information */}
          <div className="space-y-6">
            {/* Route Summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Route Summary</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Driver</p>
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-zinc-400" />
                    <p className="text-white font-medium">{routeDetail.driver}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Date</p>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <p className="text-white font-medium">{routeDetail.date}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Total Distance</p>
                  <p className="text-lg font-semibold text-white">{routeDetail.total_distance}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Total Time</p>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <p className="text-lg font-semibold text-white">{routeDetail.total_time}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Number of Stops</p>
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-zinc-400" />
                    <p className="text-lg font-semibold text-white">{routeDetail.num_stops}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    routeDetail.status === 'completed' ? 'bg-green-700 text-green-100' :
                    routeDetail.status === 'active' ? 'bg-blue-700 text-blue-100' :
                    'bg-zinc-700 text-zinc-100'
                  }`}>
                    {routeDetail.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {(routeDetail.google_maps || routeDetail.apple_maps) && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Navigation</h2>
                <div className="grid grid-cols-2 gap-4">
                  {routeDetail.google_maps && (
                    <a
                      href={routeDetail.google_maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Google Maps</span>
                    </a>
                  )}
                  {routeDetail.apple_maps && (
                    <a
                      href={routeDetail.apple_maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors duration-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Apple Maps</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Route Stops */}
            {routeDetail.route && routeDetail.route.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Route Stops</h2>
                
                <div className="space-y-3">
                  {routeDetail.route.map((address, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-zinc-800 rounded-lg">
                      <div className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{address}</p>
                        <p className="text-zinc-400 text-xs mt-1">
                          {index === 0 ? 'Start Location' : 
                           index === routeDetail.route.length - 1 ? 'End Location' : 
                           'Delivery Stop'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Route Visualization</h2>
            
            {routeDetail.route && routeDetail.route.length > 0 ? (
              <div className="h-[600px] rounded-lg overflow-hidden">
                <RouteMap 
                  routes={[{
                    driver: routeDetail.driver,
                    route: routeDetail.route,
                    total_time: routeDetail.total_time,
                    total_distance: routeDetail.total_distance,
                    num_stops: routeDetail.num_stops
                  }]}
                  depot={routeDetail.route[0]} 
                  missedAddresses={[]}
                />
              </div>
            ) : (
              <div className="h-[600px] bg-zinc-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Route Data</h3>
                  <p className="text-zinc-400">Route visualization unavailable</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}