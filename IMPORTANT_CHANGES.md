# Important changes

These decisions stay. Do not undo them while doing a different task.

When a change sets a new rule like the ones below, append a dated entry. Do not delete or rewrite older entries, and do not replace this file.

## 2026-10-27 — Joining setup is not a staff employee

Employee Onboarding **Setup new employee** creates a joining login only. It is not the same as adding someone to the employee directory.

- The onboarding service calls `create-user` with `type: 'employee_onboarding'` in [admin-portal/src/features/team/services/employeeOnboardingService.js](admin-portal/src/features/team/services/employeeOnboardingService.js).
- That path writes `employee_onboarding` and a profile with role `employee_onboarding`. It must not insert into `employees` or set role `employee`.
- A real staff account is a different action: `createEmployeeAccount` with `type: 'employee'` in [admin-portal/src/shared/services/authService.js](admin-portal/src/shared/services/authService.js). That path still writes `employees`.
- Joining emails on `@join.halo.local` or `@joining.halo.local` are not directory employees. The joining branch in [supabase/functions/create-user/index.ts](supabase/functions/create-user/index.ts) removes any `employees` row for that login.

## 2026-10-27 — Onboarding form data stays in employee_onboarding

The Employee Onboarding form (setup fields and the hire’s submitted answers) is stored in `employee_onboarding`.

- Removing a joining row from `employees` must not remove that onboarding record.
- The admin list and detail pages load that table when the page opens. A failed fetch is an error, not an empty directory.

## 2026-10-27 — In-progress onboarding answers survive a refresh

Answers the hire types into the Employee Onboarding form are kept in this browser and saved as a draft. Refreshing the page restores those fields and the section they were on. A submitted form loads the submitted answers.

## 2026-10-28 — Offline break, lunch, and work lines sync later

An employee can start and end break, start and end lunch, and add a work-timeline line while this browser is offline.

- Those actions stay on the device and show immediately. A failed attendance save is kept in `crm_attendance_outbox`. A failed work-timeline create, edit, or delete is kept in `crm_timeline_outbox`.
- The employee screen sends them when the connection returns. Same-day shift events are unioned. An admin edit (`source === 'admin_edit'`) still replaces that day's shift log.
- Admin attendance and the work timeline stay server-only. Admin sees a break, lunch, or work line only after that server write succeeds.

## 2026-10-28 — Admin KRA weights have no required total

On Employee Onboarding, the admin chooses the KRA weights. They do not have to total 80% or 100%.

- Setup and the handbook editor accept any total. A filled row still needs an area, a metric, and a weight greater than 0.
- `create-user` for `employee_onboarding` does not reject a total other than 80%.

## 2026-10-30 — Onboarding department can be typed

On Employee Onboarding **Setup new employee**, Department is a text field with the existing departments as suggestions.

- An admin can choose a saved department or type a new name and press Enter.
- A new name is stored with the other departments, so the next setup can choose it.
- Saving the joining login also stores a typed department that was not confirmed with Enter.

## 2026-10-30 — Onboarding department is a plain input

On Employee Onboarding **Setup new employee**, Department is only a text input. It does not show a department list or suggestions.

- The admin types the department name. That text is what the joining record uses.
- Saving still stores a new name with the other departments, without asking the admin to pick from a list.

## 2026-10-31 — Employee exit is archival

Marking someone Ex-Employee or Archived only patches `status`, `lastWorkingDay`, `exitReason`, and `exitHistory` on the existing `employees` row. Ex-Employee is stored as `relieved`.

- The original employee id stays. Return to Active sets `status` back to `active` and appends exit history. It does not clear the last working day, exit reason, or earlier history.
- Exit, archive, and return must not delete or reset the employee row, the login account, or any linked attendance, timeline, leave, scrum, project, task, document, onboarding, or notification record.

## 2026-11-02 — Onboarding employment stays editable

After the joining login exists, an admin can change the employment details on Employee Onboarding. That includes department, designation, employee ID, name, reporting manager, joining date, work mode, CTC, probation, work location, assets, and issue date.

- The joining username and password stay. This edit does not create a directory employee.
- The change is saved on `employee_onboarding.employment` and on the joining profile. The list, the hire’s form, the pack view, and the PDF downloads read that updated employment.

## 2026-11-02 — Former staff stay off live team screens

Ex-employees (`relieved`) and archived employees stay on the Ex-Employees page. They stay out of the live team screens: attendance, work timeline, scrum, leave, leave and WFH policy, payslips, employee documents, monthly reports, task and project assignment lists, announcement notifications, and the dashboard’s current-staff counts.

