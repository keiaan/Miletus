'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  Eye, 
  MapPin,
  Clock,
  Truck,
  BarChart3,
  User
} from 'lucide-react'
import Navigation, { BurgerButton } from '../../components/Navigation'
import axios from 'axios'

interface RouteHistoryItem {
  route_id: string
  date: string
  driver: string
  total_distance: string
  total_time: string
  num_stops: number
  company: string
  status: string
}

export default function RoutesPage() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [routes, setRoutes] = useState<RouteHistoryItem[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<RouteHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [drivers, setDrivers] = useState<string[]>([])
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchRouteHistory = async () => {
    try {
      setIsLoading(true)
      console.log('Fetching route history...')
      const response = await axios.get('http://localhost:5001/api/route_audit', {
        withCredentials: true
      })
      console.log('Route history response:', response.data)
      const routeData = response.data.routes || []
      setRoutes(routeData)
      setFilteredRoutes(routeData)
      
      // Extract unique drivers for filter
      const uniqueDrivers = [...new Set(routeData.map((route: RouteHistoryItem) => route.driver))] as string[]
      setDrivers(uniqueDrivers)
    } catch (error) {
      console.error('Error fetching route history:', error)
      if (error.response) {
        console.error('Response status:', error.response.status)
        console.error('Response data:', error.response.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRouteHistory()
  }, [])

  useEffect(() => {
    let filtered = routes

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(route => 
        route.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        route.route_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by driver
    if (selectedDriver) {
      filtered = filtered.filter(route => route.driver === selectedDriver)
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter(route => new Date(route.date) >= new Date(startDate))
    }
    if (endDate) {
      filtered = filtered.filter(route => new Date(route.date) <= new Date(endDate))
    }

    setFilteredRoutes(filtered)
  }, [searchTerm, selectedDriver, startDate, endDate, routes])

  const downloadReport = async (format: 'csv' | 'json') => {
    try {
      const response = await axios.get(`http://localhost:5001/route_audit/download/${format}`, {
        withCredentials: true,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `route_audit.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading report:', error)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedDriver('')
    setStartDate('')
    setEndDate('')
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="routes" 
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
                <FileText className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Route History</h1>
                <p className="text-sm text-zinc-400">View and export route audit logs</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => downloadReport('csv')}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-zinc-100 text-black font-medium rounded-lg transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => downloadReport('json')}
                className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg border border-zinc-700 transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Total Routes</span>
              <BarChart3 className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">{filteredRoutes.length}</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Total Distance</span>
              <MapPin className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {filteredRoutes.reduce((sum, route) => {
                const distance = parseFloat(route.total_distance.replace(/[^\d.]/g, ''))
                return sum + (isNaN(distance) ? 0 : distance)
              }, 0).toFixed(1)} mi
            </p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Total Stops</span>
              <MapPin className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {filteredRoutes.reduce((sum, route) => sum + route.num_stops, 0)}
            </p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Unique Drivers</span>
              <Truck className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {new Set(filteredRoutes.map(route => route.driver)).size}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <button
              onClick={clearFilters}
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Driver or Route ID"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Driver
              </label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
              >
                <option value="">All Drivers</option>
                {drivers.map(driver => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Routes Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Route History</h2>
            <p className="text-sm text-zinc-400">
              Showing {filteredRoutes.length} of {routes.length} routes
            </p>
          </div>
          
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                  <p className="text-zinc-400">Loading routes...</p>
                </div>
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Routes Found</h3>
                <p className="text-zinc-400">Try adjusting your filters or check back later</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Route ID</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Date</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Driver</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Distance</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Time</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Stops</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Status</th>
                    <th className="text-left py-3 px-6 text-zinc-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route, index) => (
                    <tr key={route.route_id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm text-white">{route.route_id}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-zinc-400" />
                          <span className="text-white">{route.date}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Truck className="w-4 h-4 text-zinc-400" />
                          <span className="text-white">{route.driver}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white">{route.total_distance}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-zinc-400" />
                          <span className="text-white">{route.total_time}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white">{route.num_stops}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          route.status === 'completed' ? 'bg-green-700 text-green-100' :
                          route.status === 'active' ? 'bg-blue-700 text-blue-100' :
                          'bg-zinc-700 text-zinc-100'
                        }`}>
                          {route.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => window.open(`/routes/${route.route_id}`, '_blank')}
                          className="inline-flex items-center space-x-1 text-sm text-zinc-400 hover:text-white transition-colors duration-200"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}