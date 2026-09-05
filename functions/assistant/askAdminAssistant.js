const { onCall, HttpsError } = require('firebase-functions/v2/https')

const BLOCKED_ROLES = new Set(['employee', 'client'])

async function assertAdmin(request, db) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in as an admin to use the assistant.')
  }
  const token = request.auth.token || {}
  let role = String(token.role || '').toLowerCase()
  if (!role) {
    try {
      const userSnap = await db.collection('users').doc(request.auth.uid).get()
      role = String(userSnap.data()?.role || '').toLowerCase()
    } catch (err) {
      console.warn('[askAdminAssistant] users lookup failed', err?.message || err)
    }
  }
  if (BLOCKED_ROLES.has(role)) {
    throw new HttpsError('permission-denied', 'The assistant is only available to admins.')
  }
  return request.auth.uid
}

function createAskAdminAssistant(db) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'new-crm-8165a'
  return onCall(
    {
      cors: true,
      secrets: ['GEMINI_API_KEY'],
      timeoutSeconds: 120,
      memory: '512MiB',
      // Gen2 defaults to the Compute SA, which often cannot read Firestore.
      serviceAccount: `${projectId}@appspot.gserviceaccount.com`,
    },
    async (request) => {
      await assertAdmin(request, db)
      const apiKey = process.env.GEMINI_API_KEY || ''
      if (!apiKey) {
        throw new HttpsError(
          'failed-precondition',
          'GEMINI_API_KEY is not set. Run: firebase functions:secrets:set GEMINI_API_KEY'
        )
      }
      const message = String(request.data?.message || '').trim()
      if (!message) {
        throw new HttpsError('invalid-argument', 'message is required')
      }
      const history = Array.isArray(request.data?.history) ? request.data.history : []
      const snapshot = request.data?.snapshot || null
      const { createCrmTools } = require('./crmTools')
      const { runAssistantTurn } = require('./geminiLoop')
      try {
        const tools = createCrmTools(db)
        return await runAssistantTurn({ apiKey, message, history, tools, snapshot })
      } catch (err) {
        console.error('[askAdminAssistant]', err)
        if (err instanceof HttpsError) throw err
        const msg = err.message || 'Assistant failed'
        if (err.status === 401 || /oauth|unauthenticated|api key/i.test(msg)) {
          throw new HttpsError(
            'failed-precondition',
            'Gemini rejected the API key. In Google AI Studio create a Gemini API key (AQ. or AIza) and run firebase functions:secrets:set GEMINI_API_KEY, then redeploy.'
          )
        }
        throw new HttpsError('internal', msg)
      }
    }
  )
}

module.exports = { createAskAdminAssistant }
