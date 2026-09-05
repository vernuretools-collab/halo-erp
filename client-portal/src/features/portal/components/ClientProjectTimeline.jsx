import React, { useState, useEffect } from 'react'
import {
  Filter,
  MessageSquare,
  Check,
  FileText,
  UserCheck,
  LifeBuoy,
  FolderKanban,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  ChevronDown,
  CircleDot,
  CheckCircle,
  PlayCircle,
  Layers,
} from 'lucide-react'
import {
  subscribeProjectProcessSteps,
} from '../services/portalService'

// Icon and badge color resolver
export const getProcessIconConfig = (type, status) => {
  if (status === 'completed') {
    return {
      bg: 'bg-emerald-600',
      textColor: 'text-emerald-400',
      icon: Check,
    }
  }

  switch (type?.toLowerCase()) {
    case 'message':
      return {
        bg: status === 'in_progress' ? 'bg-accent ring-4 ring-accent/30' : 'bg-accent/80',
        textColor: 'text-accent',
        icon: MessageSquare,
      }
    case 'invoice':
      return {
        bg: 'bg-emerald-600',
        textColor: 'text-emerald-400',
        icon: Check,
      }
    case 'document':
      return {
        bg: 'bg-accent',
        textColor: 'text-accent',
        icon: FileText,
      }
    case 'approval':
      return {
        bg: 'bg-amber-500',
        textColor: 'text-amber-400',
        icon: UserCheck,
      }
    case 'ticket':
    case 'support':
      return {
        bg: 'bg-accent',
        textColor: 'text-accent',
        icon: LifeBuoy,
      }
    case 'project_created':
    case 'milestone':
    default:
      return {
        bg: status === 'in_progress' ? 'bg-accent ring-4 ring-accent/30' : 'bg-emerald-600',
        textColor: 'text-emerald-400',
        icon: FolderKanban,
      }
  }
}

export const ClientProjectTimeline = ({ projectId, project, className = '' }) => {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'in_progress' | 'completed' | 'pending'
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  useEffect(() => {
    if (!projectId) return

    setLoading(true)
    const unsubProcess = subscribeProjectProcessSteps(projectId, (list) => {
      setSteps(list)
      setLoading(false)
    })

    return () => {
      if (typeof unsubProcess === 'function') unsubProcess()
    }
  }, [projectId])

  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const activeStep = steps.find((s) => s.status === 'in_progress')

  const filteredSteps = steps.filter((s) => {
    if (statusFilter === 'all') return true
    return s.status === statusFilter
  })

  return (
    <div className={`bg-surface border border-border rounded-2xl p-6 text-fg shadow-xl relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-fg tracking-tight flex items-center gap-2">
            Project Process & Stage Tracker
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {activeStep ? (
              <span>
                Current Stage: <strong className="text-accent font-semibold">{activeStep.title}</strong>
              </span>
            ) : completedSteps === totalSteps && totalSteps > 0 ? (
              <span className="text-emerald-400 font-semibold">All Project Stages Completed</span>
            ) : (
              <span>Live project delivery status and upcoming stages.</span>
            )}
          </p>
        </div>

        {/* Filter Button & Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-chrome hover:bg-chrome text-xs font-semibold text-fg hover:text-fg transition-all shadow-sm"
          >
            <Filter className="w-3.5 h-3.5 text-fg" />
            <span>Filter</span>
            <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
          </button>

          {showFilterMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowFilterMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border flex items-center justify-between">
                  <span>Filter Stages</span>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => {
                        setStatusFilter('all')
                        setShowFilterMenu(false)
                      }}
                      className="text-accent hover:underline text-[10px]"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {[
                  { key: 'all', label: 'All Stages' },
                  { key: 'in_progress', label: 'In Progress (Current)' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'pending', label: 'Pending (Upcoming)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(opt.key)
                      setShowFilterMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                      statusFilter === opt.key
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'text-fg hover:bg-chrome hover:text-fg'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {statusFilter === opt.key && <Check className="w-3.5 h-3.5 text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Process Stepper List */}
      <div className="mt-6">
        {loading ? (
          <div className="py-12 text-center text-muted text-xs flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Loading project process stages...</span>
          </div>
        ) : steps.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs border border-dashed border-border rounded-xl">
            <Clock className="w-6 h-6 mx-auto text-muted mb-2 opacity-60" />
            <span>No approved process stages yet. Your team will publish updates here after review.</span>
          </div>
        ) : filteredSteps.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs border border-dashed border-border rounded-xl">
            <Clock className="w-6 h-6 mx-auto text-muted mb-2 opacity-60" />
            <span>No process stages match the current filter.</span>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 sm:space-y-7 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border">
            {filteredSteps.map((step, idx) => {
              const isCompleted = step.status === 'completed'
              const isInProgress = step.status === 'in_progress'
              const isPending = step.status === 'pending'

              const iconConfig = getProcessIconConfig(step.type, step.status)
              const IconComp = iconConfig.icon

              const metaParts = []
              if (step.author) metaParts.push(step.author)
              if (step.meta) metaParts.push(step.meta)

              const subtitle = metaParts.join(' • ')

              return (
                <div
                  key={step.id || idx}
                  className={`relative flex items-start gap-4 p-3 rounded-xl border transition-all ${
                    isInProgress
                      ? 'bg-accent-soft border-accent/30 ring-1 ring-accent/20'
                      : isCompleted
                      ? 'bg-chrome border-border'
                      : 'bg-chrome border-border opacity-70'
                  }`}
                >
                  {/* Left Circle Icon Badge */}
                  <div
                    className={`relative -ml-[25px] z-10 w-[34px] h-[34px] rounded-full ${iconConfig.bg} text-fg flex items-center justify-center shadow-md shrink-0 ring-4 ring-surface transition-transform duration-200 group-hover:scale-105`}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  {/* Right Content */}
                  <div className="pt-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-fg leading-snug break-words">
                        {step.title}
                      </h4>

                      {/* Status Badges */}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3 h-3" /> Done
                        </span>
                      )}
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/30 animate-pulse">
                          <CircleDot className="w-3 h-3" /> Current Stage
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-chrome text-muted border border-border">
                          Upcoming
                        </span>
                      )}
                    </div>

                    {subtitle && (
                      <p className="text-xs text-muted mt-1 font-normal tracking-wide">
                        {subtitle}
                      </p>
                    )}

                    {step.message && (
                      <div className="mt-2 text-xs text-fg bg-chrome p-3 rounded-lg border border-border font-medium">
                        {step.message}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
