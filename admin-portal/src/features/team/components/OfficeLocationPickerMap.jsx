import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { Search, MapPin, Layers, Sparkles } from 'lucide-react'
import { loadGoogleMaps } from '../services/googleMapsLoader'

// Leaflet default icon fix
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 }
const DEFAULT_ZOOM = 16

/**
 * Leaflet Fallback Component
 */
const LeafletPicker = ({ lat, lng, radiusMeters, onPick }) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    const center = hasPoint ? [Number(lat), Number(lng)] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]

    const map = L.map(containerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng
      onPickRef.current?.(clickLat, clickLng)
    })

    mapRef.current = map
    const t = setTimeout(() => map.invalidateSize(), 80)

    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    if (!hasPoint) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      if (circleRef.current) {
        map.removeLayer(circleRef.current)
        circleRef.current = null
      }
      return
    }

    const point = [Number(lat), Number(lng)]
    const radius = Math.max(50, Number(radiusMeters) || 200)

    if (!markerRef.current) {
      markerRef.current = L.marker(point, { draggable: true }).addTo(map)
      markerRef.current.on('dragend', (e) => {
        const { lat: dLat, lng: dLng } = e.target.getLatLng()
        onPickRef.current?.(dLat, dLng)
      })
    } else {
      markerRef.current.setLatLng(point)
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(point, {
        radius,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map)
    } else {
      circleRef.current.setLatLng(point)
      circleRef.current.setRadius(radius)
    }

    map.setView(point, map.getZoom() || DEFAULT_ZOOM)
    setTimeout(() => map.invalidateSize(), 50)
  }, [lat, lng, radiusMeters])

  return (
    <div
      ref={containerRef}
      className="w-full h-80 rounded-xl overflow-hidden border border-slate-700 z-0"
    />
  )
}

/**
 * Google Maps Interactive Picker Component
 */
const GoogleMapsPicker = ({ lat, lng, radiusMeters, onPick }) => {
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !window.google?.maps) return

    const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    const center = hasPoint ? { lat: Number(lat), lng: Number(lng) } : DEFAULT_CENTER

    const map = new window.google.maps.Map(containerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_RIGHT,
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'on' }],
        },
      ],
    })

    map.addListener('click', (e) => {
      if (!e.latLng) return
      const clickLat = e.latLng.lat()
      const clickLng = e.latLng.lng()
      onPickRef.current?.(clickLat, clickLng)
    })

    // Setup Places Autocomplete if available
    if (searchInputRef.current && window.google.maps.places) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ['geometry', 'name', 'formatted_address'],
      })
      autocomplete.bindTo('bounds', map)

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.geometry || !place.geometry.location) return

        const newLat = place.geometry.location.lat()
        const newLng = place.geometry.location.lng()
        map.setCenter(place.geometry.location)
        map.setZoom(17)
        onPickRef.current?.(newLat, newLng)
      })

      autocompleteRef.current = autocomplete
    }

    mapRef.current = map

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      if (mapRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mapRef.current)
      }
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync Marker and Circle with lat, lng, radius
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return

    const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    if (!hasPoint) {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      if (circleRef.current) {
        circleRef.current.setMap(null)
        circleRef.current = null
      }
      return
    }

    const pos = { lat: Number(lat), lng: Number(lng) }
    const radius = Math.max(50, Number(radiusMeters) || 200)

    if (!markerRef.current) {
      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        title: 'Office Geofence Center',
      })

      marker.addListener('dragend', (e) => {
        if (!e.latLng) return
        onPickRef.current?.(e.latLng.lat(), e.latLng.lng())
      })

      markerRef.current = marker
    } else {
      markerRef.current.setPosition(pos)
    }

    if (!circleRef.current) {
      const circle = new window.google.maps.Circle({
        strokeColor: '#10b981',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.2,
        map,
        center: pos,
        radius,
      })
      circleRef.current = circle
    } else {
      circleRef.current.setCenter(pos)
      circleRef.current.setRadius(radius)
    }

    map.panTo(pos)
  }, [lat, lng, radiusMeters])

  return (
    <div className="space-y-2">
      {/* Search Box */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search office building, address, or landmark with Google Places..."
          className="w-full bg-slate-900/90 border border-slate-700 text-fg text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-accent placeholder:text-muted shadow-inner"
        />
      </div>

      <div
        ref={containerRef}
        className="w-full h-80 rounded-xl overflow-hidden border border-slate-700 z-0"
      />
    </div>
  )
}

/**
 * Main OfficeLocationPickerMap Component
 * Automatically uses Google Maps when API key is provided/loaded,
 * and falls back gracefully to OpenStreetMap/Leaflet otherwise.
 */
export const OfficeLocationPickerMap = ({
  lat,
  lng,
  radiusMeters = 200,
  onPick,
  className = '',
}) => {
  const [mapProvider, setMapProvider] = useState('loading') // 'gmaps' | 'leaflet' | 'loading'

  useEffect(() => {
    let active = true

    loadGoogleMaps()
      .then(() => {
        if (active) setMapProvider('gmaps')
      })
      .catch(() => {
        if (active) setMapProvider('leaflet')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          Click or drag the pin to set the exact office coordinates. Adjust radius below.
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border bg-slate-800/80 border-slate-700 text-slate-300">
          {mapProvider === 'gmaps' ? (
            <>
              <Sparkles className="w-3 h-3 text-amber-400" />
              Google Maps & Places
            </>
          ) : mapProvider === 'leaflet' ? (
            <>
              <Layers className="w-3 h-3 text-emerald-400" />
              OpenStreetMap
            </>
          ) : (
            'Loading map…'
          )}
        </span>
      </div>

      {mapProvider === 'gmaps' ? (
        <GoogleMapsPicker
          lat={lat}
          lng={lng}
          radiusMeters={radiusMeters}
          onPick={onPick}
        />
      ) : (
        <LeafletPicker
          lat={lat}
          lng={lng}
          radiusMeters={radiusMeters}
          onPick={onPick}
        />
      )}
    </div>
  )
}
