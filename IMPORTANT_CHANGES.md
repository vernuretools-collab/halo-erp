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
