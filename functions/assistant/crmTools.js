const { buildEmployeeMonthSummary, getMonthDateBounds, normalizeMonth } = require('./monthSummary')

function compact(value, depth = 0) {
  if (value == null) return value
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString()
    } catch {
      return String(value)
    }
  }
  if (typeof value.seconds === 'number' && value.nanoseconds != null) {
    return new Date(value.seconds * 1000).toISOString()
  }
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((v) => compact(v, depth + 1))
  }
  if (typeof value === 'object') {
    if (depth > 3) return '[object]'
    const out = {}
    Object.keys(value).forEach((k) => {
      if (k === 'password' || k === 'fcmTokens') return
      out[k] = compact(value[k], depth + 1)
    })
    return out
  }
  return value
}

function normalizeEmployee(doc) {
  const data = doc.data() || {}
  return {
    uid: doc.id,
    employeeId: doc.id,
    displayName: data.displayName || data.name || '',
    name: data.name || data.displayName || '',
    email: data.email || '',
    departmentName: data.departmentName || data.department || '',
    roleName: data.roleName || data.role || '',
    status: data.status || 'active',
    joinedAt: data.joinedAt || null,
    createdAt: data.createdAt || null,
    ...data,
  }
}

async function getAllEmployees(db) {
  const snap = await db.collection('employees').get()
  return snap.docs.map(normalizeEmployee)
}

async function findEmployee(db, { query, uid }) {
  const employees = await getAllEmployees(db)
  if (uid) {
    const exact = employees.find((e) => String(e.uid) === String(uid) || String(e.employeeId) === String(uid))
    if (exact) return exact
  }
  const q = String(query || '').trim().toLowerCase()
  if (!q) return null
  return (
    employees.find((e) => String(e.displayName || e.name || '').toLowerCase() === q) ||
    employees.find((e) => String(e.email || '').toLowerCase() === q) ||
    employees.find((e) => String(e.displayName || e.name || '').toLowerCase().includes(q)) ||
    employees.find((e) => String(e.email || '').toLowerCase().includes(q)) ||
    null
  )
}

async function queryByDateRange(db, collectionName, month) {
  const { start, end } = getMonthDateBounds(month)
  try {
    const snap = await db.collection(collectionName).where('date', '>=', start).where('date', '<=', end).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    const snap = await db.collection(collectionName).get()
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((row) => row.date && row.date >= start && row.date <= end)
  }
}

function projectMatchesUid(project, uid) {
  if (!project || !uid) return false
  const id = String(uid)
  if (String(project.employeeId || '') === id) return true
  if (String(project.ownerId || '') === id) return true
  const members = Array.isArray(project.members) ? project.members : []
  return members.some((m) => {
    if (typeof m === 'string') return m === id
    return String(m?.uid || m?.id || m?.employeeId || '') === id
  })
}

function taskMatchesUid(task, uid) {
  if (!task || !uid) return false
  const id = String(uid)
  return (
    String(task.assigneeId || '') === id ||
    String(task.employeeId || '') === id ||
    String(task.createdBy || '') === id
  )
}

