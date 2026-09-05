import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useWellnessStore, WELLNESS_REMINDERS } from './stores/wellnessStore'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import {
  Heart,
  Droplets,
  Plus,
  Minus,
  ArrowRight,
  BellOff,
  Bell,
  Timer,
  Sparkles,
  CheckCircle2,
  Eye,
  Wind,
  Apple,
  Smile,
  Footprints,
  AlignVerticalSpaceAround,
  StretchHorizontal,
} from 'lucide-react'

const ICON_MAP = {
  Droplets,
  StretchHorizontal,
  Eye,
  Footprints,
  Wind,
  Apple,
  Smile,
  AlignVerticalSpaceAround,
}

export const WellnessWidget = () => {
  const {
    globalEnabled,
    setGlobalEnabled,
    hydrationCount,
    incrementHydration,
    decrementHydration,
    isSnoozed,
    snoozedUntil,
    clearSnooze,
    snooze,
    getNextReminder,
    reminderSettings,
  } = useWellnessStore()

  const [countdown, setCountdown] = useState('')
  const [nextReminder, setNextReminder] = useState(null)

  const snoozed = isSnoozed()
  const hydrationGoal = 8

  // Update countdown timer every second
  useEffect(() => {
    const update = () => {
      const next = getNextReminder()
      setNextReminder(next)

      if (next) {
        const diff = next.nextFireAt - Date.now()
        if (diff > 0) {
          const mins = Math.floor(diff / 60000)
          const secs = Math.floor((diff % 60000) / 1000)
          setCountdown(
            mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
          )
        } else {
          setCountdown('Soon')
        }
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [getNextReminder, reminderSettings, globalEnabled])

  // Hydration progress percentage
  const hydrationProgress = Math.min((hydrationCount / hydrationGoal) * 100, 100)

  const enabledCount = WELLNESS_REMINDERS.filter(
    (r) => reminderSettings[r.id]?.enabled
  ).length

  const NextReminderIcon = nextReminder
    ? ICON_MAP[nextReminder.icon] || Bell
    : Bell

  return (
    <Card className="p-0 overflow-hidden border-border">
      {/* Gradient Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-rose-50 via-pink-50 to-purple-50 dark:from-rose-500/10 dark:via-pink-500/5 dark:to-purple-500/10 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 dark:from-rose-500/30 dark:to-pink-500/30 border border-rose-500/20 dark:border-rose-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">
                Wellness Hub
              </h3>
              <p className="text-[10px] text-muted">
                {enabledCount} reminders active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snoozed && (
              <Badge variant="warning">
                <BellOff className="w-3 h-3 mr-1" />
                Snoozed
              </Badge>
            )}
            <button
              onClick={() => {
                if (snoozed) {
                  clearSnooze()
                } else {
                  snooze(30)
                }
              }}
              title={snoozed ? 'Resume notifications' : 'Snooze 30 min'}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                snoozed
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                  : 'bg-chrome border-border text-muted hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {snoozed ? (
                <Bell className="w-3.5 h-3.5" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Two Column Layout: Hydration Tracker + Next Reminder */}
        <div className="grid grid-cols-2 gap-4">
          {/* Hydration Tracker */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span className="text-[11px] font-semibold text-fg uppercase tracking-wider">
                Hydration
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={decrementHydration}
                disabled={hydrationCount === 0}
                className="w-7 h-7 rounded-lg bg-chrome hover:bg-slate-200 dark:hover:bg-slate-700 text-muted flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed border border-border"
              >
                <Minus className="w-3 h-3" />
              </button>

              <div className="flex-1 text-center">
                <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                  {hydrationCount}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  /{hydrationGoal}
                </span>
              </div>

              <button
                onClick={incrementHydration}
                className="w-7 h-7 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center transition-colors cursor-pointer border border-sky-500/20"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all duration-500 ease-out"
                style={{ width: `${hydrationProgress}%` }}
              />
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1">
              {hydrationCount >= hydrationGoal ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Goal reached!
                </>
              ) : (
                `${hydrationGoal - hydrationCount} glasses to go`
              )}
            </p>
          </div>

          {/* Next Reminder Countdown */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-semibold text-fg uppercase tracking-wider">
                Next Reminder
              </span>
            </div>

            {nextReminder && globalEnabled && !snoozed ? (
              <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-accent-soft border border-accent/20 dark:border-accent/10">
                <NextReminderIcon className="w-6 h-6 text-accent" />
                <span className="text-[11px] font-semibold text-fg text-center truncate w-full">
                  {nextReminder.name}
                </span>
                <span className="text-xs font-mono text-accent font-bold">
                  {countdown}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-chrome/50 border border-border/50 h-[88px]">
                <BellOff className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {snoozed ? 'Snoozed' : !globalEnabled ? 'Disabled' : 'No reminders'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Link to Settings */}
        <NavLink
          to="/wellness"
          className="flex items-center justify-between p-3 rounded-xl bg-chrome border border-border hover:border-accent/40 dark:hover:border-accent/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-fg group-hover:text-accent transition-colors">
              Manage Wellness Reminders
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 group-hover:text-accent transition-colors" />
        </NavLink>
      </div>
    </Card>
  )
}
