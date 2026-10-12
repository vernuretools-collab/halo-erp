import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { TeamSubNav } from './components/TeamSubNav'
import { deleteEmployeeOnboarding, getEmployeeOnboarding } from './services/employeeOnboardingService'
import { downloadAllOnboardingPacks, downloadEmploymentPack, downloadHandbookPack, downloadLegalPack, hasIssuedAssets } from './services/onboardingPacks'
import { OnboardingPackViewer } from '../../../../shared/onboarding/OnboardingPackViewer.jsx'
import { FIXED_KRAS, ONBOARDING_STATUS, joiningPageUrl } from '../../../../shared/supabase/employeeOnboarding.js'
import haloLogo from '../../assets/halologo.png'
import { KYC_DOCUMENTS, POLICY_ITEMS, declarationText, policyLabel } from '../../../../shared/supabase/joiningForm.js'
import { ArrowLeft, Copy, Trash2 } from 'lucide-react'

const SUMMARY_FIELDS = [
  ['employeeId', 'Employee ID'],
  ['designation', 'Designation'],
  ['department', 'Department'],
  ['reportingManager', 'Reporting manager'],
  ['dateOfJoining', 'Date of joining'],
  ['workMode', 'Work mode'],
  ['monthlyCtc', 'Monthly CTC (₹)'],
]

const EXTRA_FIELDS = [
  ['probationPeriod', 'Probation period'],
  ['workLocation', 'Work location'],
  ['assets', 'Assets to be issued'],
  ['issueDate', 'Issue date'],
]

function policyParts(text) {
  const [title, ...rest] = String(text || '').split(' — ')
  return { title, body: rest.join(' — ') }
}

