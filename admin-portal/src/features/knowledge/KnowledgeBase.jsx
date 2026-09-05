import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { useKnowledgeStore } from './stores/knowledgeStore'
import { getArticles, createArticle, deleteArticleFromDb } from './services/knowledgeService'
import {
  BookOpen,
  Plus,
  Search,
  Loader2,
  X,
  Trash2,
  Tag,
  Clock,
  User,
  FileText,
} from 'lucide-react'

export const KnowledgeBase = () => {
  const {
    articles,
    isLoading,
    searchQuery,
    setArticles,
    setIsLoading,
    setSearchQuery,
    addArticle,
    deleteArticle,
  } = useKnowledgeStore()

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)

  // Form states
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Client Onboarding SOP')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('Admin')
  const [isSaving, setIsSaving] = useState(false)

  // Fetch articles from Firestore on mount
  useEffect(() => {
    const loadArticles = async () => {
      setIsLoading(true)
      const data = await getArticles()
      setArticles(data)
      setIsLoading(false)
    }
    loadArticles()
  }, [setArticles, setIsLoading])

  const handleCreateArticle = async (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setIsSaving(true)
    const payload = {
      title: title.trim(),
      category,
      content: content.trim(),
      summary: content.trim().substring(0, 150),
      author: author.trim() || 'Admin',
      createdByRole: 'Admin',
    }

    const newDoc = await createArticle(payload)
    addArticle(newDoc)

    // Reset form
    setTitle('')
    setContent('')
    setIsSaving(false)
    setIsCreateOpen(false)
  }

  const handleDelete = async (e, articleId) => {
    e.stopPropagation()
    deleteArticle(articleId)
    await deleteArticleFromDb(articleId)
    if (selectedArticle?.articleId === articleId) {
      setSelectedArticle(null)
    }
  }

  const filteredArticles = articles.filter(
    (a) =>
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.author?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectClass =
    'w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer'

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Knowledge Base & SOPs"
        description="Internal standard operating procedures, training docs, and client guides"
        actions={
          <Button icon={Plus} variant="primary" onClick={() => setIsCreateOpen(true)}>
            New Article
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search SOPs, guides, policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-canvas border border-border text-xs text-fg placeholder:text-muted rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-accent animate-spin" />
          <span className="ml-3 text-muted text-xs">Loading documentation...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredArticles.length === 0 && (
        <Card className="py-16 text-center space-y-4 border-border bg-surface">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No articles found</p>
            <p className="text-muted text-xs">
              {searchQuery
                ? 'No documents matched your search query.'
                : 'Click "New Article" to create your first SOP or guide.'}
            </p>
          </div>
          {!searchQuery && (
            <Button icon={Plus} variant="primary" onClick={() => setIsCreateOpen(true)} className="mx-auto">
              Create First Article
            </Button>
          )}
        </Card>
      )}

      {/* Articles Grid */}
      {!isLoading && filteredArticles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredArticles.map((art) => (
            <Card
              key={art.articleId || art.id}
              hover
              onClick={() => setSelectedArticle(art)}
              className="space-y-3 cursor-pointer border-border relative group flex flex-col justify-between bg-surface"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, art.articleId || art.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Delete Article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="brand">{art.category || 'General SOP'}</Badge>
                    {art.createdByRole === 'Employee' || art.author?.toLowerCase().includes('employee') || art.author?.toLowerCase().includes('staff') ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Employee Post
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-accent-soft text-accent border border-accent/20">
                        Admin Post
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-fg text-sm group-hover:text-accent dark:group-hover:text-accent transition-colors line-clamp-2">
                    {art.title}
                  </h4>
                </div>

                <p className="text-xs text-muted line-clamp-3 leading-relaxed">
                  {art.summary || art.content}
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-muted" /> {art.author || 'Admin'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted" />
                  {art.updatedAt ? new Date(art.updatedAt).toLocaleDateString() : 'Recently'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── CREATE ARTICLE MODAL ────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-fg text-base">Publish Knowledge Article</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArticle} className="space-y-4">
              <Input
                label="Article Title"
                placeholder="e.g. Client Onboarding SOP & Checklist"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={selectClass}
                >
                  <option value="Client Onboarding SOP" className="bg-surface text-fg">Client Onboarding SOP</option>
                  <option value="Finance & Billing" className="bg-surface text-fg">Finance & Billing</option>
                  <option value="Engineering & Code Guidelines" className="bg-surface text-fg">Engineering & Code Guidelines</option>
                  <option value="Sales & CRM Process" className="bg-surface text-fg">Sales & CRM Process</option>
                  <option value="HR & Team Policies" className="bg-surface text-fg">HR & Team Policies</option>
                </select>
              </div>

              <Input
                label="Author Name"
                placeholder="e.g. Admin / Sarah Jenkins"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">
                  Article Content / Guide Body
                </label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write step-by-step procedures, documentation, guidelines..."
                  className="w-full bg-canvas border border-border text-fg placeholder:text-muted text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-1/3"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-2/3"
                  icon={isSaving ? Loader2 : Plus}
                  disabled={isSaving}
                >
                  {isSaving ? 'Publishing...' : 'Publish Article'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── READ ARTICLE MODAL ──────────────────────────────────────────────── */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="space-y-1">
                <Badge variant="brand">{selectedArticle.category || 'General SOP'}</Badge>
                <h2 className="font-bold text-fg text-lg">{selectedArticle.title}</h2>
                <p className="text-xs text-muted flex items-center gap-3">
                  <span>Author: {selectedArticle.author || 'Admin'}</span>
                  <span>•</span>
                  <span>
                    Updated:{' '}
                    {selectedArticle.updatedAt
                      ? new Date(selectedArticle.updatedAt).toLocaleString()
                      : 'Recently'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-border text-fg text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {selectedArticle.content}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedArticle(null)}>
                Close Article
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
