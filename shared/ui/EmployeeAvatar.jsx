import React, { useEffect, useState } from 'react'

function getInitial(name, fallback = 'U') {
  const raw = String(name || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()
  const ch = raw.charAt(0)
  return ch ? ch.toUpperCase() : fallback
}

export function EmployeeAvatar({
  src,
  name,
  className = '',
  textClassName = '',
  fallback = 'U',
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
        <span className={textClassName}>{getInitial(name, fallback)}</span>
      )}
    </div>
  )
}
