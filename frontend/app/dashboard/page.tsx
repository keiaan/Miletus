'use client'

import React, { useState, useEffect } from 'react'
import { 
  BarChart3, 
  Route, 
  Clock, 
  MapPin, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  Eye,
  Trash2,
  RefreshCw,
  User,
  Shield,
  ExternalLink
} from 'lucide-react'
import Navigation, { BurgerButton } from '../../components/Navigation'
import axios from 'axios'

interface DashboardRoute {
  route_id: string
  driver: string
  status: string
  progress: number
  total_stops: number
  completed_stops: number
  start_time: string
  estimated_completion: string
  company: string
}

export default function DashboardPage() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [routes, setRoutes] = useState<DashboardRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    // Load user info from localStorage
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError('')
      const response = await axios.get('http://localhost:5001/api/dashboard', {
        withCredentials: true
      })
      setRoutes(response.data.routes || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const removeRoute = async (routeId: string) => {
    try {
      await axios.post(`http://localhost:5001/remove_from_dashboard/${routeId}`, {}, {
        withCredentials: true
      })
      setRoutes(routes.filter(route => route.route_id !== routeId))
    } catch (error) {
      console.error('Error removing route:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      case 'delayed': return 'bg-red-500'
      default: return 'bg-zinc-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return <Truck className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'delayed': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="dashboard" 
        isOpen={isNavOpen} 
        onToggle={() => setIsNavOpen(!isNavOpen)} 
      />
      
      {/* Header */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BurgerButton 
                isOpen={isNavOpen} 
                onToggle={() => setIsNavOpen(!isNavOpen)} 
              />
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Delivery Dashboard</h1>
                <p className="text-sm text-zinc-400">Live Route Tracking</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchDashboardData}
                className="flex items-center space-x-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors duration-200"
              >
                <RefreshCw className="w-4 h-4 text-white" />
                <span className="text-sm text-white font-medium">Refresh</span>
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
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Total Routes</span>
              <Route className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">{routes.length}</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Active Routes</span>
              <Truck className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {routes.filter(r => r.status.toLowerCase() === 'active').length}
            </p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Completed</span>
              <CheckCircle className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {routes.filter(r => r.status.toLowerCase() === 'completed').length}
            </p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Total Stops</span>
              <MapPin className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {routes.reduce((sum, route) => sum + route.total_stops, 0)}
            </p>
          </div>
        </div>

        {/* Routes List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Active Routes</h2>
            <p className="text-sm text-zinc-400">Monitor and manage delivery routes</p>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                  <p className="text-zinc-400">Loading routes...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            ) : routes.length === 0 ? (
              <div className="text-center py-12">
                <Route className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Active Routes</h3>
                <p className="text-zinc-400">Routes will appear here when they're added to the dashboard</p>
              </div>
            ) : (
              <div className="space-y-4">
                {routes.map((route) => (
                  <div key={route.route_id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 ${getStatusColor(route.status)} rounded-lg flex items-center justify-center text-white`}>
                          {getStatusIcon(route.status)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{route.driver}</h3>
                          <p className="text-sm text-zinc-400">Route ID: {route.route_id}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => window.open(`/route/${route.route_id}`, '_blank')}
                          className="flex items-center space-x-1 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition-colors duration-200 text-sm"
                          title="Driver View"
                        >
                          <ExternalLink className="w-4 h-4 text-white" />
                          <span className="text-white">Driver</span>
                        </button>
                        <button
                          onClick={() => window.open(`/admin/route/${route.route_id}`, '_blank')}
                          className="flex items-center space-x-1 px-3 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors duration-200 text-sm"
                          title="Admin View"
                        >
                          <Shield className="w-4 h-4 text-white" />
                          <span className="text-white">Admin</span>
                        </button>
                        <button
                          onClick={() => removeRoute(route.route_id)}
                          className="p-2 bg-red-700 hover:bg-red-600 rounded-lg transition-colors duration-200"
                          title="Remove Route"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Progress</p>
                        <div className="w-full bg-zinc-700 rounded-full h-2">
                          <div 
                            className="bg-white h-2 rounded-full transition-all duration-300"
                            style={{ width: `${route.progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1">{route.progress}%</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Stops</p>
                        <p className="text-sm font-medium text-white">
                          {route.completed_stops}/{route.total_stops}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Started</p>
                        <p className="text-sm text-white">{route.start_time}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">ETA</p>
                        <p className="text-sm text-white">{route.estimated_completion}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(route.status)}`}>
                        {route.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-400">{route.company}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}