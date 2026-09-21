import React, { useEffect, useState } from 'react'

function getInitial(name, fallback = 'U', count = 1) {
  const raw = String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (count > 1 && parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  if (count > 1 && parts[0]) return parts[0].slice(0, count).toUpperCase()
  const ch = raw.charAt(0)
  return ch ? ch.toUpperCase() : fallback
}

export function EmployeeAvatar({
  src,
  name,
  className = '',
  textClassName = '',
  fallback = 'U',
  initialsCount = 1,
}) {
  const photo = String(src || '').trim()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [photo])

  const showImage = Boolean(photo) && !failed

  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={photo}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={textClassName}>{getInitial(name, fallback, initialsCount)}</span>
      )}
    </div>
  )
}
