import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { subscribeCalendarEvents } from './services/calendarService';
import { useUserStore } from '../../stores/userStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENT_COLORS = {
  holiday: 'bg-red-500',
  meeting: 'bg-accent',
  sprint: 'bg-accent',
  anniversary: 'bg-amber-500',
  leave: 'bg-emerald-500',
};

const EVENT_BADGE_COLORS = {
  holiday: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  meeting: 'bg-accent-soft text-accent',
  sprint: 'bg-accent-soft text-accent',
  anniversary: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  leave: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export const CompanyCalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUserStore();

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeCalendarEvents((data) => {
      setEvents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0, Sunday is 6
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const selectedDateEvents = events.filter(e => e.date === selectedDate);

  const renderCells = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="p-2 border border-transparent h-24"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isSelected = selectedDate === dateStr;
      
      cells.push(
        <div 
          key={i} 
          onClick={() => setSelectedDate(dateStr)}
          className={`p-2 border border-border h-24 cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-accent-soft border-accent' 
              : 'hover:bg-chrome/50'
          }`}
        >
          <div className="font-medium text-sm text-fg">{i}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {dayEvents.map(e => (
              <div 
                key={e.id} 
                className={`w-2 h-2 rounded-full ${EVENT_COLORS[e.type] || 'bg-slate-500'}`}
                title={e.title}
              />
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Company Calendar" description="View company holidays, events, and meetings." />

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-fg">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-chrome text-muted cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-chrome text-muted cursor-pointer">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse h-[500px] bg-chrome/50 rounded-lg"></div>
          ) : (
            <div className="grid grid-cols-7 border-t border-l border-border">
              {DAYS.map(day => (
                <div key={day} className="p-2 border-r border-b border-border font-semibold text-center text-sm text-muted">
                  {day}
                </div>
              ))}
              {renderCells()}
            </div>
          )}
        </Card>

        <Card className="w-full lg:w-80 p-6 h-fit shrink-0">
          <h3 className="text-lg font-bold text-fg mb-4">
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          
          {loading ? (
            <div className="space-y-4">
              <div className="h-16 bg-chrome rounded animate-pulse"></div>
              <div className="h-16 bg-chrome rounded animate-pulse"></div>
            </div>
          ) : selectedDateEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted text-center">
              <CalendarIcon className="w-10 h-10 mb-3 opacity-30" />
              <p>No events scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDateEvents.map(event => (
                <div key={event.id} className="p-3 rounded-lg border border-border bg-chrome">
                  <Badge className={`mb-2 ${EVENT_BADGE_COLORS[event.type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {(event.type || 'event').charAt(0).toUpperCase() + (event.type || 'event').slice(1)}
                  </Badge>
                  <h4 className="font-semibold text-fg">{event.title}</h4>
                  {event.description && <p className="text-sm text-muted mt-1">{event.description}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
