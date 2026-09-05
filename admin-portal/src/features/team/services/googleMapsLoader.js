let googleMapsPromise = null

/**
 * Dynamically loads the Google Maps JavaScript API script.
 * Returns a Promise that resolves to window.google.maps or rejects if loading fails.
 */
export function loadGoogleMaps(apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not defined.'))
  }

  // Already loaded
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }

  const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key || !key.trim()) {
    return Promise.reject(new Error('Missing Google Maps API Key.'))
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in document
    const existingScript = document.querySelector('script[data-gmaps-loader="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps)
        else reject(new Error('Google Maps script loaded but maps object missing.'))
      })
      existingScript.addEventListener('error', (err) => reject(err))
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key.trim())}&libraries=places`
    script.async = true
    script.defer = true
    script.setAttribute('data-gmaps-loader', 'true')

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
      } else {
        reject(new Error('Google Maps loaded without window.google.maps namespace.'))
      }
    }

    script.onerror = (err) => {
      googleMapsPromise = null
      reject(new Error('Failed to load Google Maps script. Check network or API key.'))
    }

    document.head.appendChild(script)
  })

  return googleMapsPromise
}