- People on notice period stay on those screens.
- Final Documentation can still load them so a relieving letter can be generated.
- Exit does not delete the employee row or linked attendance, timeline, leave, scrum, project, task, or document records. The Ex-Employees profile still shows that history.

## 2026-11-11 — Client signatory title stays on the agreement

Register Client Portal User does not ask for Signatory Designation. That job title belongs on the client agreement, where the client enters it when they sign.

- Account creation still stores a title only as the existing fallback, Authorized Representative, until the client sets one on the document.
- Do not put the designation field back on the registration form.

## 2026-11-11 — Client review does not show Account & Billing

The client onboarding review step shows the signed agreements only. It does not show the Account & Billing card.

- Company, billing email, billing address, GST, and payment method are not collected from the client during onboarding.
- Do not put that summary card back on the review step.

## 2026-11-12 — Attendance follows every login linked by profile email

A staff member can have a directory row and another login whose profile stores the same email. Attendance, the admin calendar, the monthly report, and the dashboard present count treat those logins as one person.

- Match a log by its uid, employee id, or `YYYY-MM-DD_{id}` document id. Link the extra login from the profile email, not from `auth.users.email`.
- When two logs exist for the same day, keep the one that is clocked in. Otherwise keep the one with a clock-out, or the longer worked time.
- A saved Present day still shows on the employee calendar and the admin calendar when it is earlier than the join date. A day before the join date with no log stays blank.

## 2026-11-14 — Company lunch window overrides only those hours

Organization Settings can set one lunch window for every employee.

- During that window, a clocked-in employee is switched to lunch. Work screenshots stay paused the same way they already pause for break and lunch. Tea break ends if it is still open when lunch starts.
- When the window ends, that scheduled lunch ends. A lunch the employee started themselves still stays on until they end it.
- Outside the window, break, lunch, and screenshots follow the existing rules. The lunch button can be hidden; the window still runs.

## 2026-11-14 — Organization chart follows departments

The employee Organization Structure page is a live team screen. Its columns come from departments in Organization Settings.

- Active staff and people on notice period appear under their department. Ex-employees (`relieved`) and archived employees stay off the chart, including the founder cards when that person has an employee row.
- Renaming a department updates the department and the employee records that used the old name. Deleting a department does not delete people.
- Exit still does not delete the employee row or linked attendance, timeline, leave, scrum, project, task, or document records.

## 2026-11-14 — Working hours and grace stay editable

Organization Settings stores the office start, office end, and grace minutes on `companySettings/workingHours`. An admin can change them at any time. Saving replaces the company values. There is no lock.

- Late marking uses the current start and grace. A clock-in at or before start plus grace is on time. A later clock-in is late by the minutes past the start.
- The employee Late By line and a newly built monthly report use those current values, including past days in that new report. A report already stored is not rewritten until it is generated again.
- Office end is saved and shown. It does not change the workday length, overtime, or auto clock-out.

## 2026-11-14 — End-of-day reminder follows office end

The employee end-of-day notification is no longer fixed at 6:00 PM. It is sent when the current time reaches the office end saved in Organization Settings.

- The inbox item and the browser notification say that office-end time and ask the employee to report the EOD update and clock out.
- One reminder is sent per employee per day. Changing the end time after it has already been sent does not send a second one that day.
- Office end still does not change the workday length, overtime, or auto clock-out.

## 2026-11-18 — QC is only for marked editors and SMMs

An admin chooses QC access on the employee record with two checkboxes: Editor and SMM.

- Either checkbox lets that employee open the QC page. Everyone else does not see QC in the employee menu, and a direct `/qc` visit returns them to the dashboard.
- The admin QC page stays available to admins. The checkboxes are stored on the employee record as `qcEditor` and `qcSmm`.
- Unchecking both removes that employee's QC page. It does not delete the employee or their other records.

## 2026-11-18 — Reels uses the same Editor and SMM checkboxes

The Reels pages in the employee portal follow the same Editor and SMM checkboxes as QC.

- Either checkbox lets that employee open Reels. Everyone else does not see Reels in the menu, and a direct `/reels` visit returns them to the dashboard.
- Reel popups stay off for everyone else. Unchecking both removes Reels. It does not delete the employee or their reel records.

## 2026-11-18 — Plan reel editors are the marked editors

The Editor list on Plan reel shows only employees the admin marked Editor on Team Management.

- The checkbox is `qcEditor` on the employee record. SMM alone does not put someone in that list.
- A reel still needs an editor. If nobody is marked, the list stays empty until an admin checks Editor.

