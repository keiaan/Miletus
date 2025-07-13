'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import axios from 'axios'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuthentication = async () => {
      // Skip auth check for login page
      if (pathname === '/login') {
        setIsAuthenticated(false)
        return
      }

      // Check localStorage first for quick feedback
      const localAuth = localStorage.getItem('isAuthenticated')
      
      if (localAuth === 'true') {
        // Verify with Flask backend
        try {
          const response = await axios.get('http://localhost:5001/api/session', {
            withCredentials: true
          })
          
          if (response.data.user) {
            // Update localStorage with fresh session data
            localStorage.setItem('isAuthenticated', 'true')
            localStorage.setItem('username', response.data.user)
            localStorage.setItem('company', response.data.company || '')
            localStorage.setItem('privilege', response.data.privilege || '')
            localStorage.setItem('company_depot', response.data.company_depot || '')
            setIsAuthenticated(true)
          } else {
            // Session invalid, clear localStorage and redirect
            localStorage.clear()
            setIsAuthenticated(false)
            router.push('/login')
          }
        } catch (error) {
          // Session check failed, clear localStorage and redirect
          localStorage.clear()
          setIsAuthenticated(false)
          router.push('/login')
        }
      } else {
        // No local auth, redirect to login
        setIsAuthenticated(false)
        router.push('/login')
      }
    }

    checkAuthentication()
  }, [pathname, router])

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page or protected content
  if (!isAuthenticated && pathname !== '/login') {
    return null // Will redirect via useEffect
  }

  return <>{children}</>
}