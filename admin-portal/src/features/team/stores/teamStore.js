import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useTeamStore = create(
  persist(
    (set) => ({
      employees: [],
      departments: [],
      leaveRequests: [],
      clockedIn: false,
      clockInTime: null,

      setEmployees: (employees) => set({ employees }),
      setDepartments: (departments) => set({ departments }),
      setLeaveRequests: (leaveRequests) => set({ leaveRequests }),

      addEmployee: (newEmp) =>
        set((state) => ({
          employees: [
            {
              uid: `emp_${Date.now()}`,
              status: 'active',
              joinedAt: new Date().toISOString().split('T')[0],
              utilizationRate: 85,
              skills: newEmp.skills || ['General'],
              ...newEmp,
            },
            ...state.employees,
          ],
        })),

      deleteEmployee: (uid) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.uid !== uid),
        })),

      updateEmployee: (uid, updatedFields) =>
        set((state) => ({
          employees: state.employees.map((e) =>
            e.uid === uid || e.employeeId === uid ? { ...e, ...updatedFields } : e
          ),
        })),

      addLeaveRequest: (newLeave) =>
        set((state) => ({
          leaveRequests: [
            {
              status: 'pending',
              ...newLeave,
              leaveId: newLeave?.leaveId || `leave_${Date.now()}`,
            },
            ...state.leaveRequests.filter((l) => l.leaveId !== newLeave?.leaveId),
          ],
        })),

      updateLeaveStatus: (leaveId, newStatus) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.map((l) =>
            l.leaveId === leaveId ? { ...l, status: newStatus } : l
          ),
        })),

      removeLeaveRequest: (leaveId) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.filter((l) => l.leaveId !== leaveId),
        })),

      toggleClockIn: () =>
        set((state) => ({
          clockedIn: !state.clockedIn,
          clockInTime: !state.clockedIn ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null,
        })),
    }),
    {
      name: 'business-os-team-store',
    }
  )
)
