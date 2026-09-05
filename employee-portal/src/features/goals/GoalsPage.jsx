import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, X, Trash2, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/layout/PageHeader';
import { useUserStore } from '../../stores/userStore';
import { subscribeMyGoals, addGoal, updateGoalProgress, deleteGoal } from './services/goalsService';

export const GoalsPage = () => {
  const user = useUserStore(state => state.user);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('career');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = subscribeMyGoals(user.uid, (data) => {
        setGoals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !user?.uid) return;
    
    setIsSubmitting(true);
    try {
      await addGoal(user.uid, {
        title,
        description,
        category,
        targetDate,
        progress: 0,
        status: 'active'
      });
      setIsFormOpen(false);
      setTitle('');
      setDescription('');
      setCategory('career');
      setTargetDate('');
    } catch (error) {
      console.error("Error adding goal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProgress = async (goalId, newProgress) => {
     let newStatus = 'active';
     if (newProgress === 100) newStatus = 'completed';
     await updateGoalProgress(user.uid, goalId, newProgress, newStatus);
  };

  const handleDelete = async (goalId) => {
     if(window.confirm('Are you sure you want to delete this goal?')) {
        await deleteGoal(user.uid, goalId);
     }
  };

  const filteredGoals = goals.filter(goal => {
    const statusMatch = filter === 'All' || goal.status === filter.toLowerCase();
    const categoryMatch = categoryFilter === 'All' || goal.category === categoryFilter.toLowerCase();
    return statusMatch && categoryMatch;
  });

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const inProgressGoals = goals.filter(g => g.status === 'active').length;

  const categoryColors = {
    career: 'bg-accent-soft text-accent',
    skill: 'bg-accent-soft text-accent',
    health: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
  };

  const statusColors = {
    active: 'bg-accent-soft text-accent',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  };

  return (
    <div className="flex flex-col h-full relative">
      <PageHeader 
        title="My Goals" 
        description="Track your personal and professional growth"
        actions={<Button onClick={() => setIsFormOpen(true)} className="bg-accent hover:bg-accent-hover text-white"><Plus className="w-4 h-4 mr-2"/> Add Goal</Button>}
      />

      <div className="p-6 flex-1 overflow-auto">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-4 flex flex-col justify-center items-center">
            <span className="text-sm text-muted">Total Goals</span>
            <span className="text-2xl font-bold text-fg">{totalGoals}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-center items-center">
            <span className="text-sm text-muted">In Progress</span>
            <span className="text-2xl font-bold text-accent">{inProgressGoals}</span>
          </Card>
          <Card className="p-4 flex flex-col justify-center items-center">
            <span className="text-sm text-muted">Completed</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedGoals}</span>
          </Card>
        </div>

        <div className="flex gap-4 mb-6">
          <select 
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm outline-none"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Paused">Paused</option>
          </select>
          <select 
            className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm outline-none"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Career">Career</option>
            <option value="Skill">Skill</option>
            <option value="Health">Health</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : filteredGoals.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-24 text-center">
             <div className="bg-accent-soft p-4 rounded-full mb-4">
               <Target className="w-8 h-8 text-accent" />
             </div>
             <h3 className="text-lg font-medium text-fg mb-1">No goals found</h3>
             <p className="text-muted mb-4">Set your first goal to track your growth.</p>
             <Button onClick={() => setIsFormOpen(true)} className="bg-accent hover:bg-accent-hover text-white text-xs px-4 py-2 flex items-center gap-1.5">
               <Plus className="w-3.5 h-3.5" /> Add Goal
             </Button>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredGoals.map(goal => (
               <GoalCard 
                 key={goal.id} 
                 goal={goal} 
                 onUpdateProgress={handleUpdateProgress} 
                 onDelete={handleDelete} 
                 categoryColors={categoryColors} 
                 statusColors={statusColors}
               />
             ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="absolute inset-0 z-50 flex justify-end bg-black/20 dark:bg-black/40 backdrop-blur-sm">
           <div className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-border transform transition-transform">
             <div className="p-6 flex justify-between items-center border-b border-border">
               <h2 className="text-lg font-semibold text-fg">Add New Goal</h2>
               <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                 <X className="w-5 h-5" />
               </button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
               <div>
                 <label className="block text-sm font-medium text-fg mb-1">Title <span className="text-red-500">*</span></label>
                 <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Learn React Native" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-fg mb-1">Description</label>
                 <textarea 
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px]"
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief details about your goal..."
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-fg mb-1">Category</label>
                   <select 
                     className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                     value={category}
                     onChange={e => setCategory(e.target.value)}
                   >
                     <option value="career">Career</option>
                     <option value="skill">Skill</option>
                     <option value="health">Health</option>
                     <option value="other">Other</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-fg mb-1">Target Date</label>
                   <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                 </div>
               </div>
               
               <div className="mt-auto pt-6 flex gap-3">
                 <Button type="button" variant="outline" className="flex-1" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                 <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Goal'}</Button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
};

const GoalCard = ({ goal, onUpdateProgress, onDelete, categoryColors, statusColors }) => {
  const [progress, setProgress] = useState(goal.progress || 0);
  const debounceRef = useRef(null);

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setProgress(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateProgress(goal.id, val);
    }, 500);
  };

  useEffect(() => {
    setProgress(goal.progress || 0);
  }, [goal.progress]);

  return (
    <Card className="p-5 flex flex-col relative group">
       <button onClick={() => onDelete(goal.id)} className="absolute top-4 right-4 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
         <Trash2 className="w-4 h-4" />
       </button>
       <div className="flex gap-2 items-center mb-3">
         <Badge className={`${categoryColors[goal.category] || categoryColors.other} border-none capitalize`}>{goal.category}</Badge>
         <Badge className={`${statusColors[goal.status] || statusColors.active} border-none capitalize`}>{goal.status}</Badge>
       </div>
       <h4 className="font-semibold text-fg mb-1 truncate pr-6">{goal.title}</h4>
       <p className="text-sm text-muted line-clamp-2 mb-4 flex-1">{goal.description}</p>
       
       <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
         <Calendar className="w-3.5 h-3.5" />
         <span>{goal.targetDate || 'No date set'}</span>
       </div>

       <div>
         <div className="flex justify-between text-xs font-medium text-fg mb-2">
           <span>Progress</span>
           <span>{progress}%</span>
         </div>
         <input 
           type="range" 
           min="0" 
           max="100" 
           value={progress}
           onChange={handleSliderChange}
           className="w-full accent-accent h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
         />
       </div>
    </Card>
  );
};