function FactGrid({ fields, source }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
      {fields.map(([key, label]) => (
        <div key={key}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="text-sm text-fg mt-0.5 whitespace-pre-wrap">{source[key] || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function AnswerCard({ title, rows }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">{title}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-sm text-fg mt-0.5 whitespace-pre-wrap">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export const EmployeeOnboardingDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false
    getEmployeeOnboarding(id)
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this record.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const employment = row?.employment || {}
  const customKras = row?.kras?.custom || []
  const fixedKras = row?.kras?.fixed?.length ? row.kras.fixed : FIXED_KRAS
  const answers = row?.answers && typeof row.answers === 'object' ? row.answers : {}
  const personal = answers.personal || {}
  const bank = answers.bank || {}
  const kyc = answers.kyc || {}
  const emergency = answers.emergency || {}
  const policies = answers.policies || {}
  const documents = Array.isArray(row?.documents) ? row.documents : []
  const submitted = row?.status === ONBOARDING_STATUS.SUBMITTED
  const kraRows = [...customKras, ...fixedKras]
  const kraTotal = kraRows.reduce((sum, kra) => sum + (Number(kra.weight) || 0), 0)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joiningPageUrl())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const confirmDelete = async () => {
    if (!row || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteEmployeeOnboarding(row.id)
      navigate('/team/onboarding')
    } catch (err) {
      setDeleteError(err.message || 'Could not delete this onboarding record.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <TeamSubNav />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && !row && <p className="text-sm text-muted">This onboarding record was not found.</p>}

      {row && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-fg tracking-tight">
                  {employment.fullName || 'Onboarding record'}
                </h1>
                <Badge variant={submitted ? 'success' : 'warning'}>
                  {submitted ? 'Submitted' : 'Waiting for answers'}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-1">
                {[employment.employeeId, employment.department, row.username].filter(Boolean).join(' · ') || row.username}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/team/onboarding">
                <Button type="button" variant="secondary" icon={ArrowLeft}>Back</Button>
              </Link>
              <Button type="button" variant="outline" icon={Copy} onClick={copyLink}>
                {copied ? 'Link copied' : 'Copy joining link'}
              </Button>
              <Button type="button" variant="danger" icon={Trash2} onClick={() => { setDeleteError(''); setConfirming(true) }}>
                Delete
              </Button>
            </div>
          </div>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-4">Employment</p>
            <FactGrid fields={SUMMARY_FIELDS} source={employment} />
            <div className="mt-4 pt-4 border-t border-border">
              <FactGrid fields={EXTRA_FIELDS.filter(([key]) => key !== 'assets' || hasIssuedAssets(employment.assets))} source={employment} />
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">KRA / KPI</p>
              <p className="text-xs text-muted">Total {kraTotal}%</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-chrome text-muted text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Key Result Area</th>
                  <th className="text-left px-4 py-2 font-semibold">KPI / Metric</th>
                  <th className="text-left px-4 py-2 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {customKras.map((kra, index) => (
                  <tr key={`custom-${index}`} className="border-t border-border">
                    <td className="px-4 py-2">{kra.keyResultArea || '—'}</td>
                    <td className="px-4 py-2">{kra.kpi || '—'}</td>
                    <td className="px-4 py-2">{kra.weight}%</td>
                  </tr>
                ))}
                {fixedKras.map((kra) => (
                  <tr key={kra.keyResultArea} className="border-t border-border bg-chrome/40">
                    <td className="px-4 py-2">{kra.keyResultArea}</td>
                    <td className="px-4 py-2">{kra.kpi}</td>
                    <td className="px-4 py-2">{kra.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {!submitted && (
            <Card>
              <p className="text-sm text-fg">Waiting for the hire to submit the joining form.</p>
              <p className="text-sm text-muted mt-1">PDF downloads appear here after they submit.</p>
            </Card>
          )}

          {submitted && (
            <>
            <OnboardingPackViewer
              row={row}
              logo={haloLogo}
              footer={(
                <div className="px-6 pb-6 flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={() => downloadAllOnboardingPacks(row)}>Download all 3 PDFs</Button>
                  <Button type="button" variant="secondary" onClick={() => downloadEmploymentPack(row)}>Employment Agreement Pack</Button>
                  <Button type="button" variant="secondary" onClick={() => downloadLegalPack(row)}>Legal Agreements & HR Records</Button>
                  <Button type="button" variant="secondary" onClick={() => downloadHandbookPack(row)}>Employee Handbook & Performance Pack</Button>
                </div>
              )}
            />
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Documents</p>
              <p className="text-sm text-muted">The filled packs are above. You can download them anytime.</p>
              {documents.length > 0 && (
                <ul className="space-y-2 text-sm mt-3">
                  {documents.map((doc) => (
                    <li key={doc.path || doc.name}>
                      {doc.url ? <a className="text-accent" href={doc.url}>{doc.name || 'Document'}</a> : (doc.name || 'Document')}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
              <AnswerCard title="Personal" rows={[
                ['Full name', personal.fullName],
                ['Date of birth', personal.dateOfBirth],
                ['Gender', personal.gender],
                ['Nationality', personal.nationality],
                ['Aadhaar', personal.aadhaar],
                ['PAN', personal.pan],
                ['Mobile', personal.mobile],
                ['Email', personal.email],
                ['Permanent address', personal.permanentAddress],
                ['Current address', personal.currentAddress],
                ["Father's name", personal.fatherName],
                ["Mother's name", personal.motherName],
                ['Marital status', personal.maritalStatus],
                ['Blood group', personal.bloodGroup],
              ]} />
              <AnswerCard title="Conflict of interest" rows={[
                ['Family business in a related field', answers.employment?.conflictOfInterest],
              ]} />
              <AnswerCard title="Bank" rows={[
                ['Bank name', bank.bankName],
                ['Account holder', bank.accountHolder],
                ['Account number', bank.accountNumber],
                ['IFSC', bank.ifsc],
                ['Branch & city', bank.branchCity],
                ['Account type', bank.accountType],
                ['UAN', bank.uan],
              ]} />
              <AnswerCard title="KYC" rows={[
                ['Highest qualification', kyc.qualification],
                ['Institution & year', kyc.institutionYear],
                ['Last employer', kyc.lastEmployer],
                ['Last designation', kyc.lastDesignation],
                ['Documents on joining day', (kyc.documents || []).filter((name) => KYC_DOCUMENTS.includes(name)).join(', ')],
                ['Previous obligations', kyc.obligations],
              ]} />
              <AnswerCard title="Emergency" rows={[
                ['Primary contact', emergency.primaryName],
                ['Relationship', emergency.primaryRelationship],
                ['Mobile', emergency.primaryMobile],
                ['Address', emergency.address],
                ['Secondary contact', emergency.secondaryName],
                ['Secondary relationship', emergency.secondaryRelationship],
                ['Secondary mobile', emergency.secondaryMobile],
                ['Allergies / conditions', emergency.allergies],
              ]} />

              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Policies</p>
                <ul className="space-y-3">
                  {POLICY_ITEMS.map((item) => {
                    const acknowledged = Boolean(policies[item.id])
                    const { title, body } = policyParts(policyLabel(item))
                    return (
                      <li key={item.id} className="border border-border rounded-xl px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-fg">{title}</p>
                          <Badge variant={acknowledged ? 'success' : 'neutral'}>
                            {acknowledged ? 'Acknowledged' : 'Not acknowledged'}
                          </Badge>
                        </div>
                        {body && <p className="text-sm text-muted mt-1">{body}</p>}
                      </li>
                    )
                  })}
                </ul>
              </Card>

              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Signature</p>
                {String(answers.signature || '').startsWith('data:image') ? (
                  <div className="inline-block bg-white rounded-xl border border-border p-2">
                    <img src={answers.signature} alt="Hire signature" className="h-20 max-w-xs object-contain" />
                  </div>
                ) : (
                  <p className="text-sm text-muted">No signature image.</p>
                )}
                <p className="text-sm text-muted mt-3">{declarationText(personal.fullName)}</p>
              </Card>
            </>
          )}
        </>
      )}

      <Modal
        open={confirming}
        onClose={() => { if (!deleting) setConfirming(false) }}
        title="Delete onboarding record"
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg">
          Delete {employment.fullName || 'this hire'}{row?.username ? ` (${row.username})` : ''}? This removes the onboarding record and the joining login.
        </p>
        {deleteError && <p className="text-sm text-rose-600 mt-3">{deleteError}</p>}
      </Modal>
    </div>
  )
}
