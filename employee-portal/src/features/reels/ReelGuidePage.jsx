import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { ReelNav } from './reelsUi'

const TABS = [
  { id: 'demo', label: 'Guided demo' },
  { id: 'rules', label: 'Roles and rules' },
  { id: 'spec', label: 'Developer spec' },
]

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-fg">{children}</div>
    </section>
  )
}

function Steps({ rows }) {
  return (
    <ol className="space-y-2">
      {rows.map(([who, text]) => (
        <li key={who}>
          <span className="font-medium">{who}. </span>
          {text}
        </li>
      ))}
    </ol>
  )
}

export function ReelGuidePage() {
  const [tab, setTab] = useState('demo')

  return (
    <div>
      <PageHeader
        title="Reel delivery"
        description="Plan every reel ahead, edit to the T-3 rule, and let the portal chase the schedule."
      />
      <ReelNav />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === item.id ? 'bg-accent text-white' : 'border border-border text-fg hover:bg-chrome'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'demo' && (
        <div className="space-y-4">
          <Section title="SMM">
            <Steps
              rows={[
                ['1', 'Set the monthly quota, then place every contracted reel on a go-live date. Next month is due by the 25th.'],
                ['2', 'Plan the reel: client, title, go-live, platforms, editor, collaborators, brief, and the raw footage link. Deadlines fill in from the go-live date. Check the editor workload before you assign.'],
                ['3', 'A go-live under 72 hours is Rush. Add a reason. Leadership sees that reel.'],
                ['4', 'When QC approves, schedule it in Meta Business Suite. Confirm the caption, cover, and collaborator invites in the portal. That moves the reel to Scheduled.'],
                ['5', 'At go-live, check the post and add the post link. That moves the reel to Published.'],
              ]}
            />
            <p className="text-muted">You are also QC for a reel you planned, unless a reviewer was already stored on it.</p>
          </Section>
          <Section title="Editor">
            <Steps
              rows={[
                ['1', 'Open the task only after it has a go-live date. Start editing.'],
                ['2', 'Upload the review copy from the reel: MP4 or WebM, 720p, 50 MB or less. It stays in the portal, not on Drive.'],
                ['3', 'Upload the edited MP4 or WebM. QC reviews that file.'],
                ['4', 'If QC requests changes, the popup names what to fix. Upload the next version.'],
              ]}
            />
          </Section>
          <Section title="QC">
            <p>The SMM who planned the reel reviews it. Leadership can decide as well.</p>
            <Steps
              rows={[
                ['1', 'The editor’s upload opens a popup for you. Open the review and decide within one working day. Sunday does not count.'],
                ['2', 'Request changes with feedback, or approve. Approval makes the reel Ready to Schedule and asks you to schedule it now.'],
              ]}
            />
          </Section>
          <Section title="Leadership">
            <Steps
              rows={[
                ['1', 'Rush reels are visible as soon as they are planned.'],
                ['2', 'A missed deadline turns the reel At risk for the SMM and the editor. Catch up before T-3.'],
                ['3', 'If it is not scheduled by T-3, or still not live one hour after go-live, Swathish, Vivek, and Vedhika get an escalation.'],
                ['4', 'Every reminder No is on the Leadership page, with the on-time score for T-3 and for going live within 60 minutes.'],
              ]}
            />
          </Section>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <Section title="The T-3 rule">
            <p>Every reel is planned with a go-live date first. The portal counts back from it. The reel must be scheduled three days before it goes live. Each deadline closes at 8 PM India time. A Sunday deadline moves to the Saturday before.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">Deadline</th>
                    <th className="pr-3">What must be done</th>
                    <th className="pr-3">Owner</th>
                    <th>Example: live Sun 22 Nov, 1 PM</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['T-7', 'Reel planned, editor assigned, brief and raw footage in the task', 'SMM', 'Sat 14 Nov'],
                    ['T-5', 'First cut uploaded for QC', 'Editor', 'Tue 17 Nov'],
                    ['T-4', 'QC approved', 'SMM who planned it', 'Wed 18 Nov'],
                    ['T-3', 'Scheduled in Meta Business Suite, with cover and collaborators', 'SMM', 'Thu 19 Nov'],
                    ['T', 'Live, post link added', 'SMM', 'Sun 22 Nov, 1 PM'],
                  ].map((row) => (
                    <tr key={row[0]} className="border-t border-border">
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className="py-2 pr-3 align-top">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Pop-ups and reminders">
            <ul className="space-y-2">
              <li>Editor uploads a cut: the planning SMM opens it and decides within one working day.</li>
              <li>QC requests changes: the editor fixes it and uploads the next version.</li>
              <li>QC approves: the SMM schedules it now.</li>
              <li>Every 30 minutes until it is scheduled: “Have you scheduled it?” Yes opens the checklist. No is logged and opens the task.</li>
              <li>Go-live time, with sound: check the live post. Yes adds the post link. No repeats every 10 minutes.</li>
              <li>A missed deadline: the SMM and the editor see At risk.</li>
              <li>Not scheduled by T-3, or not live one hour after go-live: Swathish, Vivek, and Vedhika.</li>
              <li>9:30 AM: digest of today’s go-lives, reels to schedule today, and what is waiting on QC.</li>
            </ul>
          </Section>
          <Section title="Ground rules">
            <ul className="list-disc space-y-1 pl-5">
              <li>If it is not in the portal, it did not happen. No approvals or feedback over WhatsApp.</li>
              <li>No reel is edited without a go-live date. Plan first, then assign.</li>
              <li>The editor uploads the cut. QC approves that file.</li>
              <li>Answer every reminder honestly. Each No is logged and visible to leadership.</li>
              <li>Cover and collaborator invites are set while scheduling, not after the post is live.</li>
            </ul>
          </Section>
          <Section title="Drive">
            <pre className="overflow-x-auto whitespace-pre text-xs text-muted">{`Halo Video Production
├── HEKSH
│   ├── 00_Raw
│   └── 01_FINAL
│       └── HEKSH-R008_8PanelDress_v02.mp4
├── AADHITI
└── MAGIC20`}</pre>
            <p className="text-muted">Review copies are uploaded in the portal, never to Drive.</p>
          </Section>
        </div>
      )}

      {tab === 'spec' && (
        <div className="space-y-4">
          <Section title="Statuses">
            <p>To Do, In Progress, In Review, Changes Requested, Ready to Schedule, Scheduled, Published. Risk is On track, At risk, Late, Missed, or Published. Late means it passed T-3 without being scheduled. Missed means it is still unpublished more than an hour after go-live.</p>
          </Section>
          <Section title="Deadlines and Rush">
            <p>`reelDeadlines` and `reel_deadline` count back 7, 5, 4, and 3 days from the go-live date in Asia/Kolkata, close at 8 PM, and move a Sunday to the Saturday before. `isRush` is true when go-live is under 72 hours away. Planning then requires a reason and notifies leadership.</p>
          </Section>
          <Section title="Functions">
            <ul className="space-y-1">
              <li>`reel_plan` stores the go-live, editor, typed platforms, brief, raw footage, and deadlines. Reviewer can be empty.</li>
              <li>`reel_start` moves To Do to In Progress. Only the assigned editor can start.</li>
              <li>`reel_move_stage` moves a reel between To Do, In Progress, In Review, and Changes Requested. Ready to Schedule, Scheduled, and Published stay on the schedule and publish actions.</li>
              <li>`reel_add_version` requires an MP4 or WebM of 50 MB or less, then sets In Review.</li>
              <li>`reel_decide` approves or requests changes. The stored reviewer, leadership, or the planning SMM when no reviewer is stored, can decide.</li>
              <li>`reel_schedule` requires the caption and cover, and collaborator invites when the reel has collaborators.</li>
              <li>`reel_publish` requires the post link after the reel is scheduled.</li>
            </ul>
          </Section>
          <Section title="Who is notified">
            <p>A cut upload notifies the stored reviewer and the planning SMM. With no reviewer, only the SMM is notified, and that SMM can approve or request changes. Schedule reminders go to the SMM every 30 minutes until the reel is scheduled. The go-live check repeats every 10 minutes with sound. The minute cron calls `reel_scheduler_tick`.</p>
          </Section>
        </div>
      )}
    </div>
  )
}
