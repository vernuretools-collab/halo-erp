import { create } from 'zustand'

export const useWorkflowStore = create((set) => ({
  workflows: [],
  runs: [],
  isLoading: false,

  setWorkflows: (workflows) => set({ workflows }),
  setRuns: (runs) => set({ runs }),
  setIsLoading: (isLoading) => set({ isLoading }),

  addWorkflow: (newWf) =>
    set((state) => ({
      workflows: [
        {
          workflowId: `wf_${Date.now()}`,
          status: 'active',
          runCount: 0,
          lastRunAt: new Date().toISOString(),
          ...newWf,
        },
        ...state.workflows,
      ],
    })),

  addRun: (run) =>
    set((state) => ({
      runs: [
        {
          runId: `run_${Date.now()}`,
          executedAt: new Date().toISOString(),
          status: 'success',
          ...run,
        },
        ...state.runs,
      ],
    })),

  toggleWorkflowStatus: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.workflowId === workflowId
          ? { ...w, status: w.status === 'active' ? 'paused' : 'active' }
          : w
      ),
    })),

  deleteWorkflow: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.filter((w) => w.workflowId !== workflowId),
    })),

  incrementRunCount: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.workflowId === workflowId
          ? { ...w, runCount: (w.runCount || 0) + 1, lastRunAt: new Date().toISOString() }
          : w
      ),
    })),
}))
