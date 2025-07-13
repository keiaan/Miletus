'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Download, 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Filter,
  MapPin,
  Clock,
  Truck,
  Users,
  User
} from 'lucide-react'
import Navigation, { BurgerButton } from '../../components/Navigation'
import axios from 'axios'

interface ReportData {
  totalRoutes: number
  totalDistance: number
  totalTime: number
  totalStops: number
  uniqueDrivers: number
  averageStopsPerRoute: number
  averageDistancePerRoute: number
  averageTimePerRoute: number
  routesByStatus: { [key: string]: number }
  routesByDriver: { [key: string]: number }
  monthlyStats: { [key: string]: number }
}

export default function ReportsPage() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30') // days
  const [selectedMetric, setSelectedMetric] = useState('routes')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchReportData = async () => {
    try {
      setIsLoading(true)
      // Since there's no specific report endpoint, we'll use route audit data
      const response = await axios.get('http://localhost:5001/route_audit', {
        withCredentials: true
      })
      
      const routes = response.data.routes || []
      
      // Calculate analytics from route data
      const analytics: ReportData = {
        totalRoutes: routes.length,
        totalDistance: routes.reduce((sum: number, route: any) => {
          const distance = parseFloat(route.total_distance?.replace(/[^\d.]/g, '') || '0')
          return sum + distance
        }, 0),
        totalTime: routes.reduce((sum: number, route: any) => {
          const time = parseFloat(route.total_time?.replace(/[^\d.]/g, '') || '0')
          return sum + time
        }, 0),
        totalStops: routes.reduce((sum: number, route: any) => sum + (route.num_stops || 0), 0),
        uniqueDrivers: new Set(routes.map((route: any) => route.driver)).size,
        averageStopsPerRoute: routes.length ? routes.reduce((sum: number, route: any) => sum + (route.num_stops || 0), 0) / routes.length : 0,
        averageDistancePerRoute: routes.length ? routes.reduce((sum: number, route: any) => {
          const distance = parseFloat(route.total_distance?.replace(/[^\d.]/g, '') || '0')
          return sum + distance
        }, 0) / routes.length : 0,
        averageTimePerRoute: routes.length ? routes.reduce((sum: number, route: any) => {
          const time = parseFloat(route.total_time?.replace(/[^\d.]/g, '') || '0')
          return sum + time
        }, 0) / routes.length : 0,
        routesByStatus: routes.reduce((acc: any, route: any) => {
          acc[route.status || 'unknown'] = (acc[route.status || 'unknown'] || 0) + 1
          return acc
        }, {}),
        routesByDriver: routes.reduce((acc: any, route: any) => {
          acc[route.driver] = (acc[route.driver] || 0) + 1
          return acc
        }, {}),
        monthlyStats: {} // Would need date parsing for monthly stats
      }
      
      setReportData(analytics)
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [dateRange])

  const exportReport = async (format: 'pdf' | 'csv') => {
    try {
      if (format === 'csv') {
        // Export route audit as CSV
        const response = await axios.get('http://localhost:5001/route_audit/download/csv', {
          withCredentials: true,
          responseType: 'blob'
        })
        
        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `route_report_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        // For PDF, we'd need to generate it client-side or have a backend endpoint
        console.log('PDF export would be implemented here')
      }
    } catch (error) {
      console.error('Error exporting report:', error)
    }
  }

  const formatNumber = (num: number, decimals = 1) => {
    return num.toFixed(decimals).replace(/\.0$/, '')
  }

  const getTopDrivers = () => {
    if (!reportData) return []
    return Object.entries(reportData.routesByDriver)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="reports" 
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
                <h1 className="text-xl font-semibold text-white">Reports & Analytics</h1>
                <p className="text-sm text-zinc-400">Route performance insights</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
              <button
                onClick={() => exportReport('csv')}
                className="flex items-center space-x-2 bg-white hover:bg-zinc-100 text-black font-medium px-4 py-2 rounded-lg transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
              <p className="text-zinc-400">Loading analytics...</p>
            </div>
          </div>
        ) : !reportData ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
            <p className="text-zinc-400">Complete some routes to see analytics</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium">Total Routes</span>
                  <Truck className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-3xl font-bold text-white">{reportData.totalRoutes}</p>
                <p className="text-sm text-zinc-500 mt-1">All time routes completed</p>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium">Total Distance</span>
                  <MapPin className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-3xl font-bold text-white">{formatNumber(reportData.totalDistance)}</p>
                <p className="text-sm text-zinc-500 mt-1">Miles driven</p>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium">Total Deliveries</span>
                  <MapPin className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-3xl font-bold text-white">{reportData.totalStops}</p>
                <p className="text-sm text-zinc-500 mt-1">Successful deliveries</p>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium">Active Drivers</span>
                  <Users className="w-5 h-5 text-zinc-400" />
                </div>
                <p className="text-3xl font-bold text-white">{reportData.uniqueDrivers}</p>
                <p className="text-sm text-zinc-500 mt-1">Unique drivers</p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Average Performance</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Stops per Route</span>
                    <span className="text-white font-semibold">{formatNumber(reportData.averageStopsPerRoute)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Distance per Route</span>
                    <span className="text-white font-semibold">{formatNumber(reportData.averageDistancePerRoute)} mi</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Time per Route</span>
                    <span className="text-white font-semibold">{formatNumber(reportData.averageTimePerRoute)} hrs</span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Route Status</h3>
                <div className="space-y-3">
                  {Object.entries(reportData.routesByStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-zinc-400 capitalize">{status}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-zinc-700 rounded-full h-2">
                          <div 
                            className="bg-white h-2 rounded-full"
                            style={{ width: `${(count / reportData.totalRoutes) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-white font-semibold w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Top Drivers</h3>
                <div className="space-y-3">
                  {getTopDrivers().map(([driver, routes], index) => (
                    <div key={driver} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center text-xs text-white font-bold">
                          {index + 1}
                        </span>
                        <span className="text-zinc-300">{driver}</span>
                      </div>
                      <span className="text-white font-semibold">{routes}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detailed Analytics */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Detailed Analytics</h3>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                >
                  <option value="routes">Routes</option>
                  <option value="distance">Distance</option>
                  <option value="time">Time</option>
                  <option value="efficiency">Efficiency</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-medium mb-3">Driver Performance</h4>
                  <div className="space-y-2">
                    {Object.entries(reportData.routesByDriver).map(([driver, routes]) => (
                      <div key={driver} className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg">
                        <span className="text-zinc-300">{driver}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-24 bg-zinc-700 rounded-full h-2">
                            <div 
                              className="bg-white h-2 rounded-full"
                              style={{ width: `${(routes / Math.max(...Object.values(reportData.routesByDriver))) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-white font-semibold w-8 text-right">{routes}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-white font-medium mb-3">Efficiency Metrics</h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-800 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-zinc-400">Routes per Driver</span>
                        <span className="text-white font-semibold">
                          {formatNumber(reportData.totalRoutes / Math.max(reportData.uniqueDrivers, 1))}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-zinc-800 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-zinc-400">Avg Stops per Mile</span>
                        <span className="text-white font-semibold">
                          {formatNumber(reportData.totalStops / Math.max(reportData.totalDistance, 1))}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}