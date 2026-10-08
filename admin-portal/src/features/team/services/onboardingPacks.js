import { FIXED_KRAS } from '../../../../../shared/supabase/employeeOnboarding.js'
import {
  addDays,
  createPack,
  fileSlug,
  firstName,
  formatPackDate,
  probationEndDate,
} from './onboardingPdf.js'

const EMPTY_ASSET_WORDS = ['nil', 'none', 'n/a', 'na', 'no', '-', 'null', 'not applicable']

export function hasIssuedAssets(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return !EMPTY_ASSET_WORDS.includes(text)
}

export function parseAssetItems(value) {
  if (!hasIssuedAssets(value)) return []
  return String(value)
    .split(/[\n;|/]+/)
    .flatMap((part) => (part.includes(',') ? part.split(',') : [part]))
    .map((item) => item.trim())
    .filter((item) => item && !EMPTY_ASSET_WORDS.includes(item.toLowerCase()))
}

export function buildOnboardingPackContext(row) {
  const employment = row?.employment || {}
  const answers = row?.answers || {}
  const personal = answers.personal || {}
  const name = personal.fullName || employment.fullName || ''
  const kras = Array.isArray(row?.kras?.custom) ? row.kras.custom : []
  const fixed = row?.kras?.fixed?.length ? row.kras.fixed : FIXED_KRAS
  const assets = employment.assets || ''
  return {
    employment,
    answers,
    personal,
    bank: answers.bank || {},
    kyc: answers.kyc || {},
    emergency: answers.emergency || {},
    name,
    first: firstName(name),
    id: employment.employeeId || '',
    designation: employment.designation || '',
    department: employment.department || '',
    manager: employment.reportingManager || '',
    joining: formatPackDate(employment.dateOfJoining),
    issued: formatPackDate(employment.issueDate) || formatPackDate(new Date().toISOString()),
    location: employment.workLocation || '',
    mode: employment.workMode || '',
    ctc: employment.monthlyCtc || '',
    probation: employment.probationPeriod || '',
    assets,
    hasAssets: hasIssuedAssets(assets),
    assetItems: parseAssetItems(assets),
    address: personal.permanentAddress || personal.currentAddress || '',
    signature: answers.signature || '',
    kras,
    fixed,
    review30: addDays(employment.dateOfJoining, 30),
    review60: addDays(employment.dateOfJoining, 60),
    review90: addDays(employment.dateOfJoining, 90),
    probationEnd: probationEndDate(employment.dateOfJoining, employment.probationPeriod),
  }
}

function cover(pack, docNo, title, subtitle) {
  pack.write('THE HALO EFFECT', { size: 22, color: [13, 122, 110], style: 'bold', gap: 2 })
  pack.write('CONSULTING', { size: 14, color: [176, 132, 42], style: 'bold', gap: 14 })
  pack.write(`DOCUMENT ${docNo} OF 3`, { size: 9, color: [100, 116, 139], gap: 6 })
  pack.h1(title)
  pack.note(subtitle)
}

function identity(pack, ctx) {
  pack.identity([
    ['EMPLOYEE NAME', ctx.name, 'EMPLOYEE ID', ctx.id],
    ['DESIGNATION', ctx.designation, 'DEPARTMENT', ctx.department],
    ['DATE OF JOINING', ctx.joining, 'ISSUED ON', ctx.issued],
  ])
}

