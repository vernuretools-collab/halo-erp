/** Admin marks these on the employee record. Either one opens QC. Only SMM opens Reels. */
export function employeeIsEditorOrSmm(record) {
  if (!record) return false
  return record.qcEditor === true || record.qcSmm === true
}

export function employeeCanSeeQc(record) {
  return employeeIsEditorOrSmm(record)
}

export function employeeCanSeeReels(record) {
  return record?.qcSmm === true
}

export function qcAccessLabel(record) {
  const parts = []
  if (record?.qcEditor === true) parts.push('Editor')
  if (record?.qcSmm === true) parts.push('SMM')
  return parts.join(' · ')
}
