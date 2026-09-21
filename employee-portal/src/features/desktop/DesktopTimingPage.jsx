import React, { useEffect } from 'react'
import { MyTimingCard } from './MyTimingCard'
import { useProjectStore } from '../projects/stores/projectStore'

export const DesktopTimingPage = () => {
  const fetchProjectsAndTasks = useProjectStore((s) => s.fetchProjectsAndTasks)

  useEffect(() => {
    fetchProjectsAndTasks()
  }, [fetchProjectsAndTasks])

  const hideWindow = () => {
    try {
      window.desktop?.hideMyTiming?.()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-fg select-none">
      <MyTimingCard fillWindow listenForDesktopEvents onHide={hideWindow} />
    </div>
  )
}
