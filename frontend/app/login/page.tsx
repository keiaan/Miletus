'use client'

import React, { useState } from 'react'
import { LogIn, User, Lock, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)
      
      const response = await axios.post('http://localhost:5001/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true
      })

      // Check if login was successful by validating the response
      if (response.status === 200) {
        // Store user info in localStorage for client-side auth
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('username', username)
        
        // Try to get user session info from Flask
        try {
          const sessionResponse = await axios.get('http://localhost:5001/api/session', {
            withCredentials: true
          })
          
          if (sessionResponse.data.user) {
            localStorage.setItem('company', sessionResponse.data.company || '')
            localStorage.setItem('privilege', sessionResponse.data.privilege || '')
            localStorage.setItem('company_depot', sessionResponse.data.company_depot || '')
          }
        } catch (sessionError) {
          // Session endpoint might not exist, continue with basic auth
          console.log('Session info not available, proceeding with basic auth')
        }
        
        // Redirect to main page
        router.push('/')
      } else {
        setError('Login failed. Please check your credentials.')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      if (error.response?.status === 401) {
        setError('Invalid username or password')
      } else if (error.response?.status === 302) {
        // Flask redirect response often means successful login
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('username', username)
        router.push('/')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AutoScheduler</h1>
          <p className="text-zinc-400">Route Optimization Platform</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
          
          {error && (
            <div className="bg-red-950/20 border border-red-800/50 p-4 rounded-lg mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
                <span className="text-red-300">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:border-white focus:ring-2 focus:ring-white/20 transition-all duration-200"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-zinc-100 text-black font-semibold py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Available Users */}
          <div className="mt-6 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
            <p className="text-sm text-zinc-400 mb-2">Available Users:</p>
            <div className="text-xs text-zinc-500 space-y-1">
              <div>• <span className="text-white font-mono">admin</span> - Global Admin (EightNode)</div>
              <div>• <span className="text-white font-mono">jake</span> - Admin (Ask Retrofit)</div>
              <div>• <span className="text-white font-mono">Broughtons_Demo</span> - Admin (Broughton Storage)</div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Contact administrator for passwords</p>
          </div>
        </div>
      </div>
    </div>
  )
}