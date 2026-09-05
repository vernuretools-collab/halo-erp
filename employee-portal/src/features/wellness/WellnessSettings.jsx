import React, { useState } from 'react'
import { useWellnessStore, WELLNESS_REMINDERS } from './stores/wellnessStore'
import { armBrowserNotifications } from '../../shared/services/fcmService'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  Heart,
  Droplets,
  Eye,
  Wind,
  Apple,
  Smile,
  Footprints,
  AlignVerticalSpaceAround,
  Bell,
  BellOff,
  Shield,
  ShieldOff,
  Timer,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
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

const COLOR_MAP = {
  sky: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    border: 'border-sky-500/20 dark:border-sky-500/30',
    text: 'text-sky-600 dark:text-sky-400',
    glow: 'shadow-sky-500/20',
    ring: 'ring-sky-500/30',
    toggle: 'bg-sky-500',
  },
  violet: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    border: 'border-violet-500/20 dark:border-violet-500/30',
    text: 'text-violet-600 dark:text-violet-400',
    glow: 'shadow-violet-500/20',
    ring: 'ring-violet-500/30',
    toggle: 'bg-violet-500',
  },
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    border: 'border-cyan-500/20 dark:border-cyan-500/30',
    text: 'text-cyan-600 dark:text-cyan-400',
    glow: 'shadow-cyan-500/20',
    ring: 'ring-cyan-500/30',
    toggle: 'bg-cyan-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/20',
    ring: 'ring-emerald-500/30',
    toggle: 'bg-emerald-500',
  },
  teal: {
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    border: 'border-teal-500/20 dark:border-teal-500/30',
    text: 'text-teal-600 dark:text-teal-400',
    glow: 'shadow-teal-500/20',
    ring: 'ring-teal-500/30',
    toggle: 'bg-teal-500',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/20 dark:border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    glow: 'shadow-rose-500/20',
    ring: 'ring-rose-500/30',
    toggle: 'bg-rose-500',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-500/30',
    toggle: 'bg-amber-500',
  },
  indigo: {
    bg: 'bg-accent-soft',
    border: 'border-accent/20 dark:border-accent/30',
    text: 'text-accent',
    glow: 'shadow-accent/20',
    ring: 'ring-accent/30',
    toggle: 'bg-accent',
  },
}

const INTERVAL_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
  { label: '2.5 hr', value: 150 },
  { label: '3 hr', value: 180 },
]

const ToggleSwitch = ({ checked, onChange, colorClass = 'bg-accent' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? colorClass : 'bg-slate-300 dark:bg-slate-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

export const WellnessSettings = () => {
  const {
    globalEnabled,
    setGlobalEnabled,
    reminderSettings,
    toggleReminder,
    setReminderInterval,
    snoozedUntil,
    snooze,
    snoozeRestOfDay,
    clearSnooze,
    isSnoozed,
    notificationPermission,
  } = useWellnessStore()

  const [expandedCard, setExpandedCard] = useState(null)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)

  const snoozed = isSnoozed()
  const enabledCount = WELLNESS_REMINDERS.filter(
    (r) => reminderSettings[r.id]?.enabled
  ).length

  const handleRequestPermission = async () => {
    const result = await armBrowserNotifications()
    useWellnessStore.getState().setNotificationPermission(result)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 dark:from-rose-500/30 dark:to-pink-500/30 border border-rose-500/20 dark:border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <Heart className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">
              Wellness Reminders
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Stay healthy with periodic browser notifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={globalEnabled ? 'success' : 'neutral'}>
            {enabledCount}/{WELLNESS_REMINDERS.length} Active
          </Badge>
          <ToggleSwitch
            checked={globalEnabled}
            onChange={() => setGlobalEnabled(!globalEnabled)}
          />
        </div>
      </div>

      {/* Notification Permission Banner */}
      {notificationPermission !== 'granted' && (
        <Card className="p-4 border-amber-500/30 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-fg">
                Browser Notifications {notificationPermission === 'denied' ? 'Blocked' : 'Not Enabled'}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {notificationPermission === 'denied'
                  ? 'Notifications are blocked. Please enable them in your browser settings. In-app notifications will be used as a fallback.'
                  : 'Grant permission to receive wellness reminders even when this tab is in the background.'}
              </p>
            </div>
            {notificationPermission !== 'denied' && (
              <Button size="sm" variant="primary" onClick={handleRequestPermission}>
                Enable
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Do Not Disturb */}
      <Card className={`p-4 space-y-3 ${snoozed ? 'border-rose-500/30 dark:border-rose-500/30' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {snoozed ? (
              <ShieldOff className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            ) : (
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <h3 className="text-sm font-semibold text-fg">
              Do Not Disturb
            </h3>
          </div>
          {snoozed && (
            <Badge variant="danger">
              Until{' '}
              {new Date(snoozedUntil).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted">
          {snoozed
            ? 'All wellness reminders are paused'
            : 'Temporarily pause all reminders'}
        </p>

        {snoozed ? (
          <Button size="sm" variant="secondary" onClick={clearSnooze} className="w-full">
            Resume Notifications
          </Button>
        ) : (
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              icon={BellOff}
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className="w-full"
            >
              Snooze Reminders
              {showSnoozeMenu ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </Button>

            {showSnoozeMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                {[
                  { label: '30 minutes', mins: 30 },
                  { label: '1 hour', mins: 60 },
                  { label: '2 hours', mins: 120 },
                  { label: 'Rest of day', mins: null },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      opt.mins ? snooze(opt.mins) : snoozeRestOfDay()
                      setShowSnoozeMenu(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-fg hover:bg-chrome transition-colors flex items-center gap-2"
                  >
                    <Timer className="w-3 h-3 text-slate-400" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Reminder Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-fg uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-accent" />
          Individual Reminders
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WELLNESS_REMINDERS.map((reminder) => {
            const settings = reminderSettings[reminder.id] || {}
            const colors = COLOR_MAP[reminder.color] || COLOR_MAP.indigo
            const Icon = ICON_MAP[reminder.icon] || Bell
            const isExpanded = expandedCard === reminder.id

            return (
              <Card
                key={reminder.id}
                className={`p-0 overflow-hidden transition-all duration-300 ${
                  settings.enabled
                    ? `${colors.border} shadow-md ${colors.glow}`
                    : 'border-border opacity-60'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0 transition-all duration-300 ${
                      settings.enabled ? `shadow-lg ${colors.glow}` : ''
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-fg truncate">
                        {reminder.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      {reminder.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setExpandedCard(isExpanded ? null : reminder.id)
                      }
                      className="w-7 h-7 rounded-lg bg-chrome hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <ToggleSwitch
                      checked={settings.enabled}
                      onChange={() => toggleReminder(reminder.id)}
                      colorClass={colors.toggle}
                    />
                  </div>
                </div>

                {/* Expanded Section: Interval Config */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/50 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        Remind every
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {INTERVAL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setReminderInterval(reminder.id, opt.value)
                          }
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            Math.abs((settings.interval || 0) - opt.value) < 0.01
                              ? `${colors.bg} ${colors.text} ${colors.border} border shadow-sm font-semibold`
                              : 'bg-chrome text-muted border border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                      "{reminder.message}"
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>


    </div>
  )
}
