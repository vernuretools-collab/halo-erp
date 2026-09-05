const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { auth } = require('firebase-functions/v1')
const admin = require('firebase-admin')
const nodemailer = require('nodemailer')
const { createAskAdminAssistant } = require('./assistant/askAdminAssistant')

admin.initializeApp()
const db = admin.firestore()

// Configure Nodemailer Transporter
// Uses environment variables or standard SMTP configuration
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }

  // Fallback to test/json transport for development logging if no credentials set
  return nodemailer.createTransport({
    jsonTransport: true,
  })
}

/**
 * 1. Auth Trigger: Automatically create /users/{uid} document on new registration
 */
exports.onUserCreated = auth.user().onCreate(async (user) => {
  const userRef = db.collection('users').doc(user.uid)
  await userRef.set(
    {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'New Executive',
      photoURL: user.photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      fcmTokens: [],
    },
    { merge: true }
  )
})

/**
 * 2. Firestore Trigger: On Lead Status Changed to "won"
 * Auto-creates Client Portal User & dispatches notification
 */
exports.onLeadWon = onDocumentUpdated(
  'organizations/{orgId}/leads/{leadId}',
  async (event) => {
    const beforeData = event.data.before.data()
    const afterData = event.data.after.data()
    const orgId = event.params.orgId

    if (beforeData.pipelineStageId !== 'stage_won' && afterData.pipelineStageId === 'stage_won') {
      console.log(`Lead ${afterData.name} won for Org ${orgId}. Triggering automation workflow...`)

      // Create notification
      const notifRef = db.collection(`organizations/${orgId}/notifications`).doc()
      await notifRef.set({
        notificationId: notifRef.id,
        recipientId: afterData.ownerId || 'admin',
        title: 'Deal Won! 🎉',
        message: `Opportunity "${afterData.name}" valued at $${afterData.estimatedValue} was successfully won!`,
        type: 'crm',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  }
)

/**
 * 3. Firestore Trigger: On Workflow Execution Log Created
 * Automatically dispatches emails via Nodemailer when actionType is "send_email"
 */
exports.onWorkflowRunCreated = onDocumentCreated('workflowRuns/{runId}', async (event) => {
  const runData = event.data?.data()
  if (!runData) return

  const { actionType, emailConfig, workflowName } = runData

  if (actionType === 'send_email' || (emailConfig && emailConfig.recipientEmail)) {
    const recipient = emailConfig?.recipientEmail || runData.recipientEmail || 'admin@example.com'
    const subject = emailConfig?.subject || `[Automation Alert] Workflow Executed: ${workflowName}`
    const body = emailConfig?.body || `Workflow "${workflowName}" was triggered successfully.\n\nLogs:\n${(runData.logs || []).join('\n')}`

    console.log(`[Nodemailer] Processing automated email dispatch to: ${recipient}`)

    try {
      const transporter = createTransporter()
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Business OS Workflow Engine" <noreply@businessos.com>',
        to: recipient,
        subject: subject,
        text: body,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #0F172A; color: #F8FAFC; border-radius: 12px;">
            <h2 style="color: #818CF8; margin-top: 0;">⚡ Workflow Automation Alert</h2>
            <p><strong>Rule Executed:</strong> ${workflowName}</p>
            <p><strong>Recipient:</strong> ${recipient}</p>
            <hr style="border: 1px solid #334155; margin: 16px 0;" />
            <h3>Execution Summary</h3>
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <div style="margin-top: 20px; font-size: 12px; color: #94A3B8;">
              Dispatched automatically by Business OS Workflow Engine using Nodemailer.
            </div>
          </div>
        `,
      }

      const info = await transporter.sendMail(mailOptions)
      console.log(`[Nodemailer] Email successfully sent. Message ID: ${info.messageId || 'DEV_JSON_DISPATCH'}`)

      // Update Firestore document with email status
      await event.data.ref.update({
        emailStatus: 'sent',
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        mailMessageId: info.messageId || 'DEV_JSON_DISPATCH',
      })
    } catch (err) {
      console.error('[Nodemailer] Error dispatching email:', err)
      await event.data.ref.update({
        emailStatus: 'failed',
        emailError: err.message,
      })
    }
  }
})

/**
 * 4. Scheduled Trigger: Daily Business Health Score Aggregation Engine
 * Runs every day at 00:00 UTC
 */
exports.aggregateHealthScores = onSchedule('0 0 * * *', async (event) => {
  console.log('Running daily Business Health Score aggregation engine...')

  const orgsSnap = await db.collection('organizations').get()

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id

    // Fetch metrics
    const leadsSnap = await db.collection(`organizations/${orgId}/leads`).get()
    const invoicesSnap = await db.collection(`organizations/${orgId}/invoices`).get()

    let totalPipelineValue = 0
    leadsSnap.forEach((d) => {
      totalPipelineValue += Number(d.data().estimatedValue) || 0
    })

    let totalInvoiced = 0
    invoicesSnap.forEach((d) => {
      totalInvoiced += Number(d.data().total) || 0
    })

    // Calculate score
    const healthScore = Math.min(100, Math.max(50, Math.round((totalPipelineValue + totalInvoiced) / 5000)))

    const scoreRef = db.collection(`organizations/${orgId}/healthScores`).doc()
    await scoreRef.set({
      scoreId: scoreRef.id,
      overallScore: healthScore,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      breakdown: {
        crm: { score: 95 },
        finance: { score: 88 },
        projects: { score: 94 },
        team: { score: 91 },
      },
    })
  }
})

/**
 * 5. Firestore Trigger: On Announcement Created
 * Dispatches notifications to all employees when an announcement is published
 */
exports.onAnnouncementCreated = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const announcement = event.data?.data()
  if (!announcement) return

  const announcementId = event.params.announcementId
  console.log(`[Announcements] New announcement created (${announcementId}): "${announcement.title}". Dispatching to employees...`)

  try {
    const stillExists = await db.collection('announcements').doc(announcementId).get()
    if (!stillExists.exists) {
      console.log(`[Announcements] Announcement ${announcementId} was deleted before notify. Skipping.`)
      return
    }

    const empSnap = await db.collection('employees').get()
    const usersSnap = await db.collection('users').get()
    const employeeIds = collectAnnouncementRecipientIds(empSnap, usersSnap)

    if (employeeIds.size === 0) {
      console.log('[Announcements] No active employees found to notify.')
      return
    }

    const previewMessage = announcement.body?.length > 120 
      ? `${announcement.body.slice(0, 120)}...` 
      : (announcement.body || '')

    const nowIso = new Date().toISOString()
    const idList = Array.from(employeeIds)

    const CHUNK_SIZE = 400
    for (let i = 0; i < idList.length; i += CHUNK_SIZE) {
      const chunk = idList.slice(i, i + CHUNK_SIZE)
      const batch = db.batch()

      chunk.forEach((empId) => {
        const notifRef = db.collection(`notifications/${empId}/items`).doc()
        batch.set(notifRef, {
          notificationId: notifRef.id,
          title: `📢 ${announcement.title || 'New Announcement'}`,
          message: previewMessage,
          type: 'announcement',
          priority: (announcement.priority || 'info').toLowerCase(),
          isRead: false,
          announcementId: announcementId,
          link: '/announcements',
          author: announcement.author || 'Admin',
          createdAt: nowIso,
          serverCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })

      await batch.commit()
    }

    const existsAfterWrite = await db.collection('announcements').doc(announcementId).get()
    if (!existsAfterWrite.exists) {
      console.log(`[Announcements] Announcement ${announcementId} deleted during notify. Purging.`)
      await purgeAnnouncementInbox({ employeeIds, announcementId })
      return
    }

    console.log(`[Announcements] Successfully notified ${idList.length} employees for announcement "${announcement.title}".`)

    await sendAnnouncementWebPush({
      usersSnap,
      employeeIds,
      announcementId,
      title: `📢 ${announcement.title || 'New Announcement'}`,
      body: previewMessage,
    })
  } catch (err) {
    console.error('[Announcements] Error broadcasting announcement notifications:', err)
  }
})

exports.onAnnouncementDeleted = onDocumentDeleted('announcements/{announcementId}', async (event) => {
  const announcementId = event.params.announcementId
  console.log(`[Announcements] Announcement deleted (${announcementId}). Removing employee notifications...`)

  try {
    const empSnap = await db.collection('employees').get()
    const usersSnap = await db.collection('users').get()
    const employeeIds = collectAnnouncementRecipientIds(empSnap, usersSnap)

    await purgeAnnouncementInbox({ employeeIds, announcementId })
    await sendAnnouncementDeletedWebPush({ usersSnap, employeeIds, announcementId })
    console.log(`[Announcements] Cleared notifications for deleted announcement ${announcementId}.`)
  } catch (err) {
    console.error('[Announcements] Error clearing notifications for deleted announcement:', err)
  }
})

const INVALID_FCM_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

function collectAnnouncementRecipientIds(empSnap, usersSnap) {
  const employeeIds = new Set()

  empSnap.docs.forEach((d) => {
    const data = d.data()
    if (data.status !== 'inactive' && data.status !== 'terminated') {
      employeeIds.add(d.id)
      if (data.uid) employeeIds.add(data.uid)
    }
  })

  usersSnap.docs.forEach((d) => {
    const data = d.data()
    if (data.role !== 'admin' && data.status !== 'inactive') {
      employeeIds.add(d.id)
      if (data.uid) employeeIds.add(data.uid)
    }
  })

  return employeeIds
}

async function purgeAnnouncementInbox({ employeeIds, announcementId }) {
  const idList = Array.from(employeeIds)
  for (const empId of idList) {
    const itemsSnap = await db
      .collection(`notifications/${empId}/items`)
      .where('announcementId', '==', announcementId)
      .get()
    if (itemsSnap.empty) continue

    const batch = db.batch()
    itemsSnap.docs.forEach((itemDoc) => batch.delete(itemDoc.ref))
    await batch.commit()
  }
}

async function pruneStaleFcmTokens(tokens, responses, tokenToUserIds) {
  const staleByUser = new Map()
  responses.forEach((res, idx) => {
    if (res.success) return
    const code = res.error?.code
    if (!INVALID_FCM_CODES.has(code)) {
      console.warn('[Announcements] FCM send failed:', code, res.error?.message)
      return
    }
    const token = tokens[idx]
    const userIds = tokenToUserIds.get(token)
    userIds?.forEach((uid) => {
      if (!staleByUser.has(uid)) staleByUser.set(uid, [])
      staleByUser.get(uid).push(token)
    })
  })

  await Promise.all(
    Array.from(staleByUser.entries()).map(([uid, staleTokens]) =>
      db.collection('users').doc(uid).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
      })
    )
  )
}

function collectFcmTokens(usersSnap, employeeIds) {
  const tokenToUserIds = new Map()

  usersSnap.docs.forEach((d) => {
    const data = d.data() || {}
    const isRecipient = employeeIds.has(d.id) || (data.uid && employeeIds.has(data.uid))
    if (!isRecipient) return

    const tokens = Array.isArray(data.fcmTokens) ? data.fcmTokens : []
    tokens.forEach((token) => {
      if (!token || typeof token !== 'string') return
      if (!tokenToUserIds.has(token)) tokenToUserIds.set(token, new Set())
      tokenToUserIds.get(token).add(d.id)
    })
  })

  return tokenToUserIds
}

async function sendAnnouncementWebPush({ usersSnap, employeeIds, announcementId, title, body }) {
  const tokenToUserIds = collectFcmTokens(usersSnap, employeeIds)
  const uniqueTokens = Array.from(tokenToUserIds.keys())
  if (uniqueTokens.length === 0) {
    console.log('[Announcements] No FCM tokens registered for web push.')
    return
  }

  const portalBase = (process.env.EMPLOYEE_PORTAL_URL || 'http://localhost:3002').replace(/\/$/, '')
  const link = `${portalBase}/announcements`
  const FCM_CHUNK = 500

  for (let i = 0; i < uniqueTokens.length; i += FCM_CHUNK) {
    const tokens = uniqueTokens.slice(i, i + FCM_CHUNK)
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: 'announcement',
        announcementId: String(announcementId),
        link: '/announcements',
      },
      webpush: {
        notification: {
          title,
          body,
          silent: false,
          tag: `announcement-${announcementId}`,
        },
        fcmOptions: { link },
      },
    })

    await pruneStaleFcmTokens(tokens, response.responses, tokenToUserIds)
    console.log(
      `[Announcements] FCM web push sent ${response.successCount}/${tokens.length} (chunk ${i / FCM_CHUNK + 1}).`
    )
  }
}

async function sendAnnouncementDeletedWebPush({ usersSnap, employeeIds, announcementId }) {
  const tokenToUserIds = collectFcmTokens(usersSnap, employeeIds)
  const uniqueTokens = Array.from(tokenToUserIds.keys())
  if (uniqueTokens.length === 0) return

  const FCM_CHUNK = 500
  for (let i = 0; i < uniqueTokens.length; i += FCM_CHUNK) {
    const tokens = uniqueTokens.slice(i, i + FCM_CHUNK)
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        type: 'announcement_deleted',
        announcementId: String(announcementId),
      },
    })
    await pruneStaleFcmTokens(tokens, response.responses, tokenToUserIds)
  }
}

async function collectTokensForUserIds(userIds) {
  const tokenToUserIds = new Map()
  await Promise.all(
    Array.from(userIds).map(async (uid) => {
      if (!uid) return
      const snap = await db.collection('users').doc(uid).get()
      if (!snap.exists) return
      const tokens = Array.isArray(snap.data()?.fcmTokens) ? snap.data().fcmTokens : []
      tokens.forEach((token) => {
        if (!token || typeof token !== 'string') return
        if (!tokenToUserIds.has(token)) tokenToUserIds.set(token, new Set())
        tokenToUserIds.get(token).add(uid)
      })
    })
  )
  return tokenToUserIds
}

exports.onPayslipInboxItemCreated = onDocumentCreated(
  'notifications/{empId}/items/{itemId}',
  async (event) => {
    const item = event.data?.data()
    if (!item || item.type !== 'payslip') return

    const empId = event.params.empId
    const itemId = event.params.itemId
    const targetUid = item.targetUid || empId
    if (empId !== targetUid) return

    const title = item.title || 'Check your balance'
    const body = item.message || 'Check your balance.'
    const userIds = new Set([empId, targetUid, item.targetUid].filter(Boolean))

    try {
      const empSnap = await db.collection('employees').doc(empId).get()
      if (empSnap.exists && empSnap.data()?.uid) userIds.add(empSnap.data().uid)

      const tokenToUserIds = await collectTokensForUserIds(userIds)
      const tokens = Array.from(tokenToUserIds.keys())
      if (tokens.length === 0) {
        console.log(`[Payslips] No FCM tokens for ${empId}. Inbox notification still written.`)
        return
      }

      const portalBase = (process.env.EMPLOYEE_PORTAL_URL || 'http://localhost:3002').replace(/\/$/, '')
      const link = `${portalBase}/payslips`
      const tag = `payslip-${itemId}`

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          type: 'payslip',
          itemId: String(itemId),
          link: '/payslips',
          tag,
        },
        webpush: {
          notification: {
            title,
            body,
            silent: false,
            tag,
          },
          fcmOptions: { link },
        },
      })

      await pruneStaleFcmTokens(tokens, response.responses, tokenToUserIds)
      console.log(`[Payslips] FCM web push sent ${response.successCount}/${tokens.length} for ${empId}.`)
    } catch (err) {
      console.error('[Payslips] Error sending payslip web push:', err)
    }
  }
)

exports.askAdminAssistant = createAskAdminAssistant(db)

