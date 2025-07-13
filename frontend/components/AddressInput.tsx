'use client'

import React, { useRef, useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: any) => void
  placeholder?: string
  className?: string
  icon?: React.ReactNode
}

const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  className = "",
  icon
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if Google Maps API is loaded
    const checkGoogleMaps = () => {
      if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
        setIsLoaded(true)
        initializeAutocomplete()
      } else {
        setTimeout(checkGoogleMaps, 100)
      }
    }
    checkGoogleMaps()
  }, [])

  const initializeAutocomplete = () => {
    if (!inputRef.current || !(window as any).google) return

    // Bias towards UK addresses, specifically around Birmingham/Redditch area
    const google = (window as any).google
    const ukBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(52.2, -2.1), // Southwest
      new google.maps.LatLng(52.4, -1.8)  // Northeast
    )

    const options = {
      bounds: ukBounds,
      componentRestrictions: { country: 'uk' },
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      types: ['address']
    }

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      options
    )

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace()
      if (place && place.formatted_address) {
        onChange(place.formatted_address)
        onPlaceSelect?.(place)
      }
    })
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-zinc-800/50 border border-zinc-700/50 text-white placeholder:text-zinc-400 
                   focus:border-white focus:ring-2 focus:ring-white/20 focus:bg-zinc-800
                   transition-all duration-300 rounded-xl px-4 py-3 w-full
                   hover:border-zinc-600 hover:bg-zinc-800/70
                   ${icon ? 'pl-12' : ''} ${className}`}
        placeholder={placeholder}
      />
      {icon && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70">
          {icon}
        </div>
      )}
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}

export default AddressInput