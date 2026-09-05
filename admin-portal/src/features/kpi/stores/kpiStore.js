import { create } from 'zustand'
import { DEFAULT_HEALTH_CONFIG } from '../services/healthScoreDefaults'
import {
  getHealthScoreConfig,
  saveHealthScoreConfig,
  getLatestHealthScore,
  getHealthScoreHistory,
  recalculateAndSaveHealthScore,
} from '../services/kpiService'

const DEFAULT_HEALTH_SCORE = {
  scoreId: null,
  overallScore: null,
  previousScore: null,
  trend: 'stable',
  band: 'insufficient_data',
  bandLabel: 'Insufficient Data',
  calculatedAt: null,
  breakdown: {
    crm: { score: null, hasData: false, weight: 0.3, label: 'Pipeline', metrics: [] },
    finance: { score: null, hasData: false, weight: 0.3, label: 'Revenue', metrics: [] },
    projects: { score: null, hasData: false, weight: 0.25, label: 'Delivery', metrics: [] },
    team: { score: null, hasData: false, weight: 0.15, label: 'Team', metrics: [] },
  },
  metrics: {},
  risks: [],
  recommendations: [],
  contributors: { positive: [], negative: [] },
  overall: null,
  crm: null,
  finance: null,
  projects: null,
  team: null,
}

const STALE_MS = 24 * 60 * 60 * 1000

export const useKPIStore = create((set, get) => ({
  config: structuredClone(DEFAULT_HEALTH_CONFIG),
  latestScore: DEFAULT_HEALTH_SCORE,
  history: [],
  isLoading: false,
  isRecalculating: false,
  isSavingConfig: false,
  error: null,

  setConfig: (config) => set({ config }),
  setLatestScore: (latestScore) => set({ latestScore }),
  setHistory: (history) => set({ history }),
  setIsLoading: (isLoading) => set({ isLoading }),

  /**
   * Load config, latest score, and history. Auto-recalculate if stale/missing.
   */
  loadHealthData: async ({ autoRecalculateIfStale = true } = {}) => {
    set({ isLoading: true, error: null })
    try {
      const [config, latest, history] = await Promise.all([
        getHealthScoreConfig(),
        getLatestHealthScore(),
        getHealthScoreHistory(12),
      ])

      set({
        config,
        latestScore: latest
          ? {
              ...DEFAULT_HEALTH_SCORE,
              ...latest,
              overallScore: latest.overallScore ?? latest.overall ?? null,
            }
          : DEFAULT_HEALTH_SCORE,
        history,
      })

      if (autoRecalculateIfStale) {
        const calculatedAt = latest?.calculatedAt
          ? new Date(latest.calculatedAt).getTime()
          : 0
        const isStale = !latest || Date.now() - calculatedAt > STALE_MS
        if (isStale) {
          await get().recalculateHealthScore()
        }
      }
    } catch (err) {
      console.error('Error loading health data:', err)
      set({ error: err.message || 'Failed to load health data' })
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Live recalculate from Firestore collections and persist snapshot.
   */
  recalculateHealthScore: async () => {
    set({ isRecalculating: true, error: null })
    try {
      const prev = get().latestScore?.overallScore ?? null
      const result = await recalculateAndSaveHealthScore(prev)
      const history = await getHealthScoreHistory(12)
      set({
        latestScore: {
          ...DEFAULT_HEALTH_SCORE,
          ...result,
          overallScore: result.overallScore ?? result.overall ?? null,
        },
        history,
      })
      return result
    } catch (err) {
      console.error('Error recalculating health score:', err)
      set({ error: err.message || 'Failed to recalculate health score' })
      return null
    } finally {
      set({ isRecalculating: false })
    }
  },

  /**
   * Update local config draft (settings page).
   */
  updateConfigDraft: (partial) =>
    set((state) => ({
      config: {
        ...state.config,
        ...partial,
        pillarWeights: {
          ...state.config.pillarWeights,
          ...(partial.pillarWeights || {}),
        },
        targets: {
          ...state.config.targets,
          ...(partial.targets || {}),
        },
        bands: {
          ...state.config.bands,
          ...(partial.bands || {}),
        },
        metricWeights: partial.metricWeights
          ? {
              ...state.config.metricWeights,
              ...partial.metricWeights,
            }
          : state.config.metricWeights,
      },
    })),

  /**
   * Persist config to Firestore, then optionally recalculate.
   */
  saveConfig: async ({ recalculate = true } = {}) => {
    set({ isSavingConfig: true, error: null })
    try {
      const saved = await saveHealthScoreConfig(get().config)
      set({ config: saved })
      if (recalculate) {
        await get().recalculateHealthScore()
      }
      return saved
    } catch (err) {
      console.error('Error saving health config:', err)
      set({ error: err.message || 'Failed to save settings' })
      return null
    } finally {
      set({ isSavingConfig: false })
    }
  },

  resetConfigToDefaults: () =>
    set({ config: structuredClone(DEFAULT_HEALTH_CONFIG) }),
}))