## 2026-11-18 — Go-live cannot be a past day

Plan reel and Change go-live only accept today or a later day in India time.

- Earlier days stay unselectable. T-7, T-5, T-4, and T-3 are counted back from go-live, so a past go-live would already have missed those steps.
- A go-live inside the next 72 hours is still a rush. Today is allowed.

## 2026-11-19 — Reel editing stages can be moved on the board

A reel in To Do, In Progress, In Review, or Changes Requested can be moved between those four stages from the Reels board or the reel page.

- That move goes through `reel_move_stage`. A direct update of `reels.status` is still rejected.
- Ready to Schedule, Scheduled, and Published stay on the schedule and publish actions.
- The person moving the reel must be able to open it: the editor, the SMM, the reviewer, or leadership.

## 2026-11-19 — Employee QC follows the QC Studio review loop

On the employee QC page, an SMM marks a moment on the video and attaches a note. An editor opens that mark, jumps to that time, and submits the next version.

- The Editor checkbox is the editor. The SMM checkbox is the reviewer. Someone with both can mark and submit.
- Marks stay on the version as timed comments. Approving or requesting changes still uses the existing QC actions.

## 2026-11-19 — SMM can create a QC review

An SMM can add a QC item and a timed note. An editor can open that review and its notes.

- Creating a review, or moving it to Changes requested or Approved, is allowed for an SMM, leadership, or an admin.
- An editor can read the review and send the next cut back to In Review. An editor does not approve it or request changes.

## 2026-11-19 — Reels is only for marked SMMs

The Reels pages in the employee portal follow the SMM checkbox only. The Editor checkbox no longer opens Reels.

- `qcSmm` lets that employee open Reels. An editor who is not also marked SMM does not see Reels in the menu, does not get reel popups or reel notifications, and a direct `/reels` visit returns them to the dashboard.
- QC stays available to either checkbox. An editor still uses the QC page.
- Unchecking SMM removes Reels. It does not delete the employee or their reel records.

## 2026-11-19 — Editors open planned reels on QC

The employee QC page lists every reel an SMM or an admin planned, with its title. An editor does not create a reel or a new QC review.

- Opening a planned reel shows the brief, client, editor, SMM, go-live, and raw footage.
- The assigned editor uploads an MP4 or WebM and a full-quality link, then sends that cut for review. A reel still in To Do is started as part of that send.
- An editor who is not the assignee can read the task. They do not get the upload form.
- An SMM can still add a QC review. A pure editor does not see that create form.

## 2026-11-19 — Employee QC hides the new-review bar

On the employee QC page, the title field and the Send for review bar stay hidden for an editor and for an SMM.

- Those controls stay on the admin QC page.
- The Reels page is unchanged. An SMM still plans reels there.

## 2026-11-19 — Reel upload does not ask for a full-quality link

An editor uploads the cut as a video file. The QC page and the reel page do not ask for a full-quality link, and the upload is not rejected when that link is missing.

- The file and Send for review stay. Raw footage stays on the planned reel.

## 2026-11-19 — Approval hides the reel video from the database

When a reel is approved, `reel_decide` sets `reels.hide_video` to true. The status stays `ready_to_schedule`, the version decision stays `approved`, and the QC item stays `approved`.

- A change request sets `hide_video` back to false.
- The QC screen hides the player only when that flag is true.

## 2026-11-20 — SMM and editor progress notifications

An SMM stage change and an editor upload notify the other person in the inbox.

- Moving a reel between To Do, In Progress, In Review, and Changes Requested notifies the assigned editor, unless that editor made the move. Requesting changes does the same. The inbox item opens QC. Editors still do not get the Reels menu or reel popups.
- An editor upload on a reel still notifies the SMM through the existing reel notification. A QC review that is not a reel notifies its reviewer, or every marked SMM when the review has no reviewer.
- A QC status change to Changes Requested or Approved notifies the editor who uploaded the latest version, or every marked editor when that person is the one who changed the status.

## 2026-11-20 — QC tabs do not share items

Each QC tab shows one status. Planned, In Review, Changes Requested, and Approved do not list each other's items. All still shows every item.

- Planned is a new reel that is not in review yet. An SMM plans it, and it stays on Planned until a cut is in review. In progress, before a cut is uploaded, stays on Planned too.
- The Planned tab is on the employee QC page for both SMMs and editors, and on the admin QC page. An editor can open a planned reel and upload the first cut. An editor does not create the planned item.
- A reel that already has a review uses the reel's stage for the tab, so a changes request does not stay under In Review.
