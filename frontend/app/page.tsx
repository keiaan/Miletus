'use client'

import React, { useState, useEffect } from 'react'
import { 
  Route, 
  MapPin, 
  Clock, 
  Users, 
  Warehouse, 
  Plus, 
  Trash2, 
  Upload, 
  Download,
  Navigation as NavigationIcon,
  Loader,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Zap,
  TrendingUp,
  Activity,
  User,
  Settings,
  X
} from 'lucide-react'
import axios from 'axios'
import dynamic from 'next/dynamic'
import AddressInput from '../components/AddressInput'
import Navigation, { BurgerButton } from '../components/Navigation'

// Dynamically import components that use browser APIs
const RouteMap = dynamic(() => import('../components/RouteMap'), { ssr: false })

interface RouteSettings {
  max_miles: number
  max_time: number
  max_stops: number
}

interface Driver {
  name: string
  phone: string
}

interface RouteResult {
  driver: string
  route: string[]
  total_time: string
  total_distance: string
  num_stops: number
  google_maps: string
  apple_maps: string
  stop_counts: { [key: string]: number }
}

interface OptimizationResult {
  results: RouteResult[]
  missed_addresses: [string, string][]
  num_drivers_used: number
  total_addresses_served: number
}

export default function HomePage() {
  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    max_miles: 100,
    max_time: 8,
    max_stops: 20
  })
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availableDrivers, setAvailableDrivers] = useState(0)
  const [mainDepot, setMainDepot] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [addresses, setAddresses] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'database'>('manual')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentQuirk, setCurrentQuirk] = useState('')
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })
  const [isAddedToDashboard, setIsAddedToDashboard] = useState(false)
  const [isEditingSettings, setIsEditingSettings] = useState(false)

  useEffect(() => {
    // Load company depot and user info from localStorage
    const companyDepot = localStorage.getItem('company_depot') || 'Redditch, Worcestershire, UK'
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    
    setMainDepot(companyDepot)
    setUserInfo({ username, company })
    
    // Load route settings from Flask backend
    fetchRouteSettings()
  }, [])

  const fetchRouteSettings = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/route_parameters', {
        withCredentials: true
      })
      if (response.data.settings) {
        setRouteSettings(response.data.settings)
      }
      if (response.data.available_drivers !== undefined) {
        setAvailableDrivers(response.data.available_drivers)
      }
    } catch (error) {
      console.error('Error loading route parameters:', error)
    }
  }

  const saveRouteSettings = async (settings: RouteSettings) => {
    try {
      await axios.post('http://localhost:5001/api/route_settings', settings, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      setSuccess('Route settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError('Failed to save route settings')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleSettingsChange = (field: keyof RouteSettings, value: number) => {
    setRouteSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveSettings = async () => {
    await saveRouteSettings(routeSettings)
    setIsEditingSettings(false)
    // Refresh route parameters to get updated driver counts
    await fetchRouteSettings()
  }

  const quirkMessages = [
    "Untangling the spaghetti of routes...",
    "Teaching our pigeons to read maps...",
    "Consulting with the GPS gnomes...",
    "Bribing traffic lights for green waves...",
    "Calculating shortest path through space-time continuum...",
    "Rerouting to avoid dragon nests...",
    "Syncing quantum entangled delivery trucks...",
    "Negotiating with traffic cone unions...",
    "Recalibrating flux capacitors for optimal delivery times...",
    "Applying chaos theory to traffic patterns..."
  ]

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setRouteSettings({
          max_miles: 100,
          max_time: 8,
          max_stops: 20
        })
        setDrivers([
          { name: 'John Smith', phone: '07123456789' },
          { name: 'Jane Doe', phone: '07987654321' },
          { name: 'Mike Wilson', phone: '07555123456' }
        ])
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  const addAddress = () => {
    if (deliveryAddress.trim() && !addresses.includes(deliveryAddress.trim())) {
      setAddresses([...addresses, deliveryAddress.trim()])
      setDeliveryAddress('')
      setSuccess('Address added successfully!')
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const removeAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addAddress()
    }
  }

  const resetDepot = () => {
    setMainDepot('Redditch, Worcestershire, UK')
    setSuccess('Depot address reset to company default')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleAddressSelect = (place: any) => {
    if (place.formatted_address) {
      setDeliveryAddress(place.formatted_address)
    }
  }

  const handleDepotSelect = (place: any) => {
    if (place.formatted_address) {
      setMainDepot(place.formatted_address)
    }
  }

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = text.split('\n').map(row => 
          row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        )

        if (rows.length < 2) {
          setError('CSV file must contain at least a header row and one data row')
          return
        }

        const processedData = rows.slice(1).map((row, index) => ({
          id: index,
          reference: row[0] || '',
          site: row[1] || '',
          client: row[3] || '',
          address: [row[4], row[7], row[6]].filter(Boolean).join(', ')
        })).filter(item => item.address)

        setCsvData(processedData)
        const newAddresses = processedData.map(item => item.address)
        setAddresses(newAddresses)
        setSuccess(`Loaded ${newAddresses.length} addresses from CSV`)
        setTimeout(() => setSuccess(''), 3000)
      } catch (error) {
        setError('Error processing CSV file. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const headers = [
      'Ticket Reference/WO Number',
      'Site Name',
      'Site Number',
      'Client',
      'Address Line 1',
      'Address Line 2',
      'Postcode',
      'City',
      'Created Date',
      'SLA Date'
    ]
    const csvContent = headers.join(',') + '\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'route_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const optimizeRoutes = async () => {
    if (!mainDepot || addresses.length === 0) {
      setError('Please enter both depot and delivery addresses.')
      return
    }

    setIsOptimizing(true)
    setError('')
    setIsAddedToDashboard(false)
    let quirkIndex = 0
    
    const quirkInterval = setInterval(() => {
      setCurrentQuirk(quirkMessages[quirkIndex])
      quirkIndex = (quirkIndex + 1) % quirkMessages.length
    }, 3000)

    try {
      // Make the optimization request with existing session cookies
      const data = {
        mainDepot,
        source_type: activeTab === 'csv' ? 'csv' : 'manual',
        deliveryAddresses: addresses.join('\n'),
        ...(activeTab === 'csv' && { csvData: csvData })
      }

      const response = await axios.post('http://localhost:5001/optimize', data, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log('API Response:', response.data)
      
      // Validate response structure
      if (response.data && typeof response.data === 'object') {
        setOptimizationResult(response.data)
        setSuccess('Routes optimized successfully!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error('Invalid response format from server')
      }
    } catch (error: any) {
      console.error('Optimization error:', error)
      if (error.code === 'ERR_NETWORK') {
        setError('Cannot connect to Flask backend. Please ensure the backend is running on port 5001.')
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setError('Authentication failed. Please check if the Flask backend is properly configured.')
      } else {
        setError(error.response?.data?.error || error.message || 'An error occurred while optimizing routes')
      }
    } finally {
      setIsOptimizing(false)
      setCurrentQuirk('')
      clearInterval(quirkInterval)
    }
  }

  const addToDashboard = async () => {
    if (!optimizationResult) return

    try {
      await axios.post('http://localhost:5001/add_to_dashboard', {
        route_data: optimizationResult
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      setIsAddedToDashboard(true)
      setSuccess('Route added to dashboard successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to add route to dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="home" 
        isOpen={isNavOpen} 
        onToggle={() => setIsNavOpen(!isNavOpen)} 
      />
      {/* Enhanced Navigation Bar */}
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BurgerButton 
                isOpen={isNavOpen} 
                onToggle={() => setIsNavOpen(!isNavOpen)} 
              />
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <Route className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  AutoScheduler
                </h1>
                <p className="text-sm text-zinc-400">Route Optimization Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
        {/* Success/Error Messages */}
        {error && (
          <div className="bg-red-950/20 border border-red-800/50 backdrop-blur-sm p-4 rounded-2xl animate-fade-in">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-red-100">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-950/20 border border-green-800/50 backdrop-blur-sm p-4 rounded-2xl animate-fade-in">
            <div className="flex">
              <CheckCircle className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-green-100">{success}</p>
            </div>
          </div>
        )}

        {/* Enhanced Route Parameters Summary */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Activity className="w-5 h-5 mr-3 text-zinc-400" />
              Route Parameters
            </h2>
            <div className="flex items-center space-x-2">
              {isEditingSettings ? (
                <>
                  <button
                    onClick={handleSaveSettings}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsEditingSettings(false)}
                    className="flex items-center space-x-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditingSettings(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                >
                  <Settings className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Maximum Miles */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-sm font-medium">Maximum Miles</span>
                <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <Route className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              {isEditingSettings ? (
                <input
                  type="number"
                  value={routeSettings.max_miles}
                  onChange={(e) => handleSettingsChange('max_miles', parseFloat(e.target.value))}
                  className="w-full text-xl font-semibold bg-zinc-700 border border-zinc-600 text-white rounded-lg px-3 py-2"
                />
              ) : (
                <p className="text-2xl font-semibold text-white">{routeSettings.max_miles}</p>
              )}
            </div>

            {/* Maximum Time */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-sm font-medium">Maximum Time</span>
                <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              {isEditingSettings ? (
                <input
                  type="number"
                  value={routeSettings.max_time}
                  onChange={(e) => handleSettingsChange('max_time', parseFloat(e.target.value))}
                  className="w-full text-xl font-semibold bg-zinc-700 border border-zinc-600 text-white rounded-lg px-3 py-2"
                />
              ) : (
                <p className="text-2xl font-semibold text-white">{routeSettings.max_time}h</p>
              )}
            </div>

            {/* Maximum Stops */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-sm font-medium">Maximum Stops</span>
                <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              {isEditingSettings ? (
                <input
                  type="number"
                  value={routeSettings.max_stops}
                  onChange={(e) => handleSettingsChange('max_stops', parseInt(e.target.value))}
                  className="w-full text-xl font-semibold bg-zinc-700 border border-zinc-600 text-white rounded-lg px-3 py-2"
                />
              ) : (
                <p className="text-2xl font-semibold text-white">{routeSettings.max_stops}</p>
              )}
            </div>

            {/* Available Drivers */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-400 text-sm font-medium">Available Drivers</span>
                <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-zinc-400" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-white">{availableDrivers}</p>
            </div>
          </div>
        </div>

        {/* Enhanced Main Input Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">
              Route Planning
            </h2>
            <div className="flex items-center space-x-2 text-sm text-zinc-500">
              <Zap className="w-4 h-4" />
              <span>Optimization</span>
            </div>
          </div>

          {/* Enhanced Input Method Tabs */}
          <div className="flex space-x-1 bg-zinc-800 rounded-lg p-1 mb-6">
            {[
              { key: 'manual', label: 'Manual Entry', icon: MapPin },
              { key: 'csv', label: 'CSV Upload', icon: Upload },
              { key: 'database', label: 'Database', icon: Activity }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Manual Entry Section */}
          {activeTab === 'manual' && (
            <div className="space-y-8">
              {/* Enhanced Depot Input */}
              <div>
                <label className="block text-zinc-300 text-sm font-semibold mb-3 flex items-center">
                  <Warehouse className="w-4 h-4 mr-2 text-white/80" />
                  Depot Address
                </label>
                <div className="relative">
                  <AddressInput
                    value={mainDepot}
                    onChange={setMainDepot}
                    onPlaceSelect={handleDepotSelect}
                    placeholder="Enter depot address..."
                    icon={<Warehouse className="w-5 h-5" />}
                  />
                  <button
                    onClick={resetDepot}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-zinc-700/50"
                    title="Reset to company default"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Autocomplete powered by Google Places API
                </p>
              </div>

              {/* Enhanced Delivery Address Input */}
              <div>
                <label className="block text-zinc-300 text-sm font-semibold mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-white/80" />
                  Add Delivery Address
                </label>
                <div className="flex space-x-3">
                  <AddressInput
                    value={deliveryAddress}
                    onChange={setDeliveryAddress}
                    onPlaceSelect={handleAddressSelect}
                    placeholder="Enter delivery address..."
                    icon={<MapPin className="w-5 h-5" />}
                    className="flex-1"
                  />
                  <button
                    onClick={addAddress}
                    onKeyPress={handleKeyPress}
                    className="bg-white hover:bg-zinc-100 text-black font-medium px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-white/25  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
                    disabled={!deliveryAddress.trim()}
                  >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                </div>
              </div>

              {/* Enhanced Address List */}
              {addresses.length > 0 && (
                <div>
                  <label className="block text-zinc-300 text-sm font-semibold mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-white/80" />
                      Delivery Addresses
                    </span>
                    <span className="bg-zinc-800/30 text-white/90 px-3 py-1 rounded-full text-xs font-medium">
                      {addresses.length} addresses
                    </span>
                  </label>
                  <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                    {addresses.map((address, index) => (
                      <div key={index} className="group bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-4 hover:border-zinc-600/50 hover:bg-zinc-800/50 transition-all duration-300">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black text-sm font-bold">
                              {index + 1}
                            </div>
                            <span className="text-white font-medium">{address}</span>
                          </div>
                          <button
                            onClick={() => removeAddress(index)}
                            className="text-zinc-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CSV Upload Section */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              <div>
                <label className="block text-zinc-300 text-sm font-semibold mb-4 flex items-center">
                  <Upload className="w-4 h-4 mr-2 text-white/80" />
                  Upload CSV File
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col w-full h-40 border-2 border-zinc-700/50 border-dashed rounded-2xl cursor-pointer bg-zinc-800/20 hover:bg-zinc-800/40 transition-all duration-300 group">
                    <div className="flex flex-col items-center justify-center pt-7">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 group- transition-transform duration-300">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-zinc-300 font-medium mb-2">
                        {csvFile ? csvFile.name : 'Drop your CSV file here'}
                      </p>
                      <p className="text-zinc-500 text-sm">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      className="opacity-0"
                      accept=".csv"
                      onChange={handleCSVUpload}
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={downloadTemplate}
                    className="text-white/80 hover:text-white/90 text-sm flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-all duration-300"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Enhanced CSV Preview */}
              {csvData.length > 0 && (
                <div className="bg-zinc-800/20 border border-zinc-700/30 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                    CSV Preview ({csvData.length} addresses)
                  </h3>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {csvData.slice(0, 8).map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30 hover:border-zinc-600/50 transition-all duration-300 group">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-black text-xs font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{item.reference}</p>
                            <p className="text-zinc-400 text-xs">{item.address}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newCsvData = csvData.filter((_, i) => i !== index)
                            setCsvData(newCsvData)
                            setAddresses(newCsvData.map(item => item.address))
                          }}
                          className="text-zinc-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {csvData.length > 8 && (
                      <div className="text-center py-4">
                        <p className="text-zinc-400 text-sm">
                          ... and {csvData.length - 8} more addresses
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Database Section */}
          {activeTab === 'database' && (
            <div className="flex flex-col items-center justify-center h-60 bg-zinc-800/20 rounded-2xl border border-zinc-700/30">
              <Activity className="w-16 h-16 text-zinc-600 mb-4" />
              <p className="text-zinc-400 text-lg font-medium">Database integration coming soon</p>
              <p className="text-zinc-500 text-sm mt-2">Connect your existing systems for seamless route planning</p>
            </div>
          )}

          {/* Enhanced Optimize Button */}
          <div className="mt-10">
            <button
              onClick={optimizeRoutes}
              disabled={isOptimizing || !mainDepot || addresses.length === 0}
              className="w-full bg-white hover:bg-zinc-100 text-black font-semibold text-base px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center justify-center space-x-2">
                {isOptimizing ? (
                  <>
                    <Loader className="w-6 h-6 animate-spin" />
                    <span>Optimizing Routes...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                    <span>Optimize Routes</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Enhanced Progress Container */}
        {isOptimizing && (
          <div className="bg-zinc-900/20 backdrop-blur-xl border border-zinc-800/30 rounded-3xl p-12 shadow-lg">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-zinc-700 border-t-white rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-r-purple-500 rounded-full animate-spin animation-delay-300"></div>
              </div>
              <div className="text-2xl font-bold text-white mb-4">
                Optimizing routes
                <span className="inline-flex ml-2">
                  <span className="animate-pulse">.</span>
                  <span className="animate-pulse animation-delay-200">.</span>
                  <span className="animate-pulse animation-delay-400">.</span>
                </span>
              </div>
              {currentQuirk && (
                <p className="text-zinc-400 italic text-lg animate-pulse max-w-md">{currentQuirk}</p>
              )}
            </div>
          </div>
        )}

        {/* Results Grid - Keep existing but enhance styling */}
        {optimizationResult && optimizationResult.results && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Results Column */}
            <div className="space-y-6">
              {/* Optimization Results */}
              <div className="bg-zinc-900/20 backdrop-blur-xl border border-zinc-800/30 rounded-3xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-white flex items-center mb-8">
                  <CheckCircle className="w-7 h-7 mr-3 text-green-400" />
                  Optimization Results
                </h2>
                <div className="space-y-6">
                  {optimizationResult?.results?.map((result, index) => (
                    <div key={index} className="bg-zinc-800/30 backdrop-blur-sm border border-zinc-700/30 rounded-2xl p-6  hover:shadow-xl hover:shadow-white/10 transition-all duration-300 group">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-xl text-white group-hover:text-white/90 transition-colors duration-300">{result.driver}</h3>
                        <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                          {result.num_stops} stops
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-700/30">
                          <p className="text-sm text-zinc-400 mb-1">Total Time</p>
                          <p className="text-lg font-bold text-white">{result.total_time}</p>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-700/30">
                          <p className="text-sm text-zinc-400 mb-1">Total Distance</p>
                          <p className="text-lg font-bold text-white">{result.total_distance}</p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <p className="text-sm text-zinc-400 mb-3 font-medium">Route Stops</p>
                        <div className="bg-zinc-900/50 p-4 rounded-xl max-h-40 overflow-y-auto border border-zinc-700/30">
                          {result.route.map((stop, stopIndex) => (
                            <div key={stopIndex} className="flex items-start space-x-3 py-2">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs text-white font-bold ${
                                stopIndex === 0 ? 'bg-zinc-600' : 'bg-zinc-700'
                              }`}>
                                {stopIndex === 0 ? <Warehouse className="w-4 h-4" /> : stopIndex}
                              </div>
                              <p className="text-white text-sm flex-1 font-medium">{stop}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Add to Dashboard Button */}
                        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-white font-semibold">Dashboard Tracking</h4>
                              <p className="text-blue-100 text-sm">Add this route to delivery dashboard</p>
                            </div>
                            <button
                              onClick={addToDashboard}
                              disabled={isAddedToDashboard}
                              className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-all duration-300 ${
                                isAddedToDashboard 
                                  ? 'bg-green-600 cursor-not-allowed' 
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {isAddedToDashboard ? (
                                <>
                                  <CheckCircle className="w-4 h-4 inline mr-2" />
                                  Added to Dashboard
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 inline mr-2" />
                                  Add to Dashboard
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex space-x-3">
                          <a
                            href={result.google_maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center px-4 py-3 bg-white rounded-xl text-black font-medium transition-all duration-300 hover:shadow-lg hover:shadow-white/20 hover:bg-zinc-50"
                          >
                            <NavigationIcon className="w-4 h-4 inline mr-2" />
                            Google Maps
                          </a>
                          <a
                            href={result.apple_maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-white font-medium transition-all duration-300"
                          >
                            <NavigationIcon className="w-4 h-4 inline mr-2" />
                            Apple Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missed Addresses */}
              {optimizationResult?.missed_addresses && optimizationResult.missed_addresses.length > 0 && (
                <div className="bg-zinc-900/20 backdrop-blur-xl border border-zinc-800/30 rounded-3xl p-8 shadow-lg">
                  <h2 className="text-2xl font-bold text-white flex items-center mb-6">
                    <AlertCircle className="w-7 h-7 mr-3 text-red-400" />
                    Missed Addresses
                  </h2>
                  <div className="space-y-4">
                    {optimizationResult?.missed_addresses?.map(([address, reason], index) => (
                      <div key={index} className="bg-zinc-900/50 p-4 rounded-xl border-l-4 border-red-500">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-white">{address}</p>
                            <p className="text-sm text-zinc-400 mt-1">{reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Map Column */}
            <div className="animate-fade-in">
              <div className="bg-zinc-900/20 backdrop-blur-xl border border-zinc-800/30 rounded-3xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-white flex items-center mb-6">
                  <MapPin className="w-7 h-7 mr-3 text-white/80" />
                  Route Visualization
                </h2>
                <div className="h-[600px] rounded-2xl overflow-hidden border border-zinc-700/30">
                  <RouteMap 
                    routes={optimizationResult?.results || []}
                    depot={mainDepot}
                    missedAddresses={optimizationResult?.missed_addresses || []}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}