export function downloadEmploymentPack(row) {
  const ctx = buildOnboardingPackContext(row)
  const pack = createPack()
  cover(pack, '1', 'Employment Agreement Pack', 'Offer Letter · Appointment Agreement · Job Description · Probation Terms')
  identity(pack, ctx)
  pack.h2('Contents')
  pack.p('A  Offer Letter')
  pack.p('B  Appointment & Employment Agreement')
  pack.p('C  Job Description')
  pack.p('D  Probation & Confirmation Terms')
  pack.note('One master signature at the end of this pack covers all sections.')
  pack.note('PRIVATE & CONFIDENTIAL · FOR EMPLOYEE USE ONLY · THE HALO EFFECT CONSULTING LLP')

  pack.brand()
  pack.badge('SECTION A')
  pack.h1('Offer Letter')
  pack.note('Employment Pack · The Halo Effect Consulting LLP')
  pack.p(`Date: ${ctx.issued}  |  Private & Confidential`)
  pack.p('To,')
  pack.p(ctx.name)
  pack.p(ctx.address)
  pack.p(`Subject: Offer of Employment — ${ctx.designation}`)
  pack.p(`Dear ${ctx.first},`)
  pack.p(`We are pleased to extend this offer of employment to you for the position of ${ctx.designation} in our ${ctx.department} department at The Halo Effect Consulting LLP, effective ${ctx.joining}. This offer is subject to your acceptance of all terms herein and execution of all documents in this onboarding pack.`)
  pack.h2('Key terms')
  pack.rows([
    ['Designation', ctx.designation],
    ['Department', ctx.department],
    ['Reporting to', ctx.manager],
    ['Date of joining', ctx.joining],
    ['Work location', ctx.location],
    ['Work mode', ctx.mode],
    ['Monthly CTC (gross)', `₹ ${ctx.ctc}`],
    ['Probation period', ctx.probation],
    ['Notice period (probation)', '30 days'],
    ['Notice period (post-confirmation)', '60 days'],
    ...(ctx.hasAssets ? [['Assets to be issued', ctx.assets]] : []),
  ])
  pack.h2('Conditions')
  pack.p('This offer is conditional upon: (a) verification of all documents; (b) satisfactory background verification; (c) execution of all onboarding documents; (d) confirmation that you are not bound by any conflicting restriction from a former employer. This offer lapses if not accepted within 5 working days.')
  pack.p('Yours sincerely,')
  pack.p('Swathish G')
  pack.note('Co-Founder & Authorised Signatory · The Halo Effect Consulting LLP')

  pack.brand()
  pack.badge('SECTION B')
  pack.h1('Appointment & Employment Agreement')
  pack.p(`This Employment Agreement is entered into as of ${ctx.joining} between The Halo Effect Consulting LLP, 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050 (“Company”) AND ${ctx.name} (“Employee”).`)
  pack.h2('1. Position and duties')
  pack.p(`The Employee is appointed as ${ctx.designation} in the ${ctx.department} department, reporting to ${ctx.manager}. Duties include all responsibilities in the Job Description (Section C) and such other duties as may be assigned.`)
  pack.h2('2. Commencement, probation and confirmation')
  pack.p(`2.1 Employment commences on ${ctx.joining}. 2.2 Probation period: ${ctx.probation}. Either party may terminate during probation with 30 days’ written notice. 2.3 Confirmation is at the Company’s sole discretion and is communicated via a formal Confirmation Letter.`)
  pack.h2('3. Compensation')
  pack.p(`3.1 Monthly gross CTC: ₹ ${ctx.ctc}. 3.2 Statutory deductions (TDS, Professional Tax, and future PF/ESI as applicable) will be made. 3.3 Salary is credited by the last working day of each month.`)
  pack.h2('4. Working hours and portal obligations')
  pack.p(`4.1 Monday to Saturday, 9:30 AM – 6:30 PM. Work mode: ${ctx.mode}. 4.2 The Employee must log attendance, submit daily scrum updates, and file EOD reports on the THEC Employee Portal every working day. This is a mandatory employment obligation.`)
  pack.h2('5. Notice period and termination')
  pack.p('5.1 Post-confirmation: 60 days’ written notice by either party. 5.2 The Company may pay in lieu of notice. 5.3 Gross misconduct: immediate termination without notice.')
  pack.h2('6. Non-solicitation')
  pack.p('6.1 For 18 months post-employment the Employee shall not solicit, approach, or do business with any client or prospect of the Company with whom they had contact during employment. 6.2 For 12 months post-employment the Employee shall not recruit or encourage any Company employee to leave. 6.3 These clauses are enforceable under Indian law and do not restrict general industry participation.')
  pack.h2('7. Conflict of interest')
  pack.p('7.1 The Employee must disclose in writing — at joining and whenever circumstances change — if any family member, relative, close friend, or associate is engaged in any business, freelance, or consultancy related to the Company’s services, clients, or industry. 7.2 Prospect pricing, client commercial terms, pipeline data, and all commercially sensitive information must not be shared with any person including family members. Breach means immediate termination and legal action.')
  pack.h2('8. Governing law')
  pack.p('Governed by the laws of India. Exclusive jurisdiction of courts in Chennai, Tamil Nadu.')

  pack.brand()
  pack.badge('SECTIONS C & D')
  pack.h1('Job Description & Probation Terms')
  pack.rows([
    ['Employee', ctx.name],
    ['Designation', ctx.designation],
    ['Department', ctx.department],
    ['Reporting to', ctx.manager],
    ['Work mode', ctx.mode],
  ])
  pack.h2('Role overview')
  pack.p(`${ctx.designation} in the ${ctx.department} department, reporting to ${ctx.manager}.`)
  pack.h2('Key responsibilities')
  const duties = ctx.kras.slice(0, 6)
  if (duties.length === 0) pack.p('Responsibilities will be assigned by the reporting manager.')
  duties.forEach((kra, index) => pack.p(`${index + 1}. ${kra.keyResultArea}${kra.kpi ? ` — ${kra.kpi}` : ''}`))
  pack.h2('Skills required')
  pack.p(duties.map((kra) => kra.kpi).filter(Boolean).join('; ') || ctx.designation)
  pack.note('This job description is not exhaustive. The Company may assign additional duties consistent with the scope of the role.')
  pack.h2('Probation and confirmation terms')
  pack.bullets([
    `Probation: ${ctx.probation} from ${ctx.joining}.`,
    'Formal reviews at 30, 60, and 90 days and at the end of probation (see Document 3 for the schedule).',
    'The Company may extend probation by up to 3 months. Extension does not constitute confirmation.',
    'Confirmation is at the Company’s sole discretion. A written Confirmation Letter will be issued only upon satisfactory performance.',
    'Either party may terminate during probation with 30 days’ written notice.',
    'Leave accrues from the sixth month of employment, not from the date of joining.',
    'Upon confirmation, the notice period becomes 60 days.',
    'Mandatory during probation: 90% attendance, daily THEC Portal updates, all onboarding review milestones.',
  ])
  pack.p(`By signing below, I, ${ctx.name}, confirm I have read, understood, and agree to be bound by all sections of this Employment Agreement Pack — Sections A, B, C, and D — as if signed individually.`)
  pack.signature({ name: ctx.name, role: ctx.designation, image: ctx.signature, place: 'Chennai' })
  pack.save(`${fileSlug(ctx.name)}-employment-pack.pdf`)
}

