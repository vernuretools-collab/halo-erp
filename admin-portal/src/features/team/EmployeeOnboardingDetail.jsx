import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TeamSubNav } from './components/TeamSubNav'
import { getEmployeeOnboarding } from './services/employeeOnboardingService'
import { downloadAllOnboardingPacks, downloadEmploymentPack, downloadHandbookPack, downloadLegalPack, hasIssuedAssets } from './services/onboardingPacks'
import { OnboardingPackViewer } from '../../../../shared/onboarding/OnboardingPackViewer.jsx'
import { FIXED_KRAS, ONBOARDING_STATUS, joiningPageUrl } from '../../../../shared/supabase/employeeOnboarding.js'
import haloLogo from '../../assets/halologo.png'
import { KYC_DOCUMENTS, POLICY_ITEMS, declarationText } from '../../../../shared/supabase/joiningForm.js'

const EMPLOYMENT_FIELDS = [
  ['employeeId', 'Employee ID'],
  ['fullName', 'Full name'],
  ['designation', 'Designation'],
  ['department', 'Department'],
  ['reportingManager', 'Reporting manager'],
  ['dateOfJoining', 'Date of joining'],
  ['workMode', 'Work mode'],
  ['monthlyCtc', 'Monthly CTC (₹)'],
  ['probationPeriod', 'Probation period'],
  ['workLocation', 'Work location'],
  ['assets', 'Assets to be issued'],
  ['issueDate', 'Issue date'],
]

function AnswerBlock({ title, rows }) {
  return (
    <div>
      <p className="text-xs font-semibold text-fg mb-2">{title}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-sm text-fg mt-0.5 whitespace-pre-wrap">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export const EmployeeOnboardingDetail = () => {
  const { id } = useParams()
  const [row, setRow] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={employment.fullName || 'Onboarding record'}
        description={row ? `Joining username ${row.username}. Share ${joiningPageUrl()} — this login cannot open the employee portal.` : 'Employment details captured for this hire.'}
      />
      <TeamSubNav />
      <Link to="/team/onboarding" className="text-sm text-accent font-medium">← Back to onboarding list</Link>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && !row && <p className="text-sm text-muted">This onboarding record was not found.</p>}

      {row && (
        <>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-4">Employment details</p>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {EMPLOYMENT_FIELDS.filter(([key]) => key !== 'assets' || hasIssuedAssets(employment.assets)).map(([key, label]) => (
                <div key={key}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-sm text-fg mt-1">{employment[key] || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-0 overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent px-5 pt-5">KRA / KPI</p>
            <table className="w-full text-sm mt-3">
              <thead className="bg-accent text-white text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Key Result Area</th>
                  <th className="text-left px-4 py-2 font-semibold">KPI / Metric</th>
                  <th className="text-left px-4 py-2 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {customKras.map((kra, index) => (
                  <tr key={`custom-${index}`} className="border-t border-border">
                    <td className="px-4 py-2">{kra.keyResultArea}</td>
                    <td className="px-4 py-2">{kra.kpi}</td>
                    <td className="px-4 py-2">{kra.weight}%</td>
                  </tr>
                ))}
                {fixedKras.map((kra) => (
                  <tr key={kra.keyResultArea} className="border-t border-border bg-chrome/60">
                    <td className="px-4 py-2">{kra.keyResultArea}</td>
                    <td className="px-4 py-2">{kra.kpi}</td>
                    <td className="px-4 py-2">{kra.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Joining form</p>
            {!submitted && <p className="text-sm text-muted">Waiting for the hire to submit the joining form.</p>}
            {submitted && (
              <div className="space-y-6 text-sm">
                <AnswerBlock title="Personal" rows={[
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
                <AnswerBlock title="Conflict of interest" rows={[
                  ['Family business in a related field', answers.employment?.conflictOfInterest],
                ]} />
                <AnswerBlock title="Bank" rows={[
                  ['Bank name', bank.bankName],
                  ['Account holder', bank.accountHolder],
                  ['Account number', bank.accountNumber],
                  ['IFSC', bank.ifsc],
                  ['Branch & city', bank.branchCity],
                  ['Account type', bank.accountType],
                  ['UAN', bank.uan],
                ]} />
                <AnswerBlock title="KYC" rows={[
                  ['Highest qualification', kyc.qualification],
                  ['Institution & year', kyc.institutionYear],
                  ['Last employer', kyc.lastEmployer],
                  ['Last designation', kyc.lastDesignation],
                  ['Documents on joining day', (kyc.documents || []).filter((name) => KYC_DOCUMENTS.includes(name)).join(', ')],
                  ['Previous obligations', kyc.obligations],
                ]} />
                <AnswerBlock title="Emergency" rows={[
                  ['Primary contact', emergency.primaryName],
                  ['Relationship', emergency.primaryRelationship],
                  ['Mobile', emergency.primaryMobile],
                  ['Address', emergency.address],
                  ['Secondary contact', emergency.secondaryName],
                  ['Secondary relationship', emergency.secondaryRelationship],
                  ['Secondary mobile', emergency.secondaryMobile],
                  ['Allergies / conditions', emergency.allergies],
                ]} />
                <div>
                  <p className="text-xs font-semibold text-fg mb-2">Policies</p>
                  <ul className="space-y-1 text-muted">
                    {POLICY_ITEMS.map((item) => (
                      <li key={item.id}>{policies[item.id] ? 'Acknowledged' : 'Not acknowledged'} — {item.text}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-fg mb-2">Signature</p>
                  {String(answers.signature || '').startsWith('data:image') ? (
                    <img src={answers.signature} alt="Hire signature" className="max-h-32 border border-border rounded-xl bg-white" />
                  ) : (
                    <p className="text-muted">No signature image.</p>
                  )}
                  <p className="text-muted mt-3">{declarationText(personal.fullName)}</p>
                </div>
              </div>
            )}
          </Card>

          {submitted && (
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
          )}

          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Documents</p>
            {submitted ? (
              <p className="text-sm text-muted">The filled packs are above. You can download them anytime.</p>
            ) : (
              <p className="text-sm text-muted">
                After the hire reviews and submits the 3 packs, they appear here for download anytime.
              </p>
            )}
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
        </>
      )}
    </div>
  )
}
