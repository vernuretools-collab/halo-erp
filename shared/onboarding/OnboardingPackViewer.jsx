import React, { useState } from 'react'
import { FileText, Scale, BookOpen } from 'lucide-react'
import { buildOnboardingPackContext } from '../../admin-portal/src/features/team/services/onboardingPacks.js'
import { formatPackDate } from '../../admin-portal/src/features/team/services/onboardingPdf.js'
import './onboardingPack.css'

const TABS = [
  { id: 'employment', label: 'Doc 1 — Employment', icon: FileText, docNo: '1', title: 'Employment Agreement Pack', subtitle: 'Offer Letter · Appointment Agreement · Job Description · Probation Terms', titleClass: '' },
  { id: 'legal', label: 'Doc 2 — Legal & HR', icon: Scale, docNo: '2', title: 'Legal Agreements & HR Records', subtitle: 'NDA · Confidentiality · IP · Data Protection · Conflict of Interest · HR Forms · Declarations', titleClass: 'is-legal' },
  { id: 'handbook', label: 'Doc 3 — Handbook', icon: BookOpen, docNo: '3', title: 'Employee Handbook & Performance Pack', subtitle: 'All HR Policies · Compliance · Technology · KRA/KPI · Learning Plan · Reviews', titleClass: 'is-handbook' },
]

function Fill({ children }) {
  const text = children == null || children === '' ? '' : String(children)
  if (!text) return <span className="pack-mute">—</span>
  return <span className="pack-fill">{text}</span>
}

function Forever() {
  return <span className="pack-forever">FOREVER</span>
}

function Checks({ items }) {
  return (
    <div className="pack-checks">
      {items.map((item) => (
        <span key={item.label} className="pack-check">
          <span className="pack-box">{item.checked ? '✓' : ''}</span>
          {item.label}
        </span>
      ))}
    </div>
  )
}

function kycChecked(documents, needles, excludes = []) {
  return (documents || []).some((doc) => {
    const text = String(doc).toLowerCase()
    if (excludes.some((ex) => text.includes(ex))) return false
    return needles.some((needle) => text.includes(needle))
  })
}

function PageFoot() {
  return (
    <div className="pack-foot">
      <div>The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050</div>
      <div style={{ textAlign: 'right' }}>
        +91 73977 78891 · hello@thehaloeffectconsulting.com
        <br />
        www.thehaloeffectconsulting.com
      </div>
    </div>
  )
}

function BrandHead({ logo }) {
  return (
    <div className="pack-head">
      <div className="pack-lockup">
        {logo ? <img src={logo} alt="" /> : null}
        <div>
          <strong>THE HALO EFFECT</strong>
          <em>CONSULTING</em>
        </div>
      </div>
      <div className="pack-head-right">
        The Halo Effect Consulting LLP
        <span>Where Insights Meet Influence</span>
      </div>
    </div>
  )
}

function Cover({ logo, tab }) {
  return (
    <div className={`pack-cover ${tab.titleClass || ''}`}>
      {logo ? <img className="pack-logo" src={logo} alt="The Halo Effect Consulting" /> : null}
      <div className="pack-brand-name">THE HALO EFFECT</div>
      <div className="pack-brand-sub">CONSULTING</div>
      <div className="pack-docno">DOCUMENT {tab.docNo} OF 3</div>
      <h2 className={`pack-title ${tab.titleClass}`}>{tab.title}</h2>
      <p className="pack-subtitle">{tab.subtitle}</p>
    </div>
  )
}

