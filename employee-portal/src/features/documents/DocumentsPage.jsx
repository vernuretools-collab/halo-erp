import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../../stores/userStore';
import { subscribeMyDocuments, uploadDocument, deleteDocument } from './services/documentsService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/layout/PageHeader';
import { FolderOpen, Upload, FileText, FileImage, FileCode, File, Trash2, Download } from 'lucide-react';

export const DocumentsPage = () => {
  const user = useUserStore(state => state.user);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filterTab, setFilterTab] = useState('All');
  
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeMyDocuments(user.uid, (docs) => {
      setDocuments(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !user?.uid) return;
    setUploading(true);
    setProgress(0);
    try {
      await uploadDocument(user.uid, file, { category, description }, (p) => setProgress(p));
      setFile(null);
      setCategory('other');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (docId, storagePath) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument(user.uid, docId, storagePath);
    } catch (error) {
      console.error('Delete failed', error);
      alert('Delete failed');
    }
  };

  const filteredDocs = filterTab === 'All' ? documents : documents.filter(d => 
    filterTab.toLowerCase() === d.category
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (type?.includes('image')) return <FileImage className="w-8 h-8 text-accent" />;
    if (type?.includes('word') || type?.includes('document')) return <FileCode className="w-8 h-8 text-accent" />;
    return <File className="w-8 h-8 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Documents" description="Manage your certificates, marksheets, and IDs." />
      
      <Card className="p-6">
        <h3 className="text-lg font-medium text-fg mb-4">Upload Document</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-fg mb-1">File</label>
            <input 
              type="file" 
              onChange={handleFileChange} 
              ref={fileInputRef}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-accent-soft file:text-accent hover:file:bg-accent-soft dark:file:text-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="certificate">Certificate</option>
              <option value="marksheet">Marksheet</option>
              <option value="id">ID</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Description (Optional)</label>
            <Input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="E.g., B.Tech Degree" 
            />
          </div>
          <div>
            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading} 
              className="w-full flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
        {uploading && (
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div className="bg-accent h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </Card>


      <div className="flex gap-2 overflow-x-auto pb-2">
        {['All', 'Certificate', 'Marksheet', 'ID', 'Other'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              filterTab === tab
                ? 'bg-accent text-white'
                : 'bg-chrome text-fg border border-border hover:bg-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center text-muted">
          <FolderOpen className="w-12 h-12 mb-4 text-slate-400 dark:text-slate-500" />
          <p className="text-lg font-medium text-fg mb-1">No documents uploaded yet.</p>
          <p>Upload your certificates, marksheets, or ID documents.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <Card key={doc.id} className="p-5 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-4 flex-1">
                <div className="shrink-0 p-2 bg-chrome rounded-lg">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-fg truncate" title={doc.fileName}>
                    {doc.fileName}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize text-xs">{doc.category}</Badge>
                    <span className="text-xs text-muted">{formatFileSize(doc.fileSize)}</span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted mt-2 line-clamp-2">{doc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-muted">
                  {doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toLocaleDateString() : 'Just now'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(doc.downloadURL, '_blank')} className="px-2">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(doc.id, doc.storagePath)} className="px-2 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