export function downloadLegalPack(row) {
  const ctx = buildOnboardingPackContext(row)
  const pack = createPack()
  const conflict = ctx.answers.employment?.conflictOfInterest || 'No'
  cover(pack, '2', 'Legal Agreements & HR Records', 'NDA · Confidentiality · IP · Data Protection · Conflict of Interest · HR Forms · Declarations')
  identity(pack, ctx)
  pack.h2('Contents')
  pack.p('1–2   NDA & Comprehensive Confidentiality Agreement')
  pack.p('3–4   Data Protection Agreement & IP Assignment')
  pack.p('5–8   Client Undertaking · Portfolio Restriction · Commercial Confidentiality · Conflict of Interest')
  pack.p('9–11  Employee Information · KYC Declaration · Education & Experience')
  pack.p('12–14 Bank & Payroll · Statutory Declarations · Emergency Contact')
  if (ctx.hasAssets) pack.p('15–17 Asset Handover · IT Equipment Agreement · Asset Return Form')
  pack.note('One master signature at the end of this pack covers all sections.')

  pack.brand()
  pack.badge('PART I · 1 & 2')
  pack.h1('Non-Disclosure Agreement & Confidentiality Agreement')
  pack.h2('1. Non-disclosure agreement (NDA)')
  pack.p(`This NDA is entered into between The Halo Effect Consulting LLP (“Disclosing Party”) and ${ctx.name} (“Receiving Party”), effective ${ctx.joining}.`)
  pack.p('1.1 Definition. “Confidential Information” means all non-public information disclosed in connection with employment: client identities, briefs, campaign data, strategies, pricing, financials, product plans, tools, processes, methodologies, vendor relationships, employee data, prospect pipeline, and any information designated confidential.')
  pack.p('1.2 Obligations. The Employee shall: (a) keep all Confidential Information strictly secret; (b) not disclose to any third party without prior written consent; (c) use solely to perform assigned duties; (d) immediately notify the Company of any actual or suspected unauthorised disclosure.')
  pack.p('1.3 Duration. These obligations are indefinite and perpetual. They survive the termination of employment with no time limit whatsoever.')
  pack.p('1.4 Remedies. Breach causes irreparable harm for which monetary damages may be inadequate. The Company is entitled to injunctive relief in addition to all other remedies under law.')
  pack.h2('2. Confidentiality agreement — client work and internal information')
  pack.p('2.1 Client work. All work produced for clients — creatives, strategies, reports, ads, websites, content, analytics — belongs to the client or the Company. The Employee may NOT display or reference client work in any personal portfolio, website, Behance, Dribbble, LinkedIn, Instagram, or any platform without explicit written consent from both the Company and the client. The Employee may NOT mention client names, results, metrics, or strategies publicly, in interviews, or in job applications — ever, without exception. The Employee may state only: “I worked at The Halo Effect Consulting LLP as ' + ctx.designation + ' from ' + ctx.joining + '.”')
  pack.p('2.2 Retained. General skills and knowledge acquired during employment, and general industry knowledge not tied to specific clients.')
  pack.p('2.3 Internal information. Salary structures, financials, processes, tooling costs, vendor terms, and operational playbooks are confidential — indefinitely.')

  pack.brand()
  pack.badge('PART I · 3, 4 & 5')
  pack.h1('Data Protection · IP Assignment · Client Confidentiality Undertaking')
  pack.h2('3. Data protection agreement (DPDPA 2023)')
  pack.p('In compliance with the IT Act 2000 and Digital Personal Data Protection Act 2023:')
  pack.bullets([
    'Handle personal data of clients, customers, and colleagues only as strictly necessary for the assigned role.',
    'Do not download, copy, or transfer any personal data to personal devices or personal cloud accounts.',
    'Report any actual or suspected data breach to management within 2 hours of discovery.',
    'Do not use client or customer data for any purpose beyond the contracted service.',
    'Upon termination, immediately return or permanently delete all personal data in possession and confirm in writing within 24 hours of the last working day.',
    'Violation may constitute a criminal offence under the IT Act 2000 and DPDPA 2023, carrying civil and criminal liability.',
  ])
  pack.h2('4. IP and work product assignment')
  pack.p('4.1 Full assignment. All work product, inventions, creative works, code, designs, strategies, tools, templates, and deliverables created by the Employee during employment — whether during or outside working hours, using Company or personal resources, if related to the Company’s business or clients — are the sole and exclusive property of The Halo Effect Consulting LLP or its clients. No separate compensation is payable.')
  pack.p('4.2 Moral rights. To the maximum extent permitted by Indian law, the Employee irrevocably waives all moral rights in work product created in connection with the Company or its clients.')
  pack.p('4.3 Pre-existing IP. Any pre-existing IP must be declared in writing at joining. Undisclosed pre-existing IP incorporated into Company work is deemed assigned to the Company.')
  pack.p('Pre-existing IP declaration (write NIL if none): NIL')
  pack.p('4.4 Cooperation. The Employee shall execute all additional documents to perfect the Company’s or client’s title, including after employment ends.')
  pack.h2('5. Client confidentiality and non-solicitation undertaking')
  pack.p(`I, ${ctx.name}, undertake: (a) I will not contact any client of the Company for personal or freelance business during employment or for 18 months thereafter; (b) I will not disclose client identities, work nature, or results to any third party; (c) I will not use knowledge of a client’s strategy or pricing to benefit any competitor; (d) if a client approaches me directly for independent work, I will immediately inform my manager and not engage independently.`)
  pack.note('Any work created using Company time, tools, or related to Company clients — even outside office hours — belongs to the Company or its clients. This includes all creatives, code, copy, strategies, and all deliverables.')

  pack.brand()
  pack.badge('PART I · 6, 7 & 8')
  pack.h1('Portfolio Restriction · Commercial Confidentiality · Conflict of Interest')
  pack.h2('6. Portfolio and public disclosure agreement')
  pack.p(`Permitted: “I worked at The Halo Effect Consulting LLP as ${ctx.designation} from ${ctx.joining}” and general skill descriptions that do not identify any client.`)
  pack.p('Prohibited — permanently: displaying client logos, campaign screenshots, analytics, or results in any portfolio; writing case studies about client work; mentioning client names in any public medium; posting Company-branded content as personal work. This restriction is permanent because the work product and its confidentiality belong to the client without any time limit.')
  pack.h2('7. Commercial confidentiality agreement')
  pack.p('The following are commercially sensitive and strictly confidential — indefinitely:')
  pack.bullets([
    'Pricing structures, quotation methods, and margin information',
    'Vendor costs and tool subscription rates',
    'Company revenue, profitability, and financial position',
    'Business plans and upcoming service launches',
    'Prospect pipeline and CRM data',
    'Internal processes, templates, and proprietary playbooks',
    'Partner and vendor commercial terms',
  ])
  pack.p('The Employee will not disclose any of the above to any person — including family, friends, or future employers.')
  pack.h2('8. Conflict of interest declaration')
  pack.p('8.1 The Employee must not engage in any activity, business, or employment during this engagement that conflicts with the Company’s interests.')
  pack.p('8.2 Mandatory family disclosure. The Employee must disclose in writing — at joining and whenever circumstances change — if any family member, relative, close friend, or personal associate is engaged in any business, freelance, consultancy, or employment directly or indirectly related to the Company’s services, clients, industry, or prospects — including digital marketing, web development, SEO, performance marketing, branding, sales, or any adjacent field.')
  pack.p(`Family / associate disclosure: ${conflict}${conflict === 'Yes' ? ' — details to be updated in writing whenever circumstances change.' : ' — NIL at joining. Update in writing whenever circumstances change.'}`)
  pack.p('8.3 Pricing and pipeline protection. Prospect pricing, client commercial terms, pipeline data, budgets, and all sales-related internal information must not be shared with any person under any circumstances, including family members and close friends, regardless of the nature of the relationship.')
  pack.p('8.4 Consequences. Failure to disclose a conflict, or sharing of commercial information with a conflicted party, constitutes gross misconduct — immediate termination and potential legal action for damages.')

  pack.brand()
  pack.badge('PART II · HR RECORDS 9–11')
  pack.h1('Employee Information · KYC Declaration · Education & Experience')
  pack.h2('9. Employee information form')
  pack.rows([
    ['Full name (as on Aadhaar)', ctx.personal.fullName],
    ['Date of birth', formatPackDate(ctx.personal.dateOfBirth)],
    ['Gender', ctx.personal.gender],
    ['Nationality', ctx.personal.nationality],
    ['Aadhaar number', ctx.personal.aadhaar],
    ['PAN number', ctx.personal.pan],
    ['Mobile number', ctx.personal.mobile],
    ['Personal email', ctx.personal.email],
    ['Permanent address', ctx.personal.permanentAddress],
    ['Current address (if different)', ctx.personal.currentAddress],
    ["Father's name", ctx.personal.fatherName],
    ["Mother's name", ctx.personal.motherName],
    ['Marital status', ctx.personal.maritalStatus],
    ['Blood group', ctx.personal.bloodGroup],
  ])
  pack.h2('10. KYC declaration')
  pack.p('I confirm I have submitted the following originals for verification. All copies on record are true copies:')
  pack.checks([
    'Aadhaar card',
    'PAN card',
    'Passport (if available)',
    'Voter ID / Driving licence',
    'Educational certificates',
    'Experience / relieving letter',
    "Last 3 months' salary slips",
    'Cancelled cheque / passbook',
    '2 passport photographs',
  ], ctx.kyc.documents)
  pack.p('I confirm no pending legal proceedings affecting employment and authorise the Company to conduct background verification.')
  pack.h2('11. Education and experience declaration')
  pack.p('I solemnly declare that all educational qualifications and work experience stated are genuine and verifiable; I have not been terminated from any previous employer for misconduct without disclosing it; I am not subject to any conflicting obligations from a former employer, except as declared below.')
  pack.rows([
    ['Last employer', ctx.kyc.lastEmployer],
    ['Last designation', ctx.kyc.lastDesignation],
    ['Highest qualification and year', [ctx.kyc.qualification, ctx.kyc.institutionYear].filter(Boolean).join(', ')],
    ['Any conflicting obligations (NIL if none)', ctx.kyc.obligations],
  ])
  pack.note('Misrepresentation is grounds for immediate termination without notice or settlement.')

  pack.brand()
  pack.badge(ctx.hasAssets ? 'PART II & III · HR RECORDS 12–17' : 'PART II · HR RECORDS 12–14')
  pack.h1(ctx.hasAssets ? 'Bank & Payroll · Statutory · Emergency Contact · Company Property' : 'Bank & Payroll · Statutory · Emergency Contact')
  pack.h2('12. Bank and payroll details')
  pack.rows([
    ['Bank name', ctx.bank.bankName],
    ['Account holder name', ctx.bank.accountHolder],
    ['Account number', ctx.bank.accountNumber],
    ['IFSC code', ctx.bank.ifsc],
    ['Branch and city', ctx.bank.branchCity],
    ['Account type', ctx.bank.accountType],
    ['Existing UAN', ctx.bank.uan],
  ])
  pack.h2('13. Statutory declarations')
  pack.p(`I, ${ctx.name}, declare: (a) not convicted of any criminal offence involving moral turpitude; (b) not an undischarged insolvent; (c) I authorise statutory deductions (Professional Tax, TDS, PF/ESI as applicable); (d) I will notify HR within 7 days of any change in statutory status; (e) I acknowledge employment under the Tamil Nadu Shops & Establishments Act 1947 and authorise registration with the Department of Labour.`)
  pack.p('[ ] Professional Tax enrolment    [ ] PF enrolment (UAN: ________)    [ ] ESI enrolment, if applicable')
  pack.h2('14. Emergency contact')
  pack.rows([
    ['Primary contact name and relationship', [ctx.emergency.primaryName, ctx.emergency.primaryRelationship].filter(Boolean).join(' · ')],
    ['Primary mobile', ctx.emergency.primaryMobile],
    ['Address', ctx.emergency.address],
    ['Secondary contact name and relationship', [ctx.emergency.secondaryName, ctx.emergency.secondaryRelationship].filter(Boolean).join(' · ')],
    ['Secondary mobile', ctx.emergency.secondaryMobile],
    ['Blood group and known conditions', [ctx.personal.bloodGroup, ctx.emergency.allergies].filter(Boolean).join(' · ')],
  ])
  if (ctx.hasAssets) {
    pack.h2('15. Asset handover form')
    pack.p(`Assets issued to ${ctx.name} on ${ctx.joining}:`)
    pack.table(
      ['#', 'Asset description', 'Brand / Model', 'Serial / IMEI', 'Condition'],
      (ctx.assetItems.length ? ctx.assetItems : [ctx.assets]).map((item, index) => [String(index + 1), item, '', '', '']),
    )
    pack.p('I acknowledge receipt of the above assets in the stated condition and agree to: (a) use them solely for Company work; (b) not damage, modify, or part with them without written authorisation; (c) return all assets on my last working day in the same or better condition; (d) authorise the Company to recover the full replacement cost from my Full & Final Settlement for any loss or damage caused by negligence.')
    pack.h2('16. IT equipment usage agreement')
    pack.bullets([
      'Company-issued devices are strictly for work purposes only. Installation of any software requires prior management approval.',
      'The Company reserves the right to remotely access, monitor, and wipe Company devices at any time without prior notice.',
      'Personal data stored on Company devices is the Employee’s own responsibility — the Company is not liable for its loss.',
      'All devices must be kept physically secure, clean, and updated within 48 hours of any system update prompt.',
      'Repair or servicing of Company devices must go through the Company only — unauthorised third-party repair shops are strictly prohibited.',
      'All Company devices must be returned on the last working day. Failure to return any device will be treated as theft and reported accordingly.',
    ])
    pack.h2('17. Asset return form')
    pack.note('Template — to be completed on the last working day, not at joining.')
    pack.table(
      ['#', 'Asset description', 'Serial / IMEI', 'Condition at return', 'Remarks'],
      (ctx.assetItems.length ? ctx.assetItems : [ctx.assets]).map((item, index) => [String(index + 1), item, '', '', '']),
    )
  }
  pack.p(`By signing below, I, ${ctx.name}, confirm I have read, understood, and agree to be bound by all sections of this Legal Agreements & HR Records Pack as if signed individually. I specifically acknowledge that confidentiality, portfolio, and commercial secrecy obligations are perpetual and indefinite with no expiry.`)
  pack.signature({ name: ctx.name, role: ctx.designation, image: ctx.signature })
  pack.save(`${fileSlug(ctx.name)}-legal-hr-pack.pdf`)
}

