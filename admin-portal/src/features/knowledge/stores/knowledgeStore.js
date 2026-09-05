import { create } from 'zustand'

export const useKnowledgeStore = create((set) => ({
  articles: [],
  isLoading: false,
  searchQuery: '',

  setArticles: (articles) => set({ articles }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addArticle: (newArticle) =>
    set((state) => ({
      articles: [newArticle, ...state.articles],
    })),

  deleteArticle: (articleId) =>
    set((state) => ({
      articles: state.articles.filter((a) => a.articleId !== articleId),
    })),
}))
