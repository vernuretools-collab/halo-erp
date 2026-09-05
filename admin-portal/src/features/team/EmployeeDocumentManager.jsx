import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { TeamSubNav } from './components/TeamSubNav'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { getEmployees } from './services/teamService'
import { db, storage } from '../../shared/services/firebaseService'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import {
  FileText,
  Download,
  Trash2,
  Search,
  ExternalLink,
  Users,
  Award,
  GraduationCap,
  CreditCard,
  FolderOpen,
  Filter,
  File,
  Image as ImageIcon,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: FolderOpen },
  { id: 'certificate', label: 'Certificates', icon: Award },
  { id: 'marksheet', label: 'Marksheets', icon: GraduationCap },
  { id: 'id', label: 'ID Documents', icon: CreditCard },
  { id: 'other', label: 'Other', icon: FileText },
]

export const EmployeeDocumentManager = () => {
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeUid, setSelectedEmployeeUid] = useState('all')
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Load all employees
  useEffect(() => {
    const fetchEmps = async () => {
      setLoadingEmployees(true)
      try {
        const emps = await getEmployees()
        setEmployees(emps || [])
      } catch (err) {
        console.error('Error fetching employees:', err)
      } finally {
        setLoadingEmployees(false)
      }
    }
    fetchEmps()
  }, [])

  // Listen to documents for selected employee OR all employees
  useEffect(() => {
    setLoadingDocs(true)

    if (selectedEmployeeUid !== 'all') {
      // Single employee listener
      const q = query(
        collection(db, `documents/${selectedEmployeeUid}/files`),
        orderBy('uploadedAt', 'desc')
      )

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const emp = employees.find((e) => e.uid === selectedEmployeeUid)
          const docs = snapshot.docs.map((d) => ({
            id: d.id,
            employeeUid: selectedEmployeeUid,
            employeeName: emp?.displayName || emp?.email || 'Unknown Employee',
            employeeEmail: emp?.email || '',
            employeeDept: emp?.department || emp?.departmentName || '',
            ...d.data(),
          }))
          setDocuments(docs)
          setLoadingDocs(false)
        },
        (err) => {
          console.error('Error fetching employee documents:', err)
          setDocuments([])
          setLoadingDocs(false)
        }
      )

      return () => unsub()
    } else {
      // Fetch across all employees
      if (employees.length === 0 && !loadingEmployees) {
        setDocuments([])
        setLoadingDocs(false)
        return
      }

      const unsubs = []
      const docsByEmployee = {}

      employees.forEach((emp) => {
        if (!emp.uid) return
        const q = query(
          collection(db, `documents/${emp.uid}/files`),
          orderBy('uploadedAt', 'desc')
        )

        const unsub = onSnapshot(
          q,
          (snapshot) => {
            docsByEmployee[emp.uid] = snapshot.docs.map((d) => ({
              id: d.id,
              employeeUid: emp.uid,
              employeeName: emp.displayName || emp.email || 'Unknown Employee',
              employeeEmail: emp.email || '',
              employeeDept: emp.department || emp.departmentName || '',
              ...d.data(),
            }))

            // Merge and sort all documents
            const allDocs = Object.values(docsByEmployee).flat()
            allDocs.sort((a, b) => {
              const timeA = a.uploadedAt?.toMillis?.() || (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0)
              const timeB = b.uploadedAt?.toMillis?.() || (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0)
              return timeB - timeA
            })
            setDocuments([...allDocs])
            setLoadingDocs(false)
          },
          (err) => {
            // Collection might not exist for some employees
            docsByEmployee[emp.uid] = []
            const allDocs = Object.values(docsByEmployee).flat()
            setDocuments([...allDocs])
            setLoadingDocs(false)
          }
        )
        unsubs.push(unsub)
      })

      return () => {
        unsubs.forEach((u) => u())
      }
    }
  }, [selectedEmployeeUid, employees, loadingEmployees])

  const handleDelete = async (docItem) => {
    if (!window.confirm(`Are you sure you want to delete "${docItem.fileName}"?`)) return
    try {
      // Delete Firestore doc
      await deleteDoc(doc(db, `documents/${docItem.employeeUid}/files`, docItem.id))
      // Delete Storage file if path exists
      if (docItem.storagePath) {
        const storageRef = ref(storage, docItem.storagePath)
        await deleteObject(storageRef).catch((err) =>
          console.warn('Storage delete warning:', err)
        )
      }
    } catch (err) {
      console.error('Error deleting document:', err)
      alert('Failed to delete document. Please try again.')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getFileIcon = (fileType = '', fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (fileType.includes('pdf') || ext === 'pdf') {
      return <FileText className="w-5 h-5 text-rose-500" />
    }
    if (fileType.includes('image') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-info" />
    }
    return <File className="w-5 h-5 text-accent" />
  }

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'certificate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <Award className="w-3 h-3" /> Certificate
          </span>
        )
      case 'marksheet':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-info border border-blue-200 dark:border-blue-800">
            <GraduationCap className="w-3 h-3" /> Marksheet
          </span>
        )
      case 'id':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <CreditCard className="w-3 h-3" /> ID Proof
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-canvas text-muted border border-slate-200 dark:border-slate-700">
            <FileText className="w-3 h-3" /> Document
          </span>
        )
    }
  }

  const filteredDocs = documents.filter((docItem) => {
    // Filter by Category
    if (selectedCategory !== 'all' && docItem.category !== selectedCategory) {
      return false
    }
    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = docItem.fileName?.toLowerCase().includes(q)
      const matchEmp = docItem.employeeName?.toLowerCase().includes(q)
      const matchEmail = docItem.employeeEmail?.toLowerCase().includes(q)
      const matchDesc = docItem.description?.toLowerCase().includes(q)
      return matchName || matchEmp || matchEmail || matchDesc
    }
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Documents Vault"
        description="Review, verify, and download certificates, marksheets, and official documents uploaded by employees."
      />

      <TeamSubNav />

      {/* Control Bar: Employee Selector, Search & Category Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Employee Filter */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Filter by Employee
          </label>
          <div className="relative">
            <select
              value={selectedEmployeeUid}
              onChange={(e) => setSelectedEmployeeUid(e.target.value)}
              className="w-full flex h-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            >
              <option value="all">👥 All Employees ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp.uid} value={emp.uid}>
                  {emp.displayName || emp.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Filter */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider">
            Search Documents
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by file name, employee name, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 h-10 rounded-xl border border-border bg-surface text-sm text-fg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = selectedCategory === cat.id
          const count =
            cat.id === 'all'
              ? documents.length
              : documents.filter((d) => d.category === cat.id).length

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-sm shadow-accent/20'
                  : 'bg-surface border border-border text-muted hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-canvas text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Documents List / Table */}
      <Card className="p-0 overflow-hidden border border-border/80">
        {loadingDocs ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-canvas/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
            <FolderOpen className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-fg">
              No documents found
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery
                ? 'No documents match your search criteria.'
                : selectedEmployeeUid !== 'all'
                ? 'This employee has not uploaded any documents yet.'
                : 'No employee documents have been uploaded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-border">
                <tr>
                  <th className="px-5 py-3.5">Document</th>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Size</th>
                  <th className="px-5 py-3.5">Uploaded Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredDocs.map((docItem) => {
                  const uploadedDateStr = docItem.uploadedAt?.toDate
                    ? docItem.uploadedAt.toDate().toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : docItem.uploadedAt
                    ? new Date(docItem.uploadedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Just now'

                  return (
                    <tr
                      key={`${docItem.employeeUid}_${docItem.id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Document Name & Description */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-canvas/70 shrink-0 border border-slate-200 dark:border-slate-700/50">
                            {getFileIcon(docItem.fileType, docItem.fileName)}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <span className="font-semibold text-fg block truncate" title={docItem.fileName}>
                              {docItem.fileName}
                            </span>
                            {docItem.description && (
                              <span className="text-xs text-muted block truncate" title={docItem.description}>
                                {docItem.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Employee Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent-soft flex items-center justify-center text-accent font-bold text-xs shrink-0">
                            {docItem.employeeName?.charAt(0) || 'E'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-xs text-fg block truncate">
                              {docItem.employeeName}
                            </span>
                            {docItem.employeeDept && (
                              <span className="text-[10px] text-muted block truncate">
                                {docItem.employeeDept}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5">
                        {getCategoryBadge(docItem.category)}
                      </td>

                      {/* File Size */}
                      <td className="px-5 py-3.5 text-xs text-muted">
                        {formatFileSize(docItem.fileSize)}
                      </td>

                      {/* Upload Date */}
                      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                        {uploadedDateStr}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {docItem.downloadURL && (
                            <a
                              href={docItem.downloadURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-soft dark:bg-accent/15 text-accent hover:bg-accent-soft transition-colors"
                              title="View / Download Document"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(docItem)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