function createCrmTools(db) {
  return {
    async searchEmployees({ query }) {
      const q = String(query || '').trim().toLowerCase()
      const employees = await getAllEmployees(db)
      const matches = (q
        ? employees.filter((e) => {
            const blob = `${e.displayName} ${e.name} ${e.email} ${e.departmentName}`.toLowerCase()
            return blob.includes(q)
          })
        : employees
      ).slice(0, 25)
      return {
        count: matches.length,
        employees: matches.map((e) => ({
          uid: e.uid,
          displayName: e.displayName || e.name,
          email: e.email,
          departmentName: e.departmentName,
          roleName: e.roleName,
          status: e.status,
        })),
      }
    },

    async getEmployeeMonthSummary({ query, uid, month }) {
      const employee = await findEmployee(db, { query, uid })
      if (!employee) return { error: 'Employee not found', query, uid }
      const m = normalizeMonth(month)
      const [attendanceLogs, leaveSnap, timelineEntries, holidaySnap] = await Promise.all([
        queryByDateRange(db, 'attendanceLogs', m),
        db.collection('leaveRequests').get(),
        queryByDateRange(db, 'workTimelineEntries', m),
        db.collection('companyHolidays').get(),
      ])
      const leaveRequests = leaveSnap.docs.map((d) => ({ id: d.id, leaveId: d.id, ...d.data() }))
      const holidays = holidaySnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      return buildEmployeeMonthSummary({
        employee,
        month: m,
        attendanceLogs,
        leaveRequests,
        timelineEntries,
        holidays,
      })
    },

    async getEmployeeTimeline({ query, uid, month }) {
      const employee = await findEmployee(db, { query, uid })
      if (!employee) return { error: 'Employee not found', query, uid }
      const m = normalizeMonth(month)
      const { start, end } = getMonthDateBounds(m)
      const empUid = employee.uid
      let entries = []
      try {
        const snap = await db.collection('workTimelineEntries').where('uid', '==', empUid).get()
        entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      } catch {
        entries = await queryByDateRange(db, 'workTimelineEntries', m)
      }
      const filtered = entries
        .filter((e) => e.date && e.date >= start && e.date <= end)
        .filter((e) => !e.uid || String(e.uid) === String(empUid))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(0, 60)
        .map((e) => ({
          date: e.date,
          hours: Number(e.hours) || 0,
          type: e.entryType || 'work',
          description: String(e.description || '').slice(0, 300),
        }))
      return {
        uid: empUid,
        displayName: employee.displayName || employee.name,
        month: m,
        entryCount: filtered.length,
        entries: filtered,
      }
    },

    async getEmployeeProjects({ query, uid }) {
      const employee = await findEmployee(db, { query, uid })
      if (!employee) return { error: 'Employee not found', query, uid }
      const [projSnap, taskSnap] = await Promise.all([
        db.collection('projects').get(),
        db.collection('tasks').get(),
      ])
      const projects = projSnap.docs.map((d) => ({ projectId: d.id, id: d.id, ...d.data() }))
      const tasks = taskSnap.docs.map((d) => ({ taskId: d.id, id: d.id, ...d.data() }))
      const assigned = projects.filter((p) => projectMatchesUid(p, employee.uid))
      const assignedTasks = tasks.filter((t) => taskMatchesUid(t, employee.uid)).slice(0, 40)
      return {
        uid: employee.uid,
        displayName: employee.displayName || employee.name,
        projects: assigned.slice(0, 30).map((p) => ({
          projectId: p.projectId,
          name: p.name,
          status: p.status,
          clientName: p.clientName || p.client || '',
          completionPercentage: p.completionPercentage ?? p.progress ?? null,
        })),
        tasks: assignedTasks.map((t) => ({
          taskId: t.taskId,
          title: t.title || t.name,
          status: t.status,
          projectId: t.projectId || null,
        })),
      }
    },

    async listProjects({ query, limit }) {
      const snap = await db.collection('projects').get()
      const q = String(query || '').trim().toLowerCase()
      let rows = snap.docs.map((d) => ({ projectId: d.id, ...d.data() }))
      if (q) {
        rows = rows.filter((p) =>
          `${p.name} ${p.clientName || ''} ${p.status || ''}`.toLowerCase().includes(q)
        )
      }
      const cap = Math.min(Number(limit) || 25, 40)
      return {
        count: rows.length,
        projects: rows.slice(0, cap).map((p) => ({
          projectId: p.projectId,
          name: p.name,
          status: p.status,
          clientName: p.clientName || p.client || '',
          ownerName: p.ownerName || '',
          completionPercentage: p.completionPercentage ?? p.progress ?? null,
        })),
      }
    },

    async searchLeads({ query, stage, limit }) {
      const snap = await db.collection('leads').get()
      const q = String(query || '').trim().toLowerCase()
      const stageQ = String(stage || '').trim().toLowerCase()
      let rows = snap.docs.map((d) => ({ leadId: d.id, ...d.data() }))
      if (q) {
        rows = rows.filter((l) =>
          `${l.name} ${l.companyName || ''} ${l.contactName || ''} ${l.email || ''}`.toLowerCase().includes(q)
        )
      }
      if (stageQ) {
        rows = rows.filter((l) =>
          `${l.pipelineStage || ''} ${l.pipelineStageId || ''} ${l.status || ''}`.toLowerCase().includes(stageQ)
        )
      }
      const cap = Math.min(Number(limit) || 25, 40)
      const openish = rows.filter((l) => {
        const stageName = String(l.pipelineStage || l.status || '').toLowerCase()
        return !stageName.includes('won') && !stageName.includes('lost')
      })
      return {
        matched: rows.length,
        openCount: openish.length,
        leads: rows.slice(0, cap).map((l) => ({
          leadId: l.leadId,
          name: l.name,
          companyName: l.companyName,
          contactName: l.contactName,
          email: l.email,
          pipelineStage: l.pipelineStage || l.status,
          estimatedValue: l.estimatedValue ?? l.value ?? null,
        })),
      }
    },

    async getInvoiceSummary({ query, status }) {
      const snap = await db.collection('invoices').get()
      const q = String(query || '').trim().toLowerCase()
      const statusQ = String(status || '').trim().toLowerCase()
      let rows = snap.docs.map((d) => ({ invoiceId: d.id, ...d.data() }))
      if (q) {
        rows = rows.filter((i) =>
          `${i.clientName || ''} ${i.invoiceNumber || ''} ${i.status || ''}`.toLowerCase().includes(q)
        )
      }
      if (statusQ) {
        rows = rows.filter((i) => String(i.status || '').toLowerCase().includes(statusQ))
      }
      const unpaid = rows.filter((i) => {
        const st = String(i.status || '').toLowerCase()
        return st !== 'paid' && Number(i.amountDue ?? i.total ?? 0) > 0
      })
      const paid = rows.filter((i) => String(i.status || '').toLowerCase() === 'paid')
      const sum = (list, key) => list.reduce((acc, row) => acc + (Number(row[key]) || 0), 0)
      return {
        invoiceCount: rows.length,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        totalInvoiced: sum(rows, 'total'),
        totalCollected: paid.reduce((acc, i) => acc + (Number(i.total) || 0), 0),
        unpaidDue: unpaid.reduce((acc, i) => acc + (Number(i.amountDue ?? i.total) || 0), 0),
        invoices: rows.slice(0, 25).map((i) => ({
          invoiceId: i.invoiceId,
          clientName: i.clientName,
          status: i.status,
          total: i.total ?? 0,
          amountDue: i.amountDue ?? 0,
          dueDate: i.dueDate || null,
        })),
      }
    },

    async getExpenseSummary({ query }) {
      const snap = await db.collection('expenses').get()
      const q = String(query || '').trim().toLowerCase()
      let rows = snap.docs.map((d) => ({ expenseId: d.id, ...d.data() }))
      if (q) {
        rows = rows.filter((e) =>
          `${e.vendor || ''} ${e.category || ''} ${e.description || ''}`.toLowerCase().includes(q)
        )
      }
      const total = rows.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
      return {
        count: rows.length,
        totalAmount: total,
        expenses: rows.slice(0, 25).map((e) => ({
          expenseId: e.expenseId,
          vendor: e.vendor,
          category: e.category,
          amount: e.amount,
          status: e.status,
          date: e.date || e.createdAt || null,
        })),
      }
    },

    async getRetainerSummary() {
      const snap = await db.collection('retainers').get()
      const rows = snap.docs.map((d) => ({ retainerId: d.id, ...d.data() }))
      return {
        count: rows.length,
        retainers: rows.slice(0, 25).map((r) => ({
          retainerId: r.retainerId,
          clientName: r.clientName,
          status: r.status,
          amount: r.amount ?? r.monthlyAmount ?? null,
        })),
      }
    },

    async getOrgSnapshot() {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const [empSnap, attSnap, leaveSnap, ticketSnap, leadSnap, projectSnap] = await Promise.all([
        db.collection('employees').get(),
        db.collection('attendanceLogs').get(),
        db.collection('leaveRequests').get(),
        db.collection('helpDeskTickets').get(),
        db.collection('leads').get(),
        db.collection('projects').get(),
      ])
      const presentUids = new Set()
      attSnap.docs.forEach((d) => {
        const log = d.data()
        if (log.date !== todayStr) return
        if (log.present === false) return
        const present =
          log.present === true ||
          log.onDuty === true ||
          log.clockedIn ||
          (log.clockInTime && log.clockInTime !== '—')
        if (present) presentUids.add(String(log.uid || log.employeeId || d.id))
      })
      let approvedLeavesToday = 0
      leaveSnap.docs.forEach((d) => {
        const data = d.data()
        if (String(data.status || '').toLowerCase() !== 'approved') return
        const start = data.startDate
        const end = data.endDate || data.startDate
        if (start && end && todayStr >= start && todayStr <= end) approvedLeavesToday += 1
      })
      let openTickets = 0
      ticketSnap.docs.forEach((d) => {
        const data = d.data()
        const st = String(data.status || '').toLowerCase()
        if (st === 'open' || st === 'in_progress' || st === 'pending') openTickets += 1
      })
      return {
        today: todayStr,
        employees: empSnap.size,
        presentToday: presentUids.size,
        approvedLeavesToday,
        openTickets,
        leads: leadSnap.size,
        projects: projectSnap.size,
      }
    },
  }
}

