import { create } from 'zustand'

const INITIAL_PIPELINE_STAGES = [
  { id: 'stage_new', name: 'New Leads', color: 'blue' },
  { id: 'stage_contacted', name: 'Contacted', color: 'indigo' },
  { id: 'stage_qualified', name: 'Qualified', color: 'purple' },
  { id: 'stage_proposal', name: 'Proposal Sent', color: 'amber' },
  { id: 'stage_negotiation', name: 'Negotiation', color: 'orange' },
  { id: 'stage_won', name: 'Won', color: 'emerald' },
  { id: 'stage_lost', name: 'Lost', color: 'rose' },
]

export const useCRMStore = create((set) => ({
  leads: [],
  stages: INITIAL_PIPELINE_STAGES,
  activeLead: null,
  searchQuery: '',
  selectedStageFilter: 'all',

  setLeads: (leads) => set({ leads }),
  setActiveLead: (activeLead) => set({ activeLead }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedStageFilter: (selectedStageFilter) => set({ selectedStageFilter }),

  addLead: (newLead) =>
    set((state) => ({
      leads: [
        {
          leadId: `lead_${Date.now()}`,
          score: 70,
          currency: 'USD',
          createdAt: new Date().toISOString(),
          tags: ['New Lead'],
          ...newLead,
        },
        ...state.leads,
      ],
    })),

  updateLeadStage: (leadId, stageId, stageName) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.leadId === leadId
          ? { ...l, pipelineStageId: stageId, pipelineStage: stageName }
          : l
      ),
    })),

  deleteLead: (leadId) =>
    set((state) => ({
      leads: state.leads.filter((l) => l.leadId !== leadId),
    })),
}))