function Identity({ ctx }) {
  const cells = [
    ['EMPLOYEE NAME', ctx.name, 'EMPLOYEE ID', ctx.id],
    ['DESIGNATION', ctx.designation, 'DEPARTMENT', ctx.department],
    ['DATE OF JOINING', ctx.joining, 'ISSUED ON', ctx.issued],
  ]
  return (
    <table className="pack-id">
      <tbody>
        {cells.map(([l1, v1, l2, v2]) => (
          <tr key={l1}>
            <td>
              <span className="pack-lbl">{l1}</span>
              <Fill>{v1}</Fill>
            </td>
            <td>
              <span className="pack-lbl">{l2}</span>
              <Fill>{v2}</Fill>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Contents({ items, note }) {
  return (
    <table className="pack-toc">
      <thead>
        <tr><th colSpan={2}>Contents</th></tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.letter}>
            <td>{item.letter}</td>
            <td>{item.label}</td>
          </tr>
        ))}
        {note ? (
          <tr>
            <td colSpan={2}><span className="pack-note">{note}</span></td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}

function Rows({ items }) {
  return (
    <table className="pack-rows">
      <tbody>
        {items.map(([label, value]) => (
          <tr key={label}>
            <td>{label}</td>
            <td><Fill>{value}</Fill></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SectionTitle({ badge, title, kicker }) {
  return (
    <>
      {badge ? <div className="pack-badge">{badge}</div> : null}
      <h3 className="pack-h">{title}</h3>
      {kicker ? <p className="pack-kicker">{kicker}</p> : null}
      <div className="pack-rule" />
    </>
  )
}

function DataTable({ headers, rows, fillUntil = 0 }) {
  return (
    <table className="pack-grid">
      <thead>
        <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className={index < fillUntil ? 'is-fill' : undefined}>
            {row.map((cell, cellIndex) => (
              <td key={`${index}-${cellIndex}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Col({ title, items }) {
  return (
    <div>
      <h4 className="pack-sub" style={{ marginTop: 0 }}>{title}</h4>
      <ul className="pack-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function AssetTable({ items, mode }) {
  const headers = mode === 'return'
    ? ['#', 'Asset description', 'Serial / IMEI', 'Condition at return', 'Remarks']
    : ['#', 'Asset description', 'Brand / Model', 'Serial / IMEI', 'Condition']
  const rows = (items.length ? items : ['']).map((item, index) => (
    mode === 'return' ? [index + 1, item, '', '', ''] : [index + 1, item, '', '', '']
  ))
  return (
    <table className="pack-assets">
      <thead>
        <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td key={`${row[0]}-${index}`}>
                {index === 1 ? <Fill>{cell}</Fill> : <span className="pack-mute">{cell || '____________'}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SignOff({ ctx }) {
  return (
    <table className="pack-sign">
      <tbody>
        <tr>
          <td>
            {ctx.signature?.startsWith('data:image') ? <img src={ctx.signature} alt="Employee signature" /> : null}
            <div className="cap">Employee</div>
            <div><Fill>{ctx.name}</Fill></div>
            <div className="pack-note"><Fill>{ctx.designation}</Fill></div>
            <div className="line">Signature &amp; date · Place: Chennai</div>
          </td>
          <td>
            <div className="cap">Authorised signatory</div>
            <div style={{ color: '#0f766e', fontWeight: 600 }}>Swathish G</div>
            <div className="pack-note">Co-Founder &amp; Authorised Signatory · The Halo Effect Consulting LLP</div>
            <div className="line">Signature, seal &amp; date</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function Page({ children, logo, branded }) {
  return (
    <article className="pack-page">
      {branded ? <BrandHead logo={logo} /> : null}
      {children}
      <PageFoot />
    </article>
  )
}

function EmploymentBody({ ctx, logo, tab }) {
  const duties = ctx.kras.slice(0, 6)
  const offerTerms = [
    ['Designation', ctx.designation],
    ['Department', ctx.department],
    ['Reporting To', ctx.manager],
    ['Date of Joining', ctx.joining],
    ['Work Location', ctx.location],
    ['Work Mode', ctx.mode],
    ['Monthly CTC (Gross)', ctx.ctc ? `₹ ${ctx.ctc}` : ''],
    ['Probation Period', ctx.probation],
    ['Notice Period (Probation)', '30 days'],
    ['Notice Period (Post-Confirmation)', '60 days'],
    ...(ctx.hasAssets ? [['Assets to be Issued', ctx.assets]] : []),
  ]
  return (
    <>
      <Page logo={logo}>
        <Cover logo={logo} tab={tab} />
        <Identity ctx={ctx} />
        <Contents
          items={[
            { letter: 'A', label: 'Offer Letter' },
            { letter: 'B', label: 'Appointment & Employment Agreement' },
            { letter: 'C', label: 'Job Description' },
            { letter: 'D', label: 'Probation & Confirmation Terms' },
          ]}
          note="One master signature at the end of this pack covers all sections."
        />
        <p className="pack-conf">PRIVATE &amp; CONFIDENTIAL · FOR EMPLOYEE USE ONLY · THE HALO EFFECT CONSULTING LLP</p>
      </Page>

      <Page logo={logo}>
        <SectionTitle badge="SECTION A" title="Offer Letter" kicker="Employment Pack · The Halo Effect Consulting LLP" />
        <p className="pack-p">Date: <Fill>{ctx.issued}</Fill> &nbsp;|&nbsp; Private &amp; Confidential</p>
        <p className="pack-p">To,</p>
        <p className="pack-p"><Fill>{ctx.name}</Fill></p>
        <p className="pack-p"><Fill>{ctx.address}</Fill></p>
        <p className="pack-p"><strong>Subject: Offer of Employment — <Fill>{ctx.designation}</Fill></strong></p>
        <p className="pack-p">Dear <Fill>{ctx.first}</Fill>,</p>
        <p className="pack-p">
          We are pleased to extend this offer of employment to you for the position of <Fill>{ctx.designation}</Fill> in our <Fill>{ctx.department}</Fill> department at The Halo Effect Consulting LLP, effective <Fill>{ctx.joining}</Fill>. This offer is subject to your acceptance of all terms herein and execution of all documents in this onboarding pack.
        </p>
        <h4 className="pack-sub">Key terms</h4>
        <Rows items={offerTerms} />
        <h4 className="pack-sub">Conditions</h4>
        <p className="pack-p">This offer is conditional upon: (a) verification of all documents; (b) satisfactory background verification; (c) execution of all onboarding documents; (d) confirmation that you are not bound by any conflicting restriction from a former employer. This offer lapses if not accepted within <strong>5 working days</strong>.</p>
        <p className="pack-p">Yours sincerely,</p>
        <p className="pack-p" style={{ color: '#0f766e', fontWeight: 600, marginBottom: 0 }}>Swathish G</p>
        <p className="pack-note">Co-Founder &amp; Authorised Signatory · The Halo Effect Consulting LLP</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION B" title="Appointment & Employment Agreement" kicker="Employment Pack · The Halo Effect Consulting LLP" />
        <p className="pack-p">
          This Employment Agreement is entered into as of <Fill>{ctx.joining}</Fill> between The Halo Effect Consulting LLP, 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050 (“Company”) AND <Fill>{ctx.name}</Fill> (“Employee”).
        </p>
        <h4 className="pack-sub">1. Position and duties</h4>
        <p className="pack-p">The Employee is appointed as <Fill>{ctx.designation}</Fill> in the <Fill>{ctx.department}</Fill> department, reporting to <Fill>{ctx.manager}</Fill>. Duties include all responsibilities in the Job Description (Section C) and such other duties as may be assigned.</p>
        <h4 className="pack-sub">2. Commencement, probation &amp; confirmation</h4>
        <p className="pack-p">2.1 Employment commences on <Fill>{ctx.joining}</Fill>. 2.2 Probation period: <Fill>{ctx.probation}</Fill>. Either party may terminate during probation with 30 days’ written notice. 2.3 Confirmation is at the Company’s sole discretion and is communicated via a formal Confirmation Letter.</p>
        <h4 className="pack-sub">3. Compensation</h4>
        <p className="pack-p">3.1 Monthly Gross CTC: ₹ <Fill>{ctx.ctc}</Fill>. 3.2 Statutory deductions (TDS, Professional Tax, and future PF/ESI as applicable) will be made. 3.3 Salary credited by the last working day of each month.</p>
        <h4 className="pack-sub">4. Working hours &amp; portal obligations</h4>
        <p className="pack-p">4.1 Monday to Saturday, 9:30 AM – 6:30 PM. Work Mode: <Fill>{ctx.mode}</Fill>. 4.2 The Employee must log attendance, submit daily scrum updates, and file EOD reports on the THEC Employee Portal every working day — this is a mandatory employment obligation.</p>
        <h4 className="pack-sub">5. Notice period &amp; termination</h4>
        <p className="pack-p">5.1 Post-confirmation: 60 days’ written notice by either party. 5.2 Company may pay in lieu of notice. 5.3 Gross misconduct: immediate termination without notice.</p>
        <h4 className="pack-sub">6. Non-solicitation</h4>
        <p className="pack-p">6.1 For 18 months post-employment the Employee shall not solicit, approach, or do business with any client or prospect of the Company with whom they had contact during employment. 6.2 For 12 months post-employment the Employee shall not recruit or encourage any Company employee to leave. 6.3 These clauses are enforceable under Indian law and do not restrict general industry participation.</p>
        <h4 className="pack-sub">7. Conflict of interest</h4>
        <p className="pack-p">7.1 The Employee must disclose in writing — at joining and whenever circumstances change — if any family member, relative, close friend, or associate is engaged in any business, freelance, or consultancy related to the Company’s services, clients, or industry. 7.2 Prospect pricing, client commercial terms, pipeline data, and all commercially sensitive information must not be shared with any person including family members. Breach = immediate termination and legal action.</p>
        <h4 className="pack-sub">8. Governing law</h4>
        <p className="pack-p">Governed by the laws of India. Exclusive jurisdiction of courts in Chennai, Tamil Nadu.</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTIONS C & D" title="Job Description & Probation Terms" kicker="Employment Pack · The Halo Effect Consulting LLP" />
        <Rows items={[
          ['Employee', ctx.name],
          ['Designation', ctx.designation],
          ['Department', ctx.department],
          ['Reporting To', ctx.manager],
          ['Work Mode', ctx.mode],
        ]} />
        <h4 className="pack-sub">Role overview</h4>
        <div className="pack-band">
          <Fill>{ctx.designation ? `${ctx.designation} in the ${ctx.department} department, reporting to ${ctx.manager}.` : ''}</Fill>
        </div>
        <h4 className="pack-sub">Key responsibilities</h4>
        {duties.length === 0 ? (
          <p className="pack-p">Responsibilities will be assigned by the reporting manager.</p>
        ) : duties.map((kra, index) => (
          <div key={kra.keyResultArea || index} className="pack-band">
            {index + 1}. <Fill>{kra.keyResultArea}{kra.kpi ? ` — ${kra.kpi}` : ''}</Fill>
          </div>
        ))}
        <h4 className="pack-sub">Skills required</h4>
        <div className="pack-band">
          <Fill>{duties.map((kra) => kra.kpi).filter(Boolean).join('; ') || ctx.designation}</Fill>
        </div>
        <div className="pack-callout">This job description is not exhaustive. The Company may assign additional duties consistent with the scope of the role.</div>
        <h4 className="pack-sub">Probation &amp; confirmation terms</h4>
        <ol className="pack-list">
          <li>Probation: <Fill>{ctx.probation}</Fill> from <Fill>{ctx.joining}</Fill>.</li>
          <li>Formal reviews at 30, 60, and 90 days and at the end of probation (see Document 3 for the schedule).</li>
          <li>The Company may extend probation by up to 3 months. Extension does not constitute confirmation.</li>
          <li>Confirmation is at the Company’s sole discretion. A written Confirmation Letter will be issued only upon satisfactory performance.</li>
          <li>Either party may terminate during probation with 30 days’ written notice.</li>
          <li>Leave accrues from the sixth month of employment, not from the date of joining.</li>
          <li>Upon confirmation, the notice period becomes 60 days.</li>
          <li>Mandatory during probation: 90% attendance, daily THEC Portal updates, all onboarding review milestones.</li>
        </ol>
        <div className="pack-ack">
          By signing below, I, <Fill>{ctx.name}</Fill>, confirm I have read, understood, and agree to be bound by all sections of this Employment Agreement Pack — Sections A, B, C, and D — as if signed individually.
        </div>
        <SignOff ctx={ctx} />
      </Page>
    </>
  )
}

function LegalBody({ ctx, logo, tab }) {
  const conflict = ctx.answers.employment?.conflictOfInterest || 'No'
  const docs = ctx.kyc.documents || []
  const assets = ctx.assetItems.length ? ctx.assetItems : (ctx.hasAssets ? [ctx.assets] : [])
  const contents = [
    { letter: '1–2', label: 'NDA & Comprehensive Confidentiality Agreement' },
    { letter: '3–4', label: 'Data Protection Agreement & IP Assignment' },
    { letter: '5–8', label: 'Client Undertaking · Portfolio Restriction · Commercial Confidentiality · Conflict of Interest' },
    { letter: '9–11', label: 'Employee Information · KYC Declaration · Education & Experience' },
    { letter: '12–14', label: 'Bank & Payroll · Statutory Declarations · Emergency Contact' },
    ...(ctx.hasAssets ? [{ letter: '15–17', label: 'Asset Handover · IT Equipment Agreement · Asset Return Form' }] : []),
  ]
  return (
    <>
      <Page logo={logo}>
        <Cover logo={logo} tab={tab} />
        <Identity ctx={ctx} />
        <Contents items={contents} note="One master signature at the end of this pack covers all sections." />
        <p className="pack-conf">PRIVATE &amp; CONFIDENTIAL · FOR EMPLOYEE USE ONLY · THE HALO EFFECT CONSULTING LLP</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="PART I · 1 & 2" title="Non-Disclosure Agreement & Confidentiality Agreement" kicker="Legal Agreements Pack · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">1. Non-disclosure agreement (NDA)</h4>
        <p className="pack-p">This NDA is entered into between The Halo Effect Consulting LLP (“Disclosing Party”) and <Fill>{ctx.name}</Fill> (“Receiving Party”), effective <Fill>{ctx.joining}</Fill>.</p>
        <p className="pack-p"><strong>1.1 Definition.</strong> “Confidential Information” means all non-public information disclosed in connection with employment: client identities, briefs, campaign data, strategies, pricing, financials, product plans, tools, processes, methodologies, vendor relationships, employee data, prospect pipeline, and any information designated confidential.</p>
        <p className="pack-p"><strong>1.2 Obligations.</strong> The Employee shall: (a) keep all Confidential Information strictly secret; (b) not disclose to any third party without prior written consent; (c) use solely to perform assigned duties; (d) immediately notify the Company of any actual or suspected unauthorised disclosure.</p>
        <p className="pack-p"><strong>1.3 Duration.</strong> These obligations are <strong>indefinite and perpetual</strong> <Forever />. They survive the termination of employment with no time limit whatsoever.</p>
        <p className="pack-p"><strong>1.4 Remedies.</strong> Breach causes irreparable harm for which monetary damages may be inadequate. The Company is entitled to injunctive relief in addition to all other remedies under law.</p>
        <h4 className="pack-sub">2. Confidentiality agreement — client work &amp; internal information</h4>
        <p className="pack-p"><strong>2.1 Client Work.</strong> All work produced for clients — creatives, strategies, reports, ads, websites, content, analytics — belongs to the client or the Company. The Employee:</p>
        <ul className="pack-list">
          <li>May <strong>NOT</strong> display or reference client work in any personal portfolio (website, Behance, Dribbble, LinkedIn, Instagram, or any platform) without explicit written consent from both the Company and the client.</li>
          <li>May <strong>NOT</strong> mention client names, results, metrics, or strategies publicly, in interviews, or in job applications — ever, without exception.</li>
          <li>May state only: “I worked at The Halo Effect Consulting LLP as <Fill>{ctx.designation}</Fill> from <Fill>{ctx.joining}</Fill>.”</li>
        </ul>
        <p className="pack-p"><strong>2.2 Retained.</strong> General skills and knowledge acquired during employment; general industry knowledge not tied to specific clients.</p>
        <p className="pack-p"><strong>2.3 Internal Information.</strong> Salary structures, financials, processes, tooling costs, vendor terms, and operational playbooks are confidential — <strong>indefinitely</strong> <Forever />.</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="PART I · 3, 4 & 5" title="Data Protection · IP Assignment · Client Confidentiality Undertaking" kicker="Legal Agreements Pack · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">3. Data protection agreement (DPDPA 2023)</h4>
        <p className="pack-p">In compliance with the IT Act 2000 and Digital Personal Data Protection Act 2023:</p>
        <ol className="pack-list">
          <li>Handle personal data of clients, customers, and colleagues only as strictly necessary for the assigned role.</li>
          <li>Do not download, copy, or transfer any personal data to personal devices or personal cloud accounts.</li>
          <li>Report any actual or suspected data breach to management within <strong>2 hours</strong> of discovery.</li>
          <li>Do not use client or customer data for any purpose beyond the contracted service.</li>
          <li>Upon termination, immediately return or permanently delete all personal data in possession and confirm in writing within 24 hours of last working day.</li>
          <li>Violation may constitute a criminal offence under the IT Act 2000 and DPDPA 2023 carrying civil and criminal liability.</li>
        </ol>
        <h4 className="pack-sub">4. IP &amp; work product assignment</h4>
        <p className="pack-p"><strong>4.1 Full Assignment.</strong> All work product, inventions, creative works, code, designs, strategies, tools, templates, and deliverables created by the Employee during employment — whether during or outside working hours, using Company or personal resources, if related to the Company’s business or clients — are the sole and exclusive property of <strong>The Halo Effect Consulting LLP</strong> or its clients. No separate compensation is payable.</p>
        <p className="pack-p"><strong>4.2 Moral Rights.</strong> To the maximum extent permitted by Indian law, the Employee irrevocably waives all moral rights in work product created in connection with the Company or its clients.</p>
        <p className="pack-p"><strong>4.3 Pre-Existing IP.</strong> Any pre-existing IP must be declared in writing at joining. Undisclosed pre-existing IP incorporated into Company work is deemed assigned to the Company.</p>
        <p className="pack-p"><strong>Pre-Existing IP Declaration (write NIL if none)</strong> &nbsp; <Fill>NIL</Fill></p>
        <p className="pack-p"><strong>4.4 Cooperation.</strong> The Employee shall execute all additional documents to perfect the Company’s or client’s title, including after employment ends.</p>
        <h4 className="pack-sub">5. Client confidentiality &amp; non-solicitation undertaking</h4>
        <p className="pack-p">I, <Fill>{ctx.name}</Fill>, undertake: (a) I will not contact any client of the Company for personal or freelance business during employment or for <strong>18 months</strong> thereafter; (b) I will not disclose client identities, work nature, or results to any third party; (c) I will not use knowledge of a client’s strategy or pricing to benefit any competitor; (d) if a client approaches me directly for independent work, I will immediately inform my manager and not engage independently.</p>
        <div className="pack-callout"><strong>Note:</strong> Any work created using Company time, tools, or related to Company clients — even outside office hours — belongs to the Company or its clients. This includes all creatives, code, copy, strategies, and all deliverables.</div>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="PART I · 6, 7 & 8" title="Portfolio Restriction · Commercial Confidentiality · Conflict of Interest" kicker="Legal Agreements Pack · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">6. Portfolio &amp; public disclosure agreement</h4>
        <p className="pack-p"><strong>Permitted:</strong> “I worked at The Halo Effect Consulting LLP as <Fill>{ctx.designation}</Fill> from <Fill>{ctx.joining}</Fill>” and general skill descriptions that do not identify any client.</p>
        <p className="pack-p"><strong>Prohibited — Permanently</strong> <Forever /> Displaying client logos, campaign screenshots, analytics, or results in any portfolio. Writing case studies about client work. Mentioning client names in any public medium. Posting Company-branded content as personal work. This restriction is permanent because the work product and its confidentiality belong to the client without any time limit.</p>
        <h4 className="pack-sub">7. Commercial confidentiality agreement</h4>
        <p className="pack-p">The following are commercially sensitive and strictly confidential — <strong>indefinitely</strong> <Forever /></p>
        <ul className="pack-list">
          <li>Pricing structures, quotation methods, and margin information</li>
          <li>Vendor costs and tool subscription rates</li>
          <li>Company revenue, profitability, and financial position</li>
          <li>Business plans and upcoming service launches</li>
          <li>Prospect pipeline and CRM data</li>
          <li>Internal processes, templates, and proprietary playbooks</li>
          <li>Partner and vendor commercial terms</li>
        </ul>
        <p className="pack-p">The Employee will not disclose any of the above to any person — including family, friends, or future employers.</p>
        <h4 className="pack-sub">8. Conflict of interest declaration</h4>
        <p className="pack-p"><strong>8.1</strong> The Employee must not engage in any activity, business, or employment during this engagement that conflicts with the Company’s interests.</p>
        <p className="pack-p"><strong>8.2 Mandatory Family Disclosure.</strong> The Employee must disclose in writing — at joining and whenever circumstances change — if any <strong>family member, relative, close friend, or personal associate</strong> is engaged in any business, freelance, consultancy, or employment directly or indirectly related to the Company’s services, clients, industry, or prospects — including digital marketing, web development, SEO, performance marketing, branding, sales, or any adjacent field.</p>
        <p className="pack-p"><strong>8.3 Pricing &amp; Pipeline Protection.</strong> Prospect pricing, client commercial terms, pipeline data, budgets, and all sales-related internal information must <strong>not be shared with any person under any circumstances</strong>, including family members and close friends, regardless of the nature of the relationship.</p>
        <p className="pack-p"><strong>8.4 Consequences.</strong> Failure to disclose a conflict, or sharing of commercial information with a conflicted party, constitutes gross misconduct — immediate termination and potential legal action for damages.</p>
        <p className="pack-p"><strong>Family/associate disclosure:</strong> <Fill>{conflict === 'Yes' ? 'Yes — update in writing whenever circumstances change' : 'NIL at joining. Update in writing whenever circumstances change'}</Fill></p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="PART II · HR RECORDS 9–11" title="Employee Information · KYC Declaration · Education & Experience" kicker="Legal Agreements Pack · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">9. Employee information form</h4>
        <Rows items={[
          ['Full Name (as on Aadhaar)', ctx.personal.fullName],
          ['Date of Birth', formatPackDate(ctx.personal.dateOfBirth)],
          ['Gender', ctx.personal.gender],
          ['Aadhaar Number', ctx.personal.aadhaar],
          ['PAN Number', ctx.personal.pan],
          ['Mobile Number', ctx.personal.mobile],
          ['Personal Email', ctx.personal.email],
          ['Permanent Address', ctx.personal.permanentAddress],
          ['Current Address (if different)', ctx.personal.currentAddress],
          ["Father's Name", ctx.personal.fatherName],
          ["Mother's Name", ctx.personal.motherName],
          ['Marital Status', ctx.personal.maritalStatus],
          ['Blood Group', ctx.personal.bloodGroup],
        ]} />
        <h4 className="pack-sub">10. KYC declaration</h4>
        <p className="pack-p">I confirm I have submitted the following originals for verification. All copies on record are true copies:</p>
        <Checks items={[
          { label: 'Aadhaar Card', checked: kycChecked(docs, ['aadhaar']) },
          { label: 'PAN Card', checked: kycChecked(docs, ['pan']) },
          { label: 'Passport (if available)', checked: kycChecked(docs, ['passport'], ['photograph']) },
          { label: 'Voter ID / Driving Licence', checked: kycChecked(docs, ['voter', 'driving']) },
          { label: 'Educational Certificates', checked: kycChecked(docs, ['educational']) },
          { label: 'Experience / Relieving Letters', checked: kycChecked(docs, ['experience', 'relieving']) },
          { label: "Last 3 months' salary slips", checked: kycChecked(docs, ['salary']) },
          { label: 'Cancelled cheque / Passbook', checked: kycChecked(docs, ['cheque', 'passbook']) },
          { label: '2 passport photographs', checked: kycChecked(docs, ['photograph']) },
        ]} />
        <p className="pack-p">I confirm no pending legal proceedings affecting employment and authorise the Company to conduct background verification.</p>
        <h4 className="pack-sub">11. Education &amp; experience declaration</h4>
        <p className="pack-p">I solemnly declare that all educational qualifications and work experience stated are genuine and verifiable; I have not been terminated from any previous employer for misconduct without disclosing it; I am not subject to any conflicting obligations from a former employer, except as declared below.</p>
        <Rows items={[
          ['Last Employer', ctx.kyc.lastEmployer],
          ['Last Designation & Period', ctx.kyc.lastDesignation],
          ['Highest Qualification & Year', [ctx.kyc.qualification, ctx.kyc.institutionYear].filter(Boolean).join(', ')],
          ['Any conflicting obligations (NIL if none)', ctx.kyc.obligations || 'NIL'],
        ]} />
        <p className="pack-note">Misrepresentation is grounds for immediate termination without notice or settlement.</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle
          badge={ctx.hasAssets ? 'PART II & III · HR RECORDS 12–17' : 'PART II · HR RECORDS 12–14'}
          title={ctx.hasAssets ? 'Bank & Payroll · Statutory · Emergency Contact · Company Property' : 'Bank & Payroll · Statutory · Emergency Contact'}
          kicker="Legal Agreements Pack · The Halo Effect Consulting LLP"
        />
        <h4 className="pack-sub">12. Bank &amp; payroll details</h4>
        <Rows items={[
          ['Bank Name', ctx.bank.bankName],
          ['Account Holder Name', ctx.bank.accountHolder],
          ['Account Number', ctx.bank.accountNumber],
          ['IFSC Code', ctx.bank.ifsc],
          ['Branch & City', ctx.bank.branchCity],
        ]} />
        <p className="pack-p">
          <strong>Account Type</strong>
          &nbsp;&nbsp;
          <Checks items={[
            { label: 'Savings', checked: String(ctx.bank.accountType || '').toLowerCase().includes('saving') },
            { label: 'Current', checked: String(ctx.bank.accountType || '').toLowerCase().includes('current') },
          ]} />
        </p>
        <h4 className="pack-sub">13. Statutory declarations</h4>
        <p className="pack-p">I, <Fill>{ctx.name}</Fill>, declare: (a) not convicted of any criminal offence involving moral turpitude; (b) not an undischarged insolvent; (c) I authorise statutory deductions (Professional Tax, TDS, PF/ESI as applicable); (d) I will notify HR within 7 days of any change in statutory status; (e) I acknowledge employment under the Tamil Nadu Shops &amp; Establishments Act 1947 and authorise registration with the Department of Labour.</p>
        <Checks items={[
          { label: 'Professional Tax enrollment', checked: false },
          { label: `PF enrollment (UAN: ${ctx.bank.uan || '________'})`, checked: Boolean(ctx.bank.uan) },
          { label: 'ESI enrollment — if applicable', checked: false },
        ]} />
        <h4 className="pack-sub">14. Emergency contact</h4>
        <Rows items={[
          ['Primary Contact Name & Relationship', [ctx.emergency.primaryName, ctx.emergency.primaryRelationship].filter(Boolean).join(' · ')],
          ['Primary Mobile', ctx.emergency.primaryMobile],
          ['Secondary Contact Name & Relationship', [ctx.emergency.secondaryName, ctx.emergency.secondaryRelationship].filter(Boolean).join(' · ')],
          ['Secondary Mobile', ctx.emergency.secondaryMobile],
          ['Blood Group & Known Conditions', [ctx.personal.bloodGroup, ctx.emergency.allergies].filter(Boolean).join(' · ')],
        ]} />
        {!ctx.hasAssets && (
          <>
            <div className="pack-ack">
              By signing below, I, <Fill>{ctx.name}</Fill>, confirm I have read, understood, and agree to be bound by all sections of this Legal Agreements &amp; HR Records Pack as if signed individually. I specifically acknowledge that confidentiality, portfolio, and commercial secrecy obligations are <strong>perpetual and indefinite with no expiry</strong>.
            </div>
            <SignOff ctx={ctx} />
          </>
        )}
      </Page>

      {ctx.hasAssets && (
        <Page logo={logo} branded>
          <SectionTitle badge="PART III · COMPANY PROPERTY 15–17" title="Asset Handover Form · IT Equipment Agreement · Asset Return Form" kicker="Legal Agreements Pack · The Halo Effect Consulting LLP" />
          <h4 className="pack-sub">15. Asset handover form</h4>
          <p className="pack-p">Assets issued to <Fill>{ctx.name}</Fill> on <Fill>{ctx.joining}</Fill>:</p>
          <AssetTable items={assets} mode="handover" />
          <p className="pack-p">I acknowledge receipt of the above assets in the stated condition and agree to: (a) use them solely for Company work; (b) not damage, modify, or part with them without written authorisation; (c) return all assets on my last working day in the same or better condition; (d) authorise the Company to recover the full replacement cost from my Full &amp; Final Settlement for any loss or damage caused by negligence.</p>
          <p className="pack-p"><strong>ISSUING OFFICER</strong> &nbsp;&nbsp;&nbsp; <strong>DATE OF ISSUE</strong> <Fill>{ctx.joining}</Fill></p>
          <h4 className="pack-sub">16. IT equipment usage agreement</h4>
          <ol className="pack-list">
            <li>Company-issued devices are strictly for work purposes only. Installation of any software requires prior management approval.</li>
            <li>The Company reserves the right to remotely access, monitor, and wipe Company devices at any time without prior notice.</li>
            <li>Personal data stored on Company devices is the Employee’s own responsibility — the Company is not liable for its loss.</li>
            <li>All devices must be kept physically secure, clean, and updated within 48 hours of any system update prompt.</li>
            <li>Repair or servicing of Company devices must go through the Company only — unauthorised third-party repair shops are strictly prohibited.</li>
            <li>All Company devices must be returned on the last working day. Failure to return any device will be treated as theft and reported accordingly.</li>
          </ol>
          <h4 className="pack-sub">17. Asset return form</h4>
          <p className="pack-note">Template — to be completed on last working day, not at joining.</p>
          <AssetTable items={assets} mode="return" />
          <Checks items={[
            { label: 'Company email deactivated', checked: false },
            { label: 'THEC Portal access revoked', checked: false },
            { label: 'Client tool access revoked', checked: false },
            { label: 'Social media accounts access revoked', checked: false },
            { label: 'Company data deleted from personal devices (confirmed in writing)', checked: false },
          ]} />
          <div className="pack-officers">
            <div>Receiving officer<span>Signature &amp; Date</span></div>
            <div>IT clearance<span>Signature &amp; Date</span></div>
            <div>Finance clearance<span>Signature &amp; Date</span></div>
          </div>
          <div className="pack-ack">
            By signing below, I, <Fill>{ctx.name}</Fill>, confirm I have read, understood, and agree to be bound by all sections of this Legal Agreements &amp; HR Records Pack as if signed individually. I specifically acknowledge that confidentiality, portfolio, and commercial secrecy obligations are <strong>perpetual and indefinite with no expiry</strong>.
          </div>
          <SignOff ctx={ctx} />
        </Page>
      )}
    </>
  )
}

function HandbookBody({ ctx, logo, tab }) {
  const customKras = ctx.kras.slice(0, 4)
  while (customKras.length < 4) customKras.push({ keyResultArea: '', kpi: '', weight: '' })
  const kraTable = [
    ...customKras.map((kra) => [kra.keyResultArea || '—', kra.kpi || '—', kra.weight ? `${kra.weight}%` : '—']),
    ...ctx.fixed.map((kra) => [kra.keyResultArea, kra.kpi, `${kra.weight}%`]),
  ]
  return (
    <>
      <Page logo={logo}>
        <Cover logo={logo} tab={tab} />
        <Identity ctx={ctx} />
        <Contents
          items={[
            { letter: 'I', label: 'HR Policies — Leave, Attendance, LOP, WFH, Working Hours, Code of Conduct, Probation' },
            { letter: 'II', label: 'Compensation & Growth — Hike, Promotion, Incentive, Exit Policy' },
            { letter: 'III', label: 'Compliance — POSH, Anti-Bribery, Anti-Discrimination, Workplace Safety, Shops Act' },
            { letter: 'IV', label: 'Technology & Security — IT, Cybersecurity, Passwords, Email, BYOD, Social Media, AI' },
            { letter: 'V', label: 'Performance & Development — KRA/KPI, 30/60/90 Plan, Review Schedule, PIP' },
            { letter: 'VI', label: 'Grievance & Disciplinary — Process, Escalation, Gross Misconduct Definitions' },
          ]}
          note="One master signature at the end of this pack covers all sections."
        />
        <p className="pack-conf">PRIVATE &amp; CONFIDENTIAL · FOR EMPLOYEE USE ONLY · THE HALO EFFECT CONSULTING LLP</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION I — HR POLICIES" title="Leave, Attendance, WFH & Working Hours Policies" kicker="Employee Handbook · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">Leave policy</h4>
        <DataTable
          headers={['Leave Type', 'Entitlement', 'Carry Forward', 'Encashment', 'Notes']}
          rows={[
            ['Casual Leave (CL)', '1/month (12/yr)', 'Yes — converts to EL', 'No', 'Max 3 consecutive days'],
            ['Sick Leave (SL)', '1/month (12/yr)', 'No', 'No', 'Certificate required beyond 2 days'],
            ['WFH', '1/month', 'No — cannot carry forward', 'No', 'Approved via THEC Portal, 3 days prior'],
            ['Earned Leave (EL) (Statutory)', 'Via CL carry-forward', '6-month validity', 'No', 'Cannot be taken in bulk'],
            ['Maternity Leave (Statutory)', '26 weeks', 'N/A', 'No', 'Maternity Benefit Act 1961'],
            ['Paternity Leave', '2 weeks', 'No', 'No', '1 month prior intimation mandatory'],
          ]}
        />
        <p className="pack-p">EL is granted per Tamil Nadu Shops &amp; Establishments Act via CL carry-forward. Unused CL at year-end automatically converts to EL with 6-month validity. EL cannot be taken all at once. No encashment for EL. Bereavement absence may be compensated with CL or EL at management discretion. <strong>Leave accrues from the sixth month of employment.</strong></p>
        <h4 className="pack-sub">WFH policy</h4>
        <p className="pack-p">Employees are entitled to <strong>1 WFH day per calendar month</strong>. Cannot be carried forward. Requests must be submitted on the <strong>THEC Employee Portal at least 3 working days in advance</strong>, subject to approval by the COO. Approval is not automatic. During WFH: maintain availability on all channels, camera on during all meetings, maintain same output standards as in office. Non-response within 30 minutes during working hours without prior notice = marked absent. WFH may be revoked if standards fall.</p>
        <h4 className="pack-sub">Attendance policy</h4>
        <ul className="pack-list">
          <li><strong>Monday to Saturday</strong> are working days. Saturday is a full working day unless officially communicated otherwise by management.</li>
          <li>Working hours: 9:30 AM – 6:30 PM. Lunch: 1:00 PM – 1:45 PM.</li>
          <li>Grace period: 15 minutes. Beyond that, half-day CL deducted. More than 3 late arrivals in a month = half-day LOP.</li>
          <li>Attendance must be marked on the <strong>THEC Employee Portal</strong> daily. Daily scrum and EOD reports are mandatory.</li>
          <li>Minimum 90% monthly attendance required for increment eligibility.</li>
          <li>Unauthorised absence for 2+ consecutive working days without communication may be treated as abandonment.</li>
        </ul>
        <h4 className="pack-sub">LOP policy</h4>
        <p className="pack-p">LOP applies when leave is exhausted or taken without approval. <strong>LOP deduction = (Monthly CTC ÷ 26) × LOP days.</strong> For this hire, monthly CTC is ₹ <Fill>{ctx.ctc}</Fill>. More than 3 LOP days in a month triggers disciplinary review. Habitual LOP (3+ months in a year) may result in withholding of increment.</p>
        <h4 className="pack-sub">THEC portal obligations</h4>
        <p className="pack-p">The following are <strong>non-negotiable mandatory requirements</strong> for all employees: (a) log daily attendance; (b) submit morning scrum update by 10:00 AM; (c) submit EOD report by 6:30 PM covering tasks completed, blockers, and next-day plan; (d) log all learning and upskilling activities daily. Non-compliance is a disciplinary matter.</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTIONS I, II & III" title="Code of Conduct · Compensation · Compliance Policies" kicker="Employee Handbook · The Halo Effect Consulting LLP" />
        <div className="pack-split">
          <div>
            <h4 className="pack-sub" style={{ marginTop: 0 }}>Code of conduct</h4>
            <p className="pack-p"><strong>Professional Standards:</strong> Maintain highest standards of integrity. Respect all colleagues, clients, and vendors. Represent the Company positively at all times.</p>
            <p className="pack-p"><strong>Work Ethics:</strong> Punctual, meet deadlines, communicate proactively. No personal business during working hours. No gifts or kickbacks.</p>
            <p className="pack-p"><strong>Communication:</strong> Professional language on all channels. No harassment, bullying, or defamatory statements about the Company or clients.</p>
            <p className="pack-p"><strong>Consequences:</strong> Verbal warning → Written warning → Final written warning → Termination. Gross misconduct = immediate termination.</p>
            <h4 className="pack-sub">Probation policy</h4>
            <p className="pack-p">Probation: <Fill>{ctx.probation}</Fill>. Reviews at 30, 60, 90 days and end of probation. Extension up to 3 months possible. Notice during probation: 30 days. Leave from sixth month only. Confirmation = Company’s sole discretion.</p>
            <h4 className="pack-sub">Hike &amp; increment policy</h4>
            <p className="pack-p">Salary increments are conducted annually and are based entirely on individual performance and Company assessment. The Company does not disclose increment criteria, bands, or percentages in advance. Increments are at the Company’s sole and absolute discretion and are not a contractual entitlement. Eligibility: minimum 6 months’ confirmed employment, satisfactory attendance, no active disciplinary action.</p>
            <h4 className="pack-sub">Promotion &amp; incentive</h4>
            <p className="pack-p">Promotions are merit-based, subject to business need and budget, communicated via formal Appointment Addendum. Variable pay (where applicable) is outlined in the Offer Letter. Not payable to employees who have resigned or been terminated at payout time.</p>
          </div>
          <div>
            <h4 className="pack-sub" style={{ marginTop: 0 }}>POSH policy (SHWW Act, 2013)</h4>
            <p className="pack-p">Zero tolerance for sexual harassment. Applies to all employees at all locations including remote. ICC constituted per law. Complaints within 3 months; inquiry within 60 days. Proven harassment = termination + possible law enforcement referral. False complaints = misconduct. All proceedings confidential.</p>
            <h4 className="pack-sub">Anti-bribery policy</h4>
            <p className="pack-p">Zero tolerance. No bribe, kickback, or improper payment. Gifts above ₹500 from clients or vendors must be disclosed. Violations reported under the Prevention of Corruption Act 1988.</p>
            <h4 className="pack-sub">Anti-discrimination policy</h4>
            <p className="pack-p">Discrimination based on caste, religion, gender, sexual orientation, age, disability, language, or national origin is prohibited in all employment decisions.</p>
            <h4 className="pack-sub">Workplace safety</h4>
            <p className="pack-p">Maintain a clean workspace. Report accidents immediately. No alcohol or controlled substances on premises. Remote employees responsible for their own workspace safety.</p>
            <h4 className="pack-sub">Exit policy (60-day notice)</h4>
            <p className="pack-p">Written resignation to Reporting Manager and HR. Notice: 60 days post-confirmation; 30 days during probation. During notice: complete knowledge transfer, hand over all accounts and assets, obtain IT and Finance clearance. F&amp;F within 30 days of last working day. All confidentiality and portfolio restrictions remain permanently in force after exit.</p>
          </div>
        </div>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION III — COMPLIANCE" title="POSH Policy — Standalone Acknowledgement" kicker="Employee Handbook · The Halo Effect Consulting LLP · Sexual Harassment of Women at Workplace (Prevention, Prohibition & Redressal) Act, 2013" />
        <p className="pack-p">I, <Fill>{ctx.name}</Fill> (Employee ID: <Fill>{ctx.id}</Fill>), employed as <Fill>{ctx.designation}</Fill> at The Halo Effect Consulting LLP, hereby confirm and acknowledge the following:</p>
        <h4 className="pack-sub">1. Receipt &amp; understanding</h4>
        <ol className="pack-list">
          <li>I have received a copy of The Halo Effect Consulting LLP’s Prevention of Sexual Harassment (POSH) Policy and have read and understood its contents in full.</li>
          <li>I understand what constitutes sexual harassment under Section 2(n) of the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, including unwelcome physical, verbal, or non-verbal conduct of a sexual nature.</li>
          <li>I am aware that this policy applies to all employees — permanent, contractual, interns, and remote — across all workplaces including office premises, client sites, off-site events, and digital communication channels.</li>
        </ol>
        <h4 className="pack-sub">2. My commitments</h4>
        <ol className="pack-list">
          <li>I commit to maintaining a workplace that is safe, respectful, and free from sexual harassment at all times.</li>
          <li>I will not engage in any conduct that could reasonably be interpreted as sexual harassment, whether in person, digitally, or at any work-related event.</li>
          <li>I will report any incident of sexual harassment that I witness or personally experience to the Internal Complaints Committee (ICC) without fear of retaliation.</li>
          <li>I understand that filing a knowingly false complaint is also treated as misconduct under this policy.</li>
        </ol>
        <h4 className="pack-sub">3. ICC awareness</h4>
        <p className="pack-p">I am aware that the Company has constituted an Internal Complaints Committee (ICC) as required by law. I understand that:</p>
        <ol className="pack-list">
          <li>Complaints must be submitted in writing to the ICC within <strong>3 months</strong> of the incident.</li>
          <li>The ICC will complete its inquiry within <strong>60 days</strong> of receiving the complaint.</li>
          <li>All proceedings of the ICC are strictly confidential.</li>
          <li>Retaliation against any person who files a complaint or participates in an inquiry is prohibited and is treated as a separate act of misconduct.</li>
          <li>Proven sexual harassment may result in disciplinary action up to and including termination, and may be reported to law enforcement authorities.</li>
        </ol>
        <h4 className="pack-sub">4. Acknowledgement of zero-tolerance policy</h4>
        <p className="pack-p">I understand that The Halo Effect Consulting LLP maintains a <strong>zero-tolerance policy</strong> toward sexual harassment. I acknowledge that this policy applies regardless of the gender, designation, or seniority of the persons involved.</p>
        <div className="pack-callout"><strong>Important:</strong> This standalone acknowledgement is maintained separately by the ICC as required under the POSH Act 2013. It forms part of the Company’s mandatory compliance records and must be signed on or before the date of joining.</div>
        <SignOff ctx={ctx} />
        <div className="pack-icc">
          <div>
            <strong>For ICC records only</strong>
            Date of receipt: ______________
            <br />
            ICC File Reference No.: ______________
          </div>
          <div>
            <strong>Copy distribution</strong>
            <Checks items={[
              { label: 'Original retained by ICC', checked: false },
              { label: 'Copy issued to Employee', checked: false },
              { label: 'Copy filed in Employee HR folder', checked: false },
            ]} />
          </div>
        </div>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION IV — TECHNOLOGY & SECURITY" title="IT, Cybersecurity, Email, BYOD, Social Media & AI Usage Policies" kicker="Employee Handbook · The Halo Effect Consulting LLP" />
        <div className="pack-split">
          <Col
            title="IT acceptable use"
            items={[
              'Company devices and systems for work only.',
              'No unauthorised software, games, or apps.',
              'No adult content, gambling, or illegal content.',
              'No personal business on Company accounts.',
              'Never share login credentials with anyone.',
              'No cryptocurrency mining or non-work processes.',
            ]}
          />
          <Col
            title="BYOD (personal device)"
            items={[
              'Screen lock and password protection mandatory.',
              '2FA required for all work accounts on personal devices.',
              'Company data must not be mixed with personal data.',
              'Company may require remote wipe of Company data at separation.',
              'Do not access sensitive client data on personal devices where a Company device is available.',
            ]}
          />
          <Col
            title="Cybersecurity"
            items={[
              'Strong unique passwords: min 12 chars, upper + lower + number + special character.',
              'Enable 2FA on all Company accounts — no exceptions.',
              'Report phishing immediately — never click suspicious links.',
              'Client data must not be stored on personal devices or personal cloud.',
              'Keep all software updated within 48 hours.',
              'Lost or stolen Company device: report within 1 hour.',
            ]}
          />
          <Col
            title="Social media policy"
            items={[
              'Do not post about clients, campaigns, or Company matters without written approval.',
              'Never share client results, screenshots, or creative work as personal portfolio.',
              'Do not impersonate the Company or speak on its behalf without authorisation.',
              'Only authorised employees post on Company accounts; all posts follow the content workflow.',
              'Violations = breach of confidentiality = disciplinary matter.',
            ]}
          />
          <Col
            title="Email & communication"
            items={[
              'Use Company email for all professional communication.',
              'Personal email must not be used for client or Company business.',
              'Respond within 4 hours (internal) and 24 hours (client).',
              'Do not forward client emails to personal accounts.',
            ]}
          />
          <Col
            title="AI usage policy"
            items={[
              'Permitted: Using AI tools (Claude, ChatGPT, Gemini) for research, drafting, ideation.',
              'Prohibited: Inputting client names, data, or identifying information into any public AI tool.',
              'AI is a productivity tool — not a substitute for developing genuine expertise.',
              'Significant AI use in client deliverables must be disclosed to the supervisor.',
            ]}
          />
          <Col
            title="Remote access"
            items={[
              'Use VPN where provided. No public computers.',
              'Log out of all remote sessions at end of each day.',
              'Remote access revoked immediately on separation.',
            ]}
          />
        </div>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION V — PERFORMANCE & DEVELOPMENT" title="KRA / KPI Sheet · 30/60/90-Day Learning Plan · Review Schedule" kicker={`Employee Handbook · The Halo Effect Consulting LLP · ${ctx.designation || ''}`} />
        <h4 className="pack-sub">KRA / KPI sheet</h4>
        <DataTable
          headers={['Key Result Area', 'KPI / Metric', 'Weight']}
          rows={kraTable}
          fillUntil={ctx.kras.slice(0, 4).length}
        />
        <p className="pack-note">KRAs mutually agreed and signed within 2 weeks of joining. Targets set by the Reporting Manager in the first review.</p>
        <h4 className="pack-sub">30/60/90-day learning plan</h4>
        <p className="pack-p"><span className="pack-pill">Day 1–30</span> <strong>Understand &amp; Absorb</strong></p>
        <p className="pack-p">Complete onboarding pack review. Log all daily scrum and EOD reports on THEC Portal from Day 1.</p>
        <p className="pack-p"><span className="pack-pill">Day 31–60</span> <strong>Apply &amp; Contribute</strong></p>
        <p className="pack-p">Deliver first independently-reviewed work output. Log all upskilling activities daily on THEC Portal.</p>
        <p className="pack-p"><span className="pack-pill">Day 61–90</span> <strong>Perform &amp; Improve</strong></p>
        <p className="pack-p">Propose one process improvement. Achieve all KPIs set in 30-day review.</p>
        <h4 className="pack-sub">Training &amp; upskilling commitment</h4>
        <p className="pack-p">Minimum <strong>2 hours of structured learning per week</strong>. All learning must be logged daily on the THEC Employee Portal — mandatory employment obligation. Company-sponsored certifications: 50% reimbursement if leaving within 12 months; 100% within 6 months of completion.</p>
        <h4 className="pack-sub">Review schedule</h4>
        <DataTable
          headers={['Review', 'Target Date', 'Reviewer', 'Focus']}
          rows={[
            ['30-Day Review', <Fill>{ctx.review30}</Fill>, <Fill>{ctx.manager}</Fill>, 'Culture fit, tool adoption, portal compliance, initial output'],
            ['60-Day Review', <Fill>{ctx.review60}</Fill>, <Fill>{ctx.manager}</Fill>, 'Skill application, KPI progress, client readiness'],
            ['90-Day Review', <Fill>{ctx.review90}</Fill>, 'Manager + Senior Mgmt', 'Overall performance, confirmation path decision'],
            ['End of Probation', <Fill>{ctx.probationEnd}</Fill>, 'Manager + Co-Founder', 'Formal confirmation decision'],
          ]}
        />
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION V — PERFORMANCE TEMPLATES" title="Performance Review Form · PIP Template · Confirmation Letter" kicker="Employee Handbook · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">Performance review form</h4>
        <p className="pack-note">Completed at each review milestone — not at joining.</p>
        <Rows items={[
          ['Employee Name', ctx.name],
          ['Designation', ctx.designation],
        ]} />
        <p className="pack-p">Review Type &nbsp; <Checks items={[
          { label: '30-Day', checked: false },
          { label: '60-Day', checked: false },
          { label: '90-Day', checked: false },
          { label: 'Mid-Year', checked: false },
          { label: 'Annual', checked: false },
        ]} /></p>
        <p className="pack-note">Review date, ratings, comments, and signatures are left blank for the review meeting.</p>
        <p className="pack-p">THEC Portal Compliance target: ≥ 95% daily submission.</p>
        <h4 className="pack-sub">Performance improvement plan (PIP)</h4>
        <p className="pack-note">Issued only when performance is consistently below expectations.</p>
        <Rows items={[['Employee Name', ctx.name]]} />
        <p className="pack-p">Weekly check-ins with manager are mandatory during the PIP period. Failure to meet PIP targets may result in termination of employment. All three parties must sign below.</p>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION V — CONFIRMATION" title="Confirmation Letter Template" kicker="Employee Handbook · The Halo Effect Consulting LLP · Issued at end of probation — not at joining" />
        <p className="pack-p">Date: ______________</p>
        <p className="pack-p">To,</p>
        <p className="pack-p"><Fill>{ctx.name}</Fill></p>
        <p className="pack-p"><Fill>{ctx.address}</Fill></p>
        <p className="pack-p"><strong>Subject: Confirmation of Employment</strong></p>
        <p className="pack-p">Dear <Fill>{ctx.first}</Fill>,</p>
        <p className="pack-p">We are pleased to confirm your employment with The Halo Effect Consulting LLP effective ______________ (Confirmation Date), following the successful completion of your probation period commencing <Fill>{ctx.joining}</Fill>.</p>
        <Rows items={[
          ['Designation', ctx.designation],
          ['Department', ctx.department],
          ['Reporting To', ctx.manager],
          ['Confirmed Monthly CTC (Gross)', '₹ ________'],
          ['Notice Period (effective immediately)', '60 days'],
          ['Annual Appraisal Cycle', 'April (next cycle: April 2027)'],
        ]} />
        <p className="pack-p">All other terms and conditions of your employment remain as set out in your original Appointment Agreement dated <Fill>{ctx.joining}</Fill>, including all confidentiality obligations, non-solicitation clauses, and company policies.</p>
        <p className="pack-p">We recognise the effort and commitment you have demonstrated during your probation period and look forward to your continued contribution to The Halo Effect Consulting LLP.</p>
        <p className="pack-p">Yours sincerely,</p>
        <div className="pack-split">
          <div>
            <p className="pack-p" style={{ color: '#0f6f63', fontWeight: 600, marginBottom: 0 }}>Swathish G</p>
            <p className="pack-note">Co-Founder &amp; Authorised Signatory<br />The Halo Effect Consulting LLP</p>
          </div>
          <div>
            <p className="pack-p"><strong>Employee Acknowledgement</strong></p>
            <p className="pack-p">I, <Fill>{ctx.name}</Fill>, acknowledge receipt of this Confirmation Letter and accept the terms stated herein.</p>
            <p className="pack-note">Employee Signature &amp; Date — not signed at joining.</p>
          </div>
        </div>
        <div className="pack-ack">This Confirmation Letter is issued by the Company at its sole discretion upon satisfactory completion of the probation period. It does not alter the confidentiality, IP, non-solicitation, or other post-employment obligations previously agreed.</div>
      </Page>

      <Page logo={logo} branded>
        <SectionTitle badge="SECTION VI — GRIEVANCE, DISCIPLINE & SIGN-OFF" title="Disciplinary Process · Grievance Redressal · Master Sign-Off" kicker="Employee Handbook · The Halo Effect Consulting LLP" />
        <h4 className="pack-sub">Disciplinary policy</h4>
        <p className="pack-p"><strong>Minor misconduct:</strong> Verbal warning → First written warning → Final written warning → Termination.</p>
        <p className="pack-p"><strong>Gross misconduct — immediate termination without notice:</strong></p>
        <ul className="pack-list">
          <li>Theft, fraud, or dishonesty in any form</li>
          <li>Physical or verbal harassment, including sexual harassment</li>
          <li>Wilful damage to Company property or systems</li>
          <li>Disclosure of confidential or client information to any party</li>
          <li>Falsification of attendance, timesheets, reports, or any Company records including THEC Portal submissions</li>
          <li>Absence without communication for 5+ consecutive working days</li>
          <li>Working for a competitor or accepting freelance work related to Company’s services without written approval</li>
          <li>Sharing prospect pricing, client commercial data, or pipeline information with any external party including family members</li>
          <li>Bringing the Company or its clients into disrepute publicly or on social media</li>
        </ul>
        <h4 className="pack-sub">Grievance redressal</h4>
        <ol className="pack-list">
          <li><strong>Informal (7 days):</strong> Raise with direct reporting manager.</li>
          <li><strong>Formal (15 days):</strong> Written complaint to HR / COO if unresolved.</li>
          <li><strong>Escalation (15 days):</strong> Unresolved formal complaints escalate to Co-Founders.</li>
          <li><strong>External:</strong> Labour Commissioner or legal forum if still unresolved.</li>
        </ol>
        <p className="pack-p">POSH complaints follow a separate, accelerated ICC process. All grievances are confidential. Retaliation against a complainant is gross misconduct.</p>
        <h4 className="pack-sub">Performance appraisal &amp; PIP</h4>
        <p className="pack-p">Formal appraisals annually in April, mid-year review in October. Employees rated below expectations for two consecutive cycles may be placed on a PIP (30–90 days with weekly check-ins). Failure to meet PIP targets may result in termination. All PIP documents signed by employee, manager, and HR. A formal Confirmation Letter is issued upon satisfactory probation completion — confirmation is not automatic.</p>
        <h4 className="pack-sub">Master sign-off — Employee Handbook &amp; Performance Pack</h4>
        <div className="pack-ack">
          By signing below, I, <Fill>{ctx.name}</Fill>, confirm that I have received, read, and fully understood this Employee Handbook &amp; Performance Pack. I agree to be bound by all policies, procedures, standards, and obligations set out herein — including leave policy, attendance policy, code of conduct, POSH policy, compliance policies, technology policies, KRA/KPI framework, learning commitments, and the disciplinary and exit policies — as if I had signed each section individually. I acknowledge these policies may be updated with reasonable notice and specifically acknowledge my mandatory obligation to submit daily scrum updates, EOD reports, and learning logs on the <strong>THEC Employee Portal</strong>.
        </div>
        <SignOff ctx={ctx} />
      </Page>
    </>
  )
}

export function OnboardingPackViewer({ row, logo, footer }) {
  const [tabId, setTabId] = useState('employment')
  const ctx = buildOnboardingPackContext(row)
  const tab = TABS.find((item) => item.id === tabId) || TABS[0]
  return (
    <div className="pack-viewer">
      <div className="pack-tabs">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = item.id === tabId
          return (
            <button
              key={item.id}
              type="button"
              className={`pack-tab ${active ? 'is-active' : ''}`}
              onClick={() => setTabId(item.id)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="pack-stage">
        {tabId === 'employment' && <EmploymentBody ctx={ctx} logo={logo} tab={tab} />}
        {tabId === 'legal' && <LegalBody ctx={ctx} logo={logo} tab={tab} />}
        {tabId === 'handbook' && <HandbookBody ctx={ctx} logo={logo} tab={tab} />}
        {footer ? <div className="pack-actions">{footer}</div> : null}
      </div>
    </div>
  )
}