export function downloadHandbookPack(row) {
  const ctx = buildOnboardingPackContext(row)
  const pack = createPack()
  cover(pack, '3', 'Employee Handbook & Performance Pack', 'All HR Policies · Compliance · Technology · KRA/KPI · Learning Plan · Reviews')
  identity(pack, ctx)
  pack.h2('Contents')
  pack.p('I    HR Policies — Leave, Attendance, LOP, WFH, Working Hours, Code of Conduct, Probation')
  pack.p('II   Compensation & Growth — Hike, Promotion, Incentive, Exit Policy')
  pack.p('III  Compliance — POSH, Anti-Bribery, Anti-Discrimination, Workplace Safety, Shops Act')
  pack.p('IV   Technology & Security — IT, Cybersecurity, Passwords, Email, BYOD, Social Media, AI')
  pack.p('V    Performance & Development — KRA/KPI, 30/60/90 Plan, Review Schedule, PIP')
  pack.p('VI   Grievance & Disciplinary — Process, Escalation, Gross Misconduct Definitions')
  pack.note('One master signature at the end of this pack covers all sections.')

  pack.brand()
  pack.badge('SECTION I — HR POLICIES')
  pack.h1('Leave, Attendance, WFH & Working Hours Policies')
  pack.h2('Leave policy')
  pack.rows([
    ['Casual leave (CL)', '1/month (12/yr). Carry forward: Yes, converts to EL. Encashment: No. Max 3 consecutive days.'],
    ['Sick leave (SL)', '1/month (12/yr). No carry forward. No encashment. Certificate required beyond 2 days.'],
    ['WFH', '1/month. Cannot carry forward. No encashment. Approved via THEC Portal, 3 days prior.'],
    ['Earned leave (EL)', 'Via CL carry-forward. 6-month validity. Cannot be taken in bulk. Statutory.'],
    ['Maternity leave', '26 weeks. Maternity Benefit Act 1961. Statutory.'],
    ['Paternity leave', '2 weeks. No carry forward. 1 month prior intimation mandatory.'],
  ])
  pack.p('EL is granted per the Tamil Nadu Shops & Establishments Act via CL carry-forward. Unused CL at year-end automatically converts to EL with 6-month validity. EL cannot be taken all at once. No encashment for EL. Bereavement absence may be compensated with CL or EL at management discretion. Leave accrues from the sixth month of employment.')
  pack.h2('WFH policy')
  pack.p('Employees are entitled to 1 WFH day per calendar month. It cannot be carried forward. Requests must be submitted on the THEC Employee Portal at least 3 working days in advance, subject to approval by the COO. Approval is not automatic. During WFH: maintain availability on all channels, camera on during all meetings, and the same output standards as in-office. Non-response within 30 minutes during working hours without prior notice is marked absent. WFH may be revoked if standards fall.')
  pack.h2('Attendance policy')
  pack.bullets([
    'Monday to Saturday are working days. Saturday is a full working day unless officially communicated otherwise by management.',
    'Working hours: 9:30 AM – 6:30 PM. Lunch: 1:00 PM – 1:45 PM.',
    'Grace period: 15 minutes. Beyond that, half-day CL is deducted. More than 3 late arrivals in a month is half-day LOP.',
    'Attendance must be marked on the THEC Employee Portal daily. Daily scrum and EOD reports are mandatory.',
    'Minimum 90% monthly attendance is required for increment eligibility.',
    'Unauthorised absence for 2 or more consecutive working days without communication may be treated as abandonment.',
  ])
  pack.h2('LOP policy')
  pack.p(`LOP applies when leave is exhausted or taken without approval. LOP deduction = (Monthly CTC ÷ 26) × LOP days. For this hire, monthly CTC is ₹ ${ctx.ctc}. More than 3 LOP days in a month triggers disciplinary review. Habitual LOP (3 or more months in a year) may result in withholding of increment.`)
  pack.h2('THEC portal obligations')
  pack.p('The following are non-negotiable mandatory requirements for all employees: (a) log daily attendance; (b) submit the morning scrum update by 10:00 AM; (c) submit the EOD report by 6:30 PM covering tasks completed, blockers, and the next-day plan; (d) log all learning and upskilling activities daily. Non-compliance is a disciplinary matter.')

  pack.brand()
  pack.badge('SECTIONS I, II & III')
  pack.h1('Code of Conduct · Compensation · Compliance Policies')
  pack.h2('Code of conduct')
  pack.p('Professional standards: maintain the highest standards of integrity. Respect all colleagues, clients, and vendors. Represent the Company positively at all times.')
  pack.p('Work ethics: be punctual, meet deadlines, and communicate proactively. No personal business during working hours. No gifts or kickbacks.')
  pack.p('Communication: professional language on all channels. No harassment, bullying, or defamatory statements about the Company or clients.')
  pack.p('Consequences: verbal warning, then written warning, then final written warning, then termination. Gross misconduct means immediate termination.')
  pack.h2('Probation policy')
  pack.p(`Probation: ${ctx.probation}. Reviews at 30, 60, 90 days and at the end of probation. Extension up to 3 months is possible. Notice during probation: 30 days. Leave accrues from the sixth month only. Confirmation is the Company’s sole discretion.`)
  pack.h2('Hike and increment policy')
  pack.p('Salary increments are conducted annually and are based entirely on individual performance and Company assessment. The Company does not disclose increment criteria, bands, or percentages in advance. Increments are at the Company’s sole and absolute discretion and are not a contractual entitlement. Eligibility: minimum 6 months’ confirmed employment, satisfactory attendance, and no active disciplinary action.')
  pack.h2('Promotion and incentive')
  pack.p('Promotions are merit-based, subject to business need and budget, communicated via a formal Appointment Addendum. Variable pay (where applicable) is outlined in the Offer Letter. Not payable to employees who have resigned or been terminated at payout time.')
  pack.h2('POSH policy (SHWW Act, 2013)')
  pack.p('Zero tolerance for sexual harassment. Applies to all employees at all locations including remote. An ICC is constituted per law. Complaints within 3 months; inquiry within 60 days. Proven harassment means termination and possible law-enforcement referral. False complaints are misconduct. All proceedings are confidential.')
  pack.h2('Anti-bribery policy')
  pack.p('Zero tolerance. No bribe, kickback, or improper payment. Gifts above ₹500 from clients or vendors must be disclosed. Violations are reported under the Prevention of Corruption Act 1988.')
  pack.h2('Anti-discrimination policy')
  pack.p('Discrimination based on caste, religion, gender, sexual orientation, age, disability, language, or national origin is prohibited in all employment decisions.')
  pack.h2('Workplace safety')
  pack.p('Maintain a clean workspace. Report accidents immediately. No alcohol or controlled substances on premises. Remote employees are responsible for their own workspace safety.')
  pack.h2('Exit policy (60-day notice)')
  pack.p('Written resignation to the reporting manager and HR. Notice: 60 days post-confirmation; 30 days during probation. During notice: complete knowledge transfer, hand over all accounts and assets, obtain IT and Finance clearance. Full and final settlement within 30 days of the last working day. All confidentiality and portfolio restrictions remain permanently in force after exit.')

  pack.brand()
  pack.badge('SECTION III — COMPLIANCE')
  pack.h1('POSH Policy — Standalone Acknowledgement')
  pack.note('Employee Handbook · The Halo Effect Consulting LLP · Sexual Harassment of Women at Workplace (Prevention, Prohibition & Redressal) Act, 2013')
  pack.p(`I, ${ctx.name} (Employee ID: ${ctx.id}), employed as ${ctx.designation} at The Halo Effect Consulting LLP, hereby confirm and acknowledge the following:`)
  pack.h2('1. Receipt and understanding')
  pack.bullets([
    'I have received a copy of The Halo Effect Consulting LLP’s Prevention of Sexual Harassment (POSH) Policy and have read and understood its contents in full.',
    'I understand what constitutes sexual harassment under Section 2(n) of the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, including unwelcome physical, verbal, or non-verbal conduct of a sexual nature.',
    'I am aware that this policy applies to all employees — permanent, contractual, interns, and remote — across all workplaces including office premises, client sites, off-site events, and digital communication channels.',
  ])
  pack.h2('2. My commitments')
  pack.bullets([
    'I commit to maintaining a workplace that is safe, respectful, and free from sexual harassment at all times.',
    'I will not engage in any conduct that could reasonably be interpreted as sexual harassment, whether in person, digitally, or at any work-related event.',
    'I will report any incident of sexual harassment that I witness or personally experience to the Internal Complaints Committee (ICC) without fear of retaliation.',
    'I understand that filing a knowingly false complaint is also treated as misconduct under this policy.',
  ])
  pack.h2('3. ICC awareness')
  pack.p('I am aware that the Company has constituted an Internal Complaints Committee (ICC) as required by law. Complaints must be submitted in writing to the ICC within 3 months of the incident. The ICC will complete its inquiry within 60 days. All proceedings are strictly confidential. Retaliation is prohibited and is a separate act of misconduct. Proven sexual harassment may result in disciplinary action up to and including termination, and may be reported to law enforcement authorities.')
  pack.h2('4. Acknowledgement of zero-tolerance policy')
  pack.p('I understand that The Halo Effect Consulting LLP maintains a zero-tolerance policy toward sexual harassment. I acknowledge that this policy applies regardless of the gender, designation, or seniority of the persons involved.')
  pack.note('Important: this standalone acknowledgement is maintained separately by the ICC as required under the POSH Act 2013. It forms part of the Company’s mandatory compliance records and must be signed on or before the date of joining.')
  pack.signature({ name: `${ctx.name} · ${ctx.designation} · Emp ID ${ctx.id}`, role: '', image: ctx.signature, place: 'Chennai, Tamil Nadu' })
  pack.note('Received and filed by ICC / HR · The Halo Effect Consulting LLP · Internal Complaints Committee. ICC file reference and copy-distribution boxes are left blank for ICC records.')

  pack.brand()
  pack.badge('SECTION IV — TECHNOLOGY & SECURITY')
  pack.h1('IT, Cybersecurity, Email, BYOD, Social Media & AI Usage Policies')
  pack.columns(
    'IT acceptable use',
    [
      'Company devices and systems for work only.',
      'No unauthorised software, games, or apps.',
      'No adult content, gambling, or illegal content.',
      'No personal business on Company accounts.',
      'Never share login credentials with anyone.',
      'No cryptocurrency mining or non-work processes.',
    ],
    'BYOD (personal device)',
    [
      'Screen lock and password protection mandatory.',
      '2FA required for all work accounts on personal devices.',
      'Company data must not be mixed with personal data.',
      'Company may require remote wipe of Company data at separation.',
      'Do not access sensitive client data on personal devices where a Company device is available.',
    ],
  )
  pack.columns(
    'Cybersecurity',
    [
      'Strong unique passwords: min 12 characters, upper and lower case, a number, and a special character.',
      'Enable 2FA on all Company accounts — no exceptions.',
      'Report phishing immediately — never click suspicious links.',
      'Client data must not be stored on personal devices or personal cloud.',
      'Keep all software updated within 48 hours.',
      'Lost or stolen Company device: report within 1 hour.',
    ],
    'Social media policy',
    [
      'Do not post about clients, campaigns, or Company matters without written approval.',
      'Never share client results, screenshots, or creative work as a personal portfolio.',
      'Do not impersonate the Company or speak on its behalf without authorisation.',
      'Only authorised employees post on Company accounts; all posts follow the content workflow.',
      'Violations are a breach of confidentiality and a disciplinary matter.',
    ],
  )
  pack.h2('Email and communication')
  pack.bullets([
    'Use Company email for all professional communication.',
    'Personal email must not be used for client or Company business.',
    'Respond within 4 hours (internal) and 24 hours (client).',
    'Do not forward client emails to personal accounts.',
    'All channels — THEC Portal, WhatsApp, email — may be monitored.',
  ])
  pack.h2('Remote access')
  pack.bullets([
    'Use VPN where provided. No public computers.',
    'Log out of all remote sessions at the end of each day.',
    'Remote access is revoked immediately on separation.',
  ])
  pack.h2('AI usage policy')
  pack.bullets([
    'Permitted: using AI tools (Claude, ChatGPT, Gemini) for research, drafting, and ideation.',
    'Prohibited: inputting client names, data, or identifying information into any public AI tool.',
    'All AI-generated output must be human-reviewed before submission to clients.',
    'AI is a productivity tool — not a substitute for developing genuine expertise.',
    'Significant AI use in client deliverables must be disclosed to the supervisor.',
  ])

  pack.brand()
  pack.badge('SECTION V — PERFORMANCE & DEVELOPMENT')
  pack.h1(`KRA / KPI Sheet · 30/60/90-Day Learning Plan · Review Schedule`)
  pack.note(`Employee Handbook · The Halo Effect Consulting LLP · ${ctx.designation}`)
  pack.h2('KRA / KPI sheet')
  const kraRows = ctx.kras.slice(0, 4).map((kra, index) => [`${index + 1}. ${kra.keyResultArea || ''}`, `${kra.kpi || ''} · ${kra.weight || 0}%`])
  while (kraRows.length < 4) kraRows.push([`${kraRows.length + 1}.`, ''])
  kraRows.push(
    ['THEC Portal Compliance (scrum, EOD, learning log)', 'Daily submission rate at least 95% · 10%'],
    ['Client Satisfaction & Professional Conduct', 'No escalations; positive manager feedback · 10%'],
  )
  pack.rows(kraRows)
  pack.note('KRAs are mutually agreed and signed within 2 weeks of joining. Targets are set by the reporting manager in the first review.')
  pack.h2('30/60/90-day learning plan')
  pack.p('Day 1–30 · Understand and absorb. Complete the onboarding pack review. Log all daily scrum and EOD reports on the THEC Portal from Day 1.')
  pack.p('Day 31–60 · Apply and contribute. Deliver the first independently reviewed work output. Log all upskilling activities daily on the THEC Portal.')
  pack.p('Day 81–90 · Perform and improve. Propose one process improvement. Achieve all KPIs set in the 30-day review.')
  pack.note('The extra learning-line placeholders are left blank. They are not collected on the joining form.')
  pack.h2('Training and upskilling commitment')
  pack.p('Minimum 2 hours of structured learning per week. All learning must be logged daily on the THEC Employee Portal — a mandatory employment obligation. Company-sponsored certifications: 50% reimbursement if leaving within 12 months; 100% within 6 months of completion.')
  pack.h2('Review schedule')
  pack.rows([
    ['30-day review', `${ctx.review30} · ${ctx.manager} · Culture fit, tool adoption, portal compliance, initial output`],
    ['60-day review', `${ctx.review60} · ${ctx.manager} · Skill application, KPI progress, client readiness`],
    ['90-day review', `${ctx.review90} · Manager + Senior Mgmt · Overall performance, confirmation path`],
    ['End of probation', `${ctx.probationEnd} · Manager + Co-Founder · Formal confirmation decision`],
  ])

  pack.brand()
  pack.badge('SECTION V — PERFORMANCE TEMPLATES')
  pack.h1('Performance Review Form · PIP Template · Confirmation Letter')
  pack.note('Completed at each review milestone — not at joining. Review type, ratings, comments, and signatures below are left blank.')
  pack.rows([
    ['Employee name', ctx.name],
    ['Designation', ctx.designation],
  ])
  pack.p('THEC Portal Compliance target on the blank review form: ≥ 95% daily submission.')
  pack.h2('Performance improvement plan (PIP)')
  pack.note('Issued only when performance is consistently below expectations. Duration, manager, reason, and the improvement table are left blank.')
  pack.rows([['Employee name', ctx.name]])
  pack.p('Weekly check-ins with the manager are mandatory during the PIP period. Failure to meet PIP targets may result in termination of employment. All three parties must sign.')
  pack.h2('Confirmation letter template')
  pack.note('Issued at the end of probation — not at joining. The confirmed monthly CTC line is left blank.')
  pack.p('To,')
  pack.p(ctx.name)
  pack.p(ctx.address)
  pack.p('Subject: Confirmation of Employment')
  pack.p(`Dear ${ctx.first},`)
  pack.p(`We are pleased to confirm your employment with The Halo Effect Consulting LLP effective ________ (Confirmation Date), following the successful completion of your probation period commencing ${ctx.joining}.`)
  pack.rows([
    ['Designation', ctx.designation],
    ['Department', ctx.department],
    ['Reporting to', ctx.manager],
    ['Confirmed monthly CTC (gross)', '₹ ________'],
    ['Notice period (effective immediately)', '60 days'],
    ['Annual appraisal cycle', 'April (next cycle: April 2027)'],
  ])
  pack.p(`All other terms and conditions of your employment remain as set out in your original Appointment Agreement dated ${ctx.joining}, including all confidentiality obligations, non-solicitation clauses, and company policies.`)
  pack.p('Yours sincerely, Swathish G, Co-Founder & Authorised Signatory, The Halo Effect Consulting LLP.')
  pack.note('This Confirmation Letter is issued by the Company at its sole discretion upon satisfactory completion of the probation period. It does not alter the confidentiality, IP, non-solicitation, or other post-employment obligations previously agreed. The employee acknowledgement line is not signed at joining.')

  pack.brand()
  pack.badge('SECTION VI — GRIEVANCE, DISCIPLINE & SIGN-OFF')
  pack.h1('Disciplinary Process · Grievance Redressal · Master Sign-Off')
  pack.h2('Disciplinary policy')
  pack.p('Minor misconduct: verbal warning, then first written warning, then final written warning, then termination.')
  pack.p('Gross misconduct — immediate termination without notice:')
  pack.bullets([
    'Theft, fraud, or dishonesty in any form',
    'Physical or verbal harassment, including sexual harassment',
    'Wilful damage to Company property or systems',
    'Disclosure of confidential or client information to any party',
    'Falsification of attendance, timesheets, reports, or any Company records including THEC Portal submissions',
    'Absence without communication for 5 or more consecutive working days',
    'Working for a competitor or accepting freelance work related to the Company’s services without written approval',
    'Sharing prospect pricing, client commercial data, or pipeline information with any external party including family members',
    'Bringing the Company or its clients into disrepute publicly or on social media',
  ])
  pack.h2('Grievance redressal')
  pack.bullets([
    'Informal (7 days): raise with the direct reporting manager.',
    'Formal (15 days): written complaint to HR / COO if unresolved.',
    'Escalation (15 days): unresolved formal complaints escalate to the Co-Founders.',
    'External: Labour Commissioner or legal forum if still unresolved.',
  ])
  pack.p('POSH complaints follow a separate, accelerated ICC process. All grievances are confidential. Retaliation against a complainant is gross misconduct.')
  pack.h2('Performance appraisal and PIP')
  pack.p('Formal appraisals annually in April, mid-year review in October. Employees rated below expectations for two consecutive cycles may be placed on a PIP (30–90 days with weekly check-ins). Failure to meet PIP targets may result in termination. All PIP documents are signed by the employee, manager, and HR. A formal Confirmation Letter is issued upon satisfactory probation completion — confirmation is not automatic.')
  pack.h2('Master sign-off — Employee Handbook & Performance Pack')
  pack.p(`By signing below, I, ${ctx.name}, confirm that I have received, read, and fully understood this Employee Handbook & Performance Pack. I agree to be bound by all policies, procedures, standards, and obligations set out herein — including leave policy, attendance policy, code of conduct, POSH policy, compliance policies, technology policies, KRA/KPI framework, learning commitments, and the disciplinary and exit policies — as if I had signed each section individually. I acknowledge these policies may be updated with reasonable notice and specifically acknowledge my mandatory obligation to submit daily scrum updates, EOD reports, and learning logs on the THEC Employee Portal.`)
  pack.signature({ name: `${ctx.name} · ${ctx.designation} · Emp ID ${ctx.id}`, role: ctx.designation, image: ctx.signature, place: 'Chennai, Tamil Nadu' })
  pack.save(`${fileSlug(ctx.name)}-handbook.pdf`)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function downloadAllOnboardingPacks(row) {
  downloadEmploymentPack(row)
  await wait(500)
  downloadLegalPack(row)
  await wait(500)
  downloadHandbookPack(row)
}
