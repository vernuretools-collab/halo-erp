import { useState, useEffect } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { subscribeAnnouncements } from './services/announcementsService';
import { useUserStore } from '../../stores/userStore';

export const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useUserStore();

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeAnnouncements((data) => {
      setAnnouncements(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredAnnouncements = announcements.filter(a => filter === 'all' || (a.priority || 'info').toLowerCase() === filter.toLowerCase());
  
  const pinnedAnnouncements = filteredAnnouncements.filter(a => a.pinned);
  const regularAnnouncements = filteredAnnouncements.filter(a => !a.pinned);
  
  const displayAnnouncements = [...pinnedAnnouncements, ...regularAnnouncements];

  const getBadgeColor = (priority) => {
    switch((priority || '').toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'info': return 'bg-accent-soft text-accent';
      case 'event': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal?.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString();
    }
    if (dateVal?.seconds) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Stay up to date with company news and events." />
      
      <div className="flex gap-2 border-b border-border pb-4">
        {['all', 'urgent', 'info', 'event'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              filter === f
                ? 'bg-accent text-white'
                : 'bg-chrome text-fg border border-border hover:bg-surface'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
            </Card>
          ))}
        </div>
      ) : displayAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <Megaphone className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No announcements yet. Check back later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayAnnouncements.map(announcement => (
            <Card key={announcement.id} className="p-6 relative">
              {announcement.pinned && (
                <Pin className="absolute top-6 right-6 w-5 h-5 text-accent" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <Badge className={getBadgeColor(announcement.priority)}>
                  {(announcement.priority || 'info').toUpperCase()}
                </Badge>
                {announcement.createdAt && (
                  <span className="text-sm text-muted">
                    {formatDate(announcement.createdAt)}
                  </span>
                )}
                {announcement.author && (
                  <span className="text-sm text-muted">
                    by {announcement.author}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-fg mb-2 pr-8">
                {announcement.title || 'Untitled Announcement'}
              </h3>
              {announcement.body && (
                <p className="text-muted">
                  {announcement.body}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
