'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { 
  Menu, 
  X, 
  Route, 
  BarChart3, 
  Settings, 
  Users, 
  MapPin, 
  Clock,
  FileText,
  LogOut,
  Home
} from 'lucide-react'

interface NavigationProps {
  currentPage?: string
  isOpen?: boolean
  onToggle?: () => void
}

const Navigation: React.FC<NavigationProps> = ({ 
  currentPage = 'home', 
  isOpen: externalIsOpen, 
  onToggle 
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [userInfo, setUserInfo] = useState({ username: '', company: '' })
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const router = useRouter()

  useEffect(() => {
    // Load user info from localStorage
    const username = localStorage.getItem('username') || 'User'
    const company = localStorage.getItem('company') || 'Company'
    setUserInfo({ username, company })
  }, [])

  const menuItems = [
    { id: 'home', label: 'Route Optimizer', icon: Route, href: '/' },
    { id: 'dashboard', label: 'Delivery Dashboard', icon: BarChart3, href: '/dashboard' },
    { id: 'routes', label: 'Route History', icon: MapPin, href: '/routes' },
    { id: 'drivers', label: 'Driver Management', icon: Users, href: '/drivers' },
    { id: 'reports', label: 'Reports & Analytics', icon: FileText, href: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ]

  const toggleMenu = () => {
    if (onToggle) {
      onToggle()
    } else {
      setInternalIsOpen(!internalIsOpen)
    }
  }

  const handleLogout = async () => {
    try {
      // Call Flask logout endpoint
      await axios.post('http://localhost:5001/logout', {}, {
        withCredentials: true
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear localStorage regardless of Flask response
      localStorage.clear()
      router.push('/login')
    }
  }

  return (
    <>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
          onClick={toggleMenu}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Route className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AutoScheduler</h2>
              <p className="text-sm text-zinc-400">Route Optimization</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {userInfo.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{userInfo.username}</p>
              <p className="text-xs text-zinc-400">{userInfo.company}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                    onClick={() => {
                      if (onToggle) onToggle()
                      else setInternalIsOpen(false)
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors duration-200 w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}

// Burger Button Component
export const BurgerButton: React.FC<{ isOpen: boolean; onToggle: () => void }> = ({ isOpen, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors duration-200"
      aria-label="Toggle menu"
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <Menu className="w-6 h-6 text-white" />
      )}
    </button>
  )
}

export default Navigation