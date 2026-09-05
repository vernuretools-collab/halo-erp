import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { DEFAULT_HEALTH_CONFIG } from './healthScoreDefaults'
import { calculateLiveHealthScore } from './healthScoreEngine'

const CONFIG_DOC_PATH = ['orgSettings', 'healthScoreConfig']

/**
 * Deep-merge saved config over defaults.
 */
export const mergeHealthConfig = (saved) => {
  if (!saved || typeof saved !== 'object') {
    return structuredClone(DEFAULT_HEALTH_CONFIG)
  }
  return {
    ...DEFAULT_HEALTH_CONFIG,
    ...saved,
    pillarWeights: {
      ...DEFAULT_HEALTH_CONFIG.pillarWeights,
      ...(saved.pillarWeights || {}),
    },
    metricWeights: {
      crm: {
        ...DEFAULT_HEALTH_CONFIG.metricWeights.crm,
        ...(saved.metricWeights?.crm || {}),
      },
      finance: {
        ...DEFAULT_HEALTH_CONFIG.metricWeights.finance,
        ...(saved.metricWeights?.finance || {}),
      },
      projects: {
        ...DEFAULT_HEALTH_CONFIG.metricWeights.projects,
        ...(saved.metricWeights?.projects || {}),
      },
      team: {
        ...DEFAULT_HEALTH_CONFIG.metricWeights.team,
        ...(saved.metricWeights?.team || {}),
      },
    },
    targets: {
      ...DEFAULT_HEALTH_CONFIG.targets,
      ...(saved.targets || {}),
    },
    bands: {
      ...DEFAULT_HEALTH_CONFIG.bands,
      ...(saved.bands || {}),
    },
  }
}

/**
 * Load org health score config from Firestore (falls back to defaults).
 */
export const getHealthScoreConfig = async () => {
  try {
    const ref = doc(db, ...CONFIG_DOC_PATH)
    const snap = await getDoc(ref)
    if (!snap.exists()) return structuredClone(DEFAULT_HEALTH_CONFIG)
    return mergeHealthConfig(snap.data())
  } catch (err) {
    console.error('Error fetching health score config:', err)
    return structuredClone(DEFAULT_HEALTH_CONFIG)
  }
}

/**
 * Persist org health score config.
 */
export const saveHealthScoreConfig = async (config) => {
  try {
    const merged = mergeHealthConfig(config)
    const ref = doc(db, ...CONFIG_DOC_PATH)
    await setDoc(
      ref,
      {
        ...merged,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return merged
  } catch (err) {
    console.error('Error saving health score config:', err)
    throw err
  }
}

/**
 * Save a computed health score snapshot to Firestore.
 * Includes Founder-dashboard-compatible flat fields (overall, crm, finance, projects).
 */
export const saveHealthScore = async (scoreData) => {
  try {
    // Firestore rejects `undefined` fields — strip via JSON round-trip
    const cleaned = JSON.parse(
      JSON.stringify({
        ...scoreData,
        overall: scoreData.overallScore ?? scoreData.overall ?? null,
        crm: scoreData.breakdown?.crm?.score ?? scoreData.crm ?? null,
        finance: scoreData.breakdown?.finance?.score ?? scoreData.finance ?? null,
        projects: scoreData.breakdown?.projects?.score ?? scoreData.projects ?? null,
        team: scoreData.breakdown?.team?.score ?? scoreData.team ?? null,
        calculatedAt: scoreData.calculatedAt || new Date().toISOString(),
      })
    )
    const docRef = await addDoc(collection(db, 'healthScores'), cleaned)
    return { scoreId: docRef.id, ...cleaned }
  } catch (err) {
    console.error('Error saving health score to Firestore:', err)
    return null
  }
}

/**
 * Fetch the latest health score from Firestore.
 */
export const getLatestHealthScore = async () => {
  try {
    const q = query(
      collection(db, 'healthScores'),
      orderBy('calculatedAt', 'desc'),
      limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    const data = d.data()
    return {
      scoreId: d.id,
      ...data,
      overallScore: data.overallScore ?? data.overall ?? null,
    }
  } catch (err) {
    console.error('Error fetching latest health score from Firestore:', err)
    return null
  }
}

/**
 * Fetch recent health score history (newest first).
 */
export const getHealthScoreHistory = async (max = 12) => {
  try {
    const q = query(
      collection(db, 'healthScores'),
      orderBy('calculatedAt', 'desc'),
      limit(max)
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        scoreId: d.id,
        ...data,
        overallScore: data.overallScore ?? data.overall ?? null,
      }
    })
  } catch (err) {
    console.error('Error fetching health score history:', err)
    return []
  }
}

/**
 * Recalculate from live data using saved config, persist snapshot, return result.
 */
export const recalculateAndSaveHealthScore = async (previousScore = null) => {
  const config = await getHealthScoreConfig()
  const computed = await calculateLiveHealthScore(config, previousScore)
  const saved = await saveHealthScore(computed)
  return saved || computed
}

// ── Legacy KPI definition helpers (kept for backwards compatibility) ────────

export const getKpiDefinitions = async () => {
  try {
    const snap = await getDocs(collection(db, 'kpiDefinitions'))
    return snap.docs.map((d) => ({ kpiId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching KPI definitions from Firestore:', err)
    return []
  }
}
