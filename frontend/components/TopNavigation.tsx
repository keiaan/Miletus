'use client'

import React from 'react'
import { 
  Route, 
  BarChart3, 
  Settings, 
  Users, 
  MapPin, 
  FileText,
  LogOut,
  ChevronDown
} from 'lucide-react'

interface TopNavigationProps {
  currentPage?: string
}

const TopNavigation: React.FC<TopNavigationProps> = ({ currentPage = 'home' }) => {
  const menuItems = [
    { id: 'home', label: 'Route Optimizer', icon: Route, href: '/' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, href: '/dashboard' },
    { id: 'routes', label: 'Route History', icon: MapPin, href: '/routes' },
    { id: 'drivers', label: 'Drivers', icon: Users, href: '/drivers' },
    { id: 'reports', label: 'Reports', icon: FileText, href: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ]

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Route className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">AutoScheduler</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </a>
              )
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-zinc-300 font-medium">Connected</span>
            </div>
            
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors duration-200">
                <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">A</span>
                </div>
                <span className="text-sm font-medium text-white hidden md:block">Admin</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="p-3 border-b border-zinc-700">
                  <p className="text-sm font-medium text-white">Admin User</p>
                  <p className="text-xs text-zinc-400">EightNode</p>
                </div>
                <div className="p-2">
                  <a
                    href="/profile"
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors duration-200"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Profile Settings</span>
                  </a>
                  <button className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors duration-200 w-full text-left">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default TopNavigation