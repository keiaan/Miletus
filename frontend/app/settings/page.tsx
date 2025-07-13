'use client'

import React, { useState, useEffect } from 'react'
import { 
  Settings, 
  Save, 
  Route, 
  Clock, 
  MapPin, 
  AlertCircle,
  CheckCircle,
  Lock,
  Key,
  User
} from 'lucide-react'
import Navigation, { BurgerButton } from '../../components/Navigation'
import axios from 'axios'

interface RouteSettings {
  max_miles: number
  max_time: number
  max_stops: number
}

export default function SettingsPage() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    max_miles: 100,
    max_time: 8,
    max_stops: 20
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })

  useEffect(() => {
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get('http://localhost:5001/route_management', {
        withCredentials: true
      })
      if (response.data.route_settings) {
        setRouteSettings(response.data.route_settings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      setError('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const saveRouteSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      await axios.post('http://localhost:5001/save_route_settings', routeSettings, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      
      setSuccess('Route settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error saving route settings:', error)
      setError('Failed to save route settings')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      setTimeout(() => setError(''), 3000)
      return
    }

    try {
      await axios.post('http://localhost:5001/update_password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      })
      
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      if (error.response?.status === 401) {
        setError('Current password is incorrect')
      } else {
        setError('Failed to update password')
      }
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation 
        currentPage="settings" 
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
                <Settings className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Settings</h1>
                <p className="text-sm text-zinc-400">Configure system settings</p>
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
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
              <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-green-300">{success}</span>
            </div>
          </div>
        )}

        {/* Route Optimization Settings */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Route className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Route Optimization Settings</h2>
          </div>
          
          <p className="text-zinc-400 mb-6">
            Configure the constraints for route optimization. These settings will apply to all new routes.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                <p className="text-zinc-400">Loading settings...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={saveRouteSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="w-5 h-5 text-zinc-400" />
                    <label className="text-sm font-medium text-zinc-300">Maximum Miles</label>
                  </div>
                  <input
                    type="number"
                    value={routeSettings.max_miles}
                    onChange={(e) => setRouteSettings({
                      ...routeSettings,
                      max_miles: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                    min="1"
                    max="500"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">Miles per route</p>
                </div>

                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock className="w-5 h-5 text-zinc-400" />
                    <label className="text-sm font-medium text-zinc-300">Maximum Hours</label>
                  </div>
                  <input
                    type="number"
                    value={routeSettings.max_time}
                    onChange={(e) => setRouteSettings({
                      ...routeSettings,
                      max_time: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                    min="1"
                    max="24"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">Hours per route</p>
                </div>

                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="w-5 h-5 text-zinc-400" />
                    <label className="text-sm font-medium text-zinc-300">Maximum Stops</label>
                  </div>
                  <input
                    type="number"
                    value={routeSettings.max_stops}
                    onChange={(e) => setRouteSettings({
                      ...routeSettings,
                      max_stops: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                    min="1"
                    max="100"
                    required
                  />
                  <p className="text-xs text-zinc-500 mt-1">Stops per route</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-2 bg-white hover:bg-zinc-100 text-black font-semibold px-6 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                <span>{isSaving ? 'Saving...' : 'Save Route Settings'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Password Change */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Key className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Change Password</h2>
          </div>
          
          <p className="text-zinc-400 mb-6">
            Update your password to keep your account secure.
          </p>

          <form onSubmit={updatePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter current password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter new password"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center space-x-2 bg-white hover:bg-zinc-100 text-black font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
            >
              <Save className="w-5 h-5" />
              <span>Update Password</span>
            </button>
          </form>
        </div>

        {/* Account Information */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <User className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Account Information</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-zinc-800">
              <span className="text-zinc-400">Username</span>
              <span className="text-white font-medium">admin</span>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-zinc-800">
              <span className="text-zinc-400">Company</span>
              <span className="text-white font-medium">EightNode</span>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-zinc-800">
              <span className="text-zinc-400">Role</span>
              <span className="px-2 py-1 bg-zinc-700 text-zinc-200 rounded text-sm font-medium">Administrator</span>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-400">Last Login</span>
              <span className="text-white font-medium">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}