const TOOL_DECLARATIONS = [
  {
    name: 'searchEmployees',
    description: 'Find employees by name, email, or department. Use before other employee tools when only a name is given.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Name, email, or department fragment' },
      },
    },
  },
  {
    name: 'getEmployeeMonthSummary',
    description:
      'Attendance for one employee in a month: present, absent, WFH, on-duty, leave types, timeline hours. month is YYYY-MM; omit for current month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Employee name or email' },
        uid: { type: 'STRING', description: 'Employee document id if known' },
        month: { type: 'STRING', description: 'YYYY-MM' },
      },
    },
  },
  {
    name: 'getEmployeeTimeline',
    description: 'Work timeline entries (description and hours) for an employee in a month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        uid: { type: 'STRING' },
        month: { type: 'STRING' },
      },
    },
  },
  {
    name: 'getEmployeeProjects',
    description: 'Projects and tasks assigned to an employee.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        uid: { type: 'STRING' },
      },
    },
  },
  {
    name: 'listProjects',
    description: 'List or search projects.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        limit: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'searchLeads',
    description: 'Search CRM leads. Filter by pipeline stage such as won, lost, new, open.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        stage: { type: 'STRING' },
        limit: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'getInvoiceSummary',
    description: 'Invoice totals and unpaid invoices. Optional client name or status filter.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
        status: { type: 'STRING' },
      },
    },
  },
  {
    name: 'getExpenseSummary',
    description: 'Expense list and totals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING' },
      },
    },
  },
  {
    name: 'getRetainerSummary',
    description: 'Recurring retainers / billing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Optional client name filter' },
      },
    },
  },
  {
    name: 'getOrgSnapshot',
    description: 'Today snapshot: headcount, present count, leaves today, open tickets, lead and project counts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        note: { type: 'STRING', description: 'Unused. Omit.' },
      },
    },
  },
]

module.exports = {
  createCrmTools,
  TOOL_DECLARATIONS,
  compact,
}
