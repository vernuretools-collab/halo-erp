import { create } from 'zustand'

export const useMarketingStore = create((set) => ({
  campaigns: [],
  contentItems: [],

  setCampaigns: (campaigns) => set({ campaigns }),
  setContentItems: (contentItems) => set({ contentItems }),

  addCampaign: (newCamp) =>
    set((state) => ({
      campaigns: [
        {
          campaignId: `camp_${Date.now()}`,
          status: 'active',
          spent: 0,
          leadsGenerated: 0,
          conversionRate: 0,
          startDate: new Date().toISOString().split('T')[0],
          ...newCamp,
        },
        ...state.campaigns,
      ],
    })),

  updateCampaign: (campaignId, updatedFields) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.campaignId === campaignId ? { ...c, ...updatedFields } : c
      ),
    })),

  deleteCampaign: (campaignId) =>
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.campaignId !== campaignId),
    })),

  addContentItem: (newItem) =>
    set((state) => ({
      contentItems: [
        {
          contentId: `cnt_${Date.now()}`,
          status: 'draft',
          ...newItem,
        },
        ...state.contentItems,
      ],
    })),

  updateContentItem: (contentId, updatedFields) =>
    set((state) => ({
      contentItems: state.contentItems.map((i) =>
        i.contentId === contentId ? { ...i, ...updatedFields } : i
      ),
    })),

  deleteContentItem: (contentId) =>
    set((state) => ({
      contentItems: state.contentItems.filter((i) => i.contentId !== contentId),
    })),
}))
