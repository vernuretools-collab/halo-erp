import fs from 'node:fs'

const file = new URL('./EmployeeOnboardingSetup.jsx', import.meta.url)
let text = fs.readFileSync(file, 'utf8')
const start = text.indexOf('        <Card>\r\n          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">KRA / KPI</p>')
const startLf = text.indexOf('        <Card>\n          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">KRA / KPI</p>')
const at = start >= 0 ? start : startLf
const end = text.indexOf('        {error &&')
if (at < 0 || end < 0) {
  console.log('markers', at, end)
  process.exit(1)
}
const nl = text.includes('\r\n') ? '\r\n' : '\n'
const insert = [
  '        <HandbookFields',
  '          kras={kras}',
  '          setKras={setKras}',
  '          learningPlan={learningPlan}',
  '          setLearningPlan={setLearningPlan}',
  '          reviews={reviews}',
  '          setReviews={setReviews}',
  '          onReviewTouch={(key) => { reviewTouched.current[key] = true }}',
  '        />',
  '',
].join(nl)
text = text.slice(0, at) + insert + text.slice(end)
fs.writeFileSync(file, text)
console.log('spliced')
