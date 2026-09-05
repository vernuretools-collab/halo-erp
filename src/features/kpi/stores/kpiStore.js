import { create } from 'zustand'

export const useKPIStore = create((set) => ({
  kpiDefinitions: [],
  latestScore: {
    overallScore: 0,
    previousScore: 0,
    trend: 'stable',
    calculatedAt: new Date().toISOString(),
    breakdown: { crm: { score: 0 }, finance: { score: 0 }, projects: { score: 0 }, team: { score: 0 } },
    risks: [],
    recommendations: [],
  },

  setKpiDefinitions: (kpiDefinitions) => set({ kpiDefinitions }),
  setLatestScore: (latestScore) => set({ latestScore }),

  addKpiDefinition: (newKpi) =>
    set((state) => ({
      kpiDefinitions: [
        {
          kpiId: `kpi_${Date.now()}`,
          currentValue: newKpi.targetValue || 0,
          status: 'on_track',
          ...newKpi,
        },
        ...state.kpiDefinitions,
      ],
    })),

  deleteKpiDefinition: (kpiId) =>
    set((state) => ({
      kpiDefinitions: state.kpiDefinitions.filter((k) => k.kpiId !== kpiId),
    })),

  recalculateHealthScore: () =>
    set((state) => {
      if (state.kpiDefinitions.length === 0) return state

      const totalWeight = state.kpiDefinitions.reduce(
        (sum, k) => sum + (k.healthScoreWeight || 0.25),
        0
      )
      const weightedSum = state.kpiDefinitions.reduce((sum, k) => {
        let kScore = 100
        if (k.currentValue < k.targetValue) {
          kScore = Math.round((k.currentValue / k.targetValue) * 100)
        }
        return sum + kScore * (k.healthScoreWeight || 0.25)
      }, 0)

      const finalScore = Math.round(weightedSum / (totalWeight || 1))

      return {
        latestScore: {
          ...state.latestScore,
          overallScore: Math.min(100, Math.max(0, finalScore)),
          calculatedAt: new Date().toISOString(),
        },
      }
    }),
}))
