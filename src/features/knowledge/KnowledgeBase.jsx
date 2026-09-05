import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { BookOpen, Plus, Search, Loader2, User, Clock, X } from 'lucide-react'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'

export const KnowledgeBase = () => {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General SOP')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')

  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true)
      try {
        const snap1 = await getDocs(collection(db, 'knowledgeArticles'))
        const docs1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() }))

        let docs2 = []
        try {
          const snap2 = await getDocs(collection(db, 'knowledge'))
          docs2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }))
        } catch (e) {
          // ignore
        }

        const map = new Map()
        docs1.forEach((item) => map.set(item.id, item))
        docs2.forEach((item) => {
          if (!map.has(item.id)) map.set(item.id, item)
        })

        const list = Array.from(map.values())
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        setArticles(list)
      } catch (err) {
        console.error('Error fetching articles:', err)
      } finally {
        setLoading(false)
      }
    }
    loadArticles()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    const payload = {
      title: title.trim(),
      category,
      content: content.trim(),
      summary: content.trim().substring(0, 150),
      author: author.trim() || 'Team Member',
      createdByRole: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      const ref = await addDoc(collection(db, 'knowledgeArticles'), payload)
      setArticles([{ id: ref.id, ...payload }, ...articles])
      setTitle('')
      setContent('')
      setAuthor('')
      setShowAddModal(false)
    } catch (err) {
      console.error('Error saving article:', err)
    }
  }

  const filtered = articles.filter(
    (a) =>
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base & SOPs"
        description="Internal standard operating procedures, training docs, and client guides"
        actions={
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            New Article
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-border text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-accent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-accent" />
          Loading Knowledge Articles...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center space-y-2">
          <BookOpen className="w-7 h-7 text-muted mx-auto" />
          <p className="text-slate-300 font-semibold text-sm">No articles found</p>
          <p className="text-xs text-muted">Create an article or change your search filter.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map((art) => (
            <Card
              key={art.id}
              hover
              onClick={() => setSelectedDoc(art)}
              className="space-y-3 cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-accent bg-accent-soft px-2 py-0.5 rounded">
                    {art.category || 'General'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {art.createdByRole === 'Employee' ? 'Employee Post' : 'Admin Post'}
                  </span>
                </div>
                <h4 className="font-bold text-fg text-sm line-clamp-2">{art.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-3">{art.summary || art.content}</p>
              </div>
              <div className="pt-2 border-t border-border/80 flex items-center justify-between text-[11px] text-slate-400">
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

      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-4 relative bg-slate-900 border-border">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs font-semibold text-accent">{selectedDoc.category}</span>
                <h3 className="font-bold text-white text-base mt-1">{selectedDoc.title}</h3>
                <p className="text-xs text-slate-400">
                  By {selectedDoc.author || 'Admin'} ({selectedDoc.createdByRole || 'Role'})
                </p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {selectedDoc.content}
            </div>
            <div className="text-right">
              <Button size="sm" onClick={() => setSelectedDoc(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 relative bg-slate-900 border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-white text-sm">Create New Knowledge Article</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-border text-xs text-white rounded-lg p-2.5"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-border text-xs text-white rounded-lg p-2.5"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-slate-950 border border-border text-xs text-white rounded-lg p-2.5"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Content</label>
                <textarea
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-950 border border-border text-xs text-white rounded-lg p-2.5"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Publish</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
