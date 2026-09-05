import { create } from 'zustand'

export const useTeamStore = create((set) => ({
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

  addLeaveRequest: (newLeave) =>
    set((state) => ({
      leaveRequests: [
        {
          leaveId: `leave_${Date.now()}`,
          status: 'pending',
          ...newLeave,
        },
        ...state.leaveRequests,
      ],
    })),

  updateLeaveStatus: (leaveId, newStatus) =>
    set((state) => ({
      leaveRequests: state.leaveRequests.map((l) =>
        l.leaveId === leaveId ? { ...l, status: newStatus } : l
      ),
    })),

  toggleClockIn: () =>
    set((state) => ({
      clockedIn: !state.clockedIn,
      clockInTime: !state.clockedIn ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null,
    })),
}))
