'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Plus, 
  Trash2, 
  Phone, 
  Edit2, 
  Check, 
  X, 
  AlertCircle,
  UserCheck,
  UserX,
  User
} from 'lucide-react'
import Navigation, { BurgerButton } from '../../components/Navigation'
import axios from 'axios'

interface Driver {
  name: string
  phone: string
  notes: string
  available_for_schedule: boolean
}

export default function DriversPage() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [newDriverName, setNewDriverName] = useState('')
  const [newDriverPhone, setNewDriverPhone] = useState('')
  const [newDriverNotes, setNewDriverNotes] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingPhone, setEditingPhone] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    // Load user info from localStorage
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchDrivers = async () => {
    try {
      setIsLoading(true)
      // The Flask endpoint returns HTML, so we need to get JSON data directly
      const response = await axios.get('http://localhost:5001/api/drivers', {
        withCredentials: true
      })
      setDrivers(response.data.drivers || [])
    } catch (error) {
      console.error('Error fetching drivers:', error)
      // Fallback: try to get the data from the driver management page
      try {
        const fallbackResponse = await axios.get('http://localhost:5001/driver_management', {
          withCredentials: true
        })
        // If the response contains JSON data, extract it
        if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
          setDrivers(fallbackResponse.data)
        }
      } catch (fallbackError) {
        setError('Failed to load drivers')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDrivers()
  }, [])

  const addDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDriverName.trim() || !newDriverPhone.trim()) return

    try {
      const formData = new URLSearchParams()
      formData.append('name', newDriverName.trim())
      formData.append('phone', newDriverPhone.trim())
      formData.append('notes', newDriverNotes.trim())
      formData.append('available_for_schedule', 'on')
      
      await axios.post('http://localhost:5001/add_driver', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      
      setNewDriverName('')
      setNewDriverPhone('')
      setNewDriverNotes('')
      setSuccess('Driver added successfully!')
      setTimeout(() => setSuccess(''), 3000)
      fetchDrivers()
    } catch (error) {
      console.error('Error adding driver:', error)
      setError('Failed to add driver')
      setTimeout(() => setError(''), 3000)
    }
  }

  const removeDriver = async (index: number) => {
    try {
      await axios.post(`http://localhost:5001/remove_driver/${index}`, {}, {
        withCredentials: true
      })
      setSuccess('Driver removed successfully!')
      setTimeout(() => setSuccess(''), 3000)
      fetchDrivers()
    } catch (error) {
      console.error('Error removing driver:', error)
      setError('Failed to remove driver')
      setTimeout(() => setError(''), 3000)
    }
  }

  const toggleDriverAvailability = async (index: number) => {
    try {
      await axios.post(`http://localhost:5001/toggle_driver_availability/${index}`, {}, {
        withCredentials: true
      })
      fetchDrivers()
    } catch (error) {
      console.error('Error toggling driver availability:', error)
      setError('Failed to update driver availability')
      setTimeout(() => setError(''), 3000)
    }
  }

  const updateDriverPhone = async (index: number, newPhone: string) => {
    try {
      await axios.post(`http://localhost:5001/update_driver_phone/${index}`, {
        phone: newPhone
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      setEditingIndex(null)
      setEditingPhone('')
      setSuccess('Phone number updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
      fetchDrivers()
    } catch (error) {
      console.error('Error updating phone:', error)
      setError('Failed to update phone number')
      setTimeout(() => setError(''), 3000)
    }
  }

  const startEditing = (index: number, currentPhone: string) => {
    setEditingIndex(index)
    setEditingPhone(currentPhone)
  }

  const cancelEditing = () => {
    setEditingIndex(null)
    setEditingPhone('')
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="drivers" 
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
                <Users className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Driver Management</h1>
                <p className="text-sm text-zinc-400">Manage delivery drivers</p>
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
          <div className="bg-red-950/20 border border-red-800/50 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <span className="text-red-300">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-950/20 border border-green-800/50 p-4 rounded-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-green-300">{success}</span>
            </div>
          </div>
        )}

        {/* Add New Driver */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Add New Driver</h2>
          
          <form onSubmit={addDriver} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter driver name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={newDriverNotes}
                onChange={(e) => setNewDriverNotes(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                placeholder="Enter any additional notes about the driver"
                rows={3}
              />
            </div>
            
            <button
              type="submit"
              className="flex items-center space-x-2 bg-white hover:bg-zinc-100 text-black font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Add Driver</span>
            </button>
          </form>
        </div>

        {/* Drivers List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Current Drivers</h2>
            <p className="text-sm text-zinc-400">Manage existing drivers and their availability</p>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                  <p className="text-zinc-400">Loading drivers...</p>
                </div>
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Drivers Added</h3>
                <p className="text-zinc-400">Add your first driver using the form above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {drivers.map((driver, index) => (
                  <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-white">{driver.name}</h3>
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-zinc-400" />
                            {editingIndex === index ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="tel"
                                  value={editingPhone}
                                  onChange={(e) => setEditingPhone(e.target.value)}
                                  className="px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 text-white rounded"
                                />
                                <button
                                  onClick={() => updateDriverPhone(index, editingPhone)}
                                  className="p-1 bg-green-700 hover:bg-green-600 rounded"
                                >
                                  <Check className="w-3 h-3 text-white" />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1 bg-red-700 hover:bg-red-600 rounded"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-zinc-300">{driver.phone}</span>
                                <button
                                  onClick={() => startEditing(index, driver.phone)}
                                  className="p-1 hover:bg-zinc-600 rounded"
                                >
                                  <Edit2 className="w-3 h-3 text-zinc-400" />
                                </button>
                              </div>
                            )}
                          </div>
                          {driver.notes && (
                            <p className="text-xs text-zinc-500 mt-1">{driver.notes}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleDriverAvailability(index)}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-colors duration-200 ${
                            driver.available_for_schedule 
                              ? 'bg-green-700 hover:bg-green-600 text-white' 
                              : 'bg-red-700 hover:bg-red-600 text-white'
                          }`}
                        >
                          {driver.available_for_schedule ? (
                            <>
                              <UserCheck className="w-4 h-4" />
                              <span className="text-sm">Available</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-4 h-4" />
                              <span className="text-sm">Unavailable</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => removeDriver(index)}
                          className="p-2 bg-red-700 hover:bg-red-600 rounded-lg transition-colors duration-200"
                          title="Remove Driver"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
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