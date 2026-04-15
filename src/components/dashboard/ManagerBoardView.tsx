"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Calendar, Clock } from 'lucide-react';
import { Task, Subtask, Profile } from '@/app/actions/actions';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Card, Badge, Button } from '@/components/ui/components';
import { cn } from '@/lib/utils';

// --- SUB-COMPONENTS ---

interface MorningBriefingProps {
  userName: string;
  tasks: Task[];
}

function MorningBriefing({ userName, tasks }: MorningBriefingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const highPriorityTasks = tasks.filter(t => (t.priority === 'Urgent' || t.priority === 'High') && t.status !== 'Completed');
  
  return (
    <Card glass className="p-5 mb-4 overflow-hidden relative group border-none">
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#0c64ef] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">✨</span>
          <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.3em]">Command Center Briefing</h4>
        </div>
        
        <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight mb-2">
          {mounted ? (new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening') : '...'}, <span className="text-[#0c64ef]">{userName.split(' ')[0]}</span>.
        </h1>
        
        <p className="text-sm font-bold text-[#86868b] max-w-2xl leading-relaxed">
          Today is {mounted ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '...'}. 
          {highPriorityTasks.length > 0 
            ? ` You have ${highPriorityTasks.length} critical items requiring your immediate attention today.` 
            : " Your workspace is currently in perfect order. Excellent work."}
        </p>
        
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="bg-white/50 backdrop-blur-md border border-white/40 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b30] animate-pulse" />
            <span className="text-[9px] font-black text-[#1d1d1f] uppercase tracking-widest">{highPriorityTasks.length} Critical Tasks</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface BoardColumnProps {
  title: string;
  tasks: Task[];
  subtasksMap: Record<string, Subtask[]>;
  commentCounts: Record<string, number>;
  attachmentCounts: Record<string, number>;
  employees: Profile[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string, taskName: string) => void;
  formatTaskDate: (dateStr: string) => { label: string, color: string } | null;
  isOverdue: (t: Task) => boolean;
}

function BoardColumn({ 
  title, 
  tasks, 
  subtasksMap, 
  commentCounts, 
  attachmentCounts, 
  employees, 
  onTaskClick, 
  onDeleteTask,
  formatTaskDate,
  isOverdue
}: BoardColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[280px] flex-shrink-0">
      <div className="flex items-center justify-between px-3 mb-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]",
            title.toUpperCase().includes('OVERDUE') ? 'text-[#ff3b30] bg-[#ff3b30]' : 
            title.toUpperCase().includes('TO DO') ? 'text-[#0c64ef] bg-[#0c64ef]' : 
            title.toUpperCase().includes('IN PROGRESS') ? 'text-[#ff9500] bg-[#ff9500]' : 
            title.toUpperCase().includes('BLOCKED') ? 'text-[#ff3b30] bg-[#ff3b30]' : 'text-[#34c759] bg-[#34c759]'
          )} />
          <h3 className="text-[11px] font-black text-[#1d1d1f] tracking-[0.15em] uppercase">{title}</h3>
        </div>
        <span className="px-3 py-1 rounded-xl bg-white border border-[#f0f0f2] shadow-sm text-[10px] font-black text-[#1d1d1f] tabular-nums">
          {tasks.length}
        </span>
      </div>
      
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-10">
        {tasks.length === 0 ? (
          <div className="h-24 border border-dashed border-[#e5e5ea] rounded-3xl flex items-center justify-center">
            <span className="text-[9px] font-black text-[#86868b] uppercase tracking-widest opacity-40">Empty Queue</span>
          </div>
        ) : (
          tasks.map((task) => {
            const employee = employees.find(e => e.id === task.employee_id);
            const subtasks = subtasksMap[task.id] || [];
            const completedSubtasks = subtasks.filter(s => s.is_completed).length;
            let progress = 0;
            if (task.status === 'Completed') {
              progress = 100;
            } else if (subtasks.length > 0) {
              const totalWeight = subtasks.reduce((sum, s) => sum + (s.weight || s.estimated_hours || 1), 0);
              const completedWeight = subtasks.reduce((sum, s) => sum + (s.is_completed ? (s.weight || s.estimated_hours || 1) : 0), 0);
              progress = Math.round((completedWeight / totalWeight) * 100);
              if (progress === 100) progress = 95;
            } else {
              switch (task.status) {
                case 'In Review': progress = 85; break;
                case 'In Progress': progress = 50; break;
                case 'Blocked': progress = 15; break;
                default: progress = 0;
              }
            }
            const dateInfo = task.deadline ? formatTaskDate(task.deadline) : null;
            const isOverdueTask = isOverdue(task);
            const totalHours = subtasks.reduce((sum, s) => sum + (Number(s.hours_spent) || 0), 0);
            
            return (
              <motion.div
                key={task.id}
                layoutId={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onTaskClick(task)}
                className="group relative bg-white rounded-3xl p-5 border border-[#eceef0] shadow-sm hover:shadow-xl hover:shadow-[#0c64ef]/5 hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#0c64ef]/[0.02] rounded-full -mr-10 -mt-10 group-hover:bg-[#0c64ef]/[0.05] transition-colors" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <Badge className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-lg border-none",
                      task.priority === 'Urgent' ? 'bg-[#ff3b30] text-white shadow-lg shadow-[#ff3b30]/20' : 
                      task.priority === 'High' ? 'bg-[#ff9500] text-white' : 
                      task.priority === 'Medium' ? 'bg-[#0c64ef] text-white' : 'bg-[#34c759] text-white'
                    )}>
                      {task.priority.toUpperCase()}
                    </Badge>
                    {isOverdueTask && (
                      <Badge className="bg-[#ff3b30] text-white text-[8px] font-black px-2 py-0.5 rounded-lg border-none shadow-lg shadow-[#ff3b30]/20 animate-pulse">
                        OVERDUE
                      </Badge>
                    )}
                  </div>

                  <h4 className="text-sm font-black text-[#1d1d1f] mb-2 leading-tight group-hover:text-[#0c64ef] transition-colors line-clamp-2">{task.name}</h4>
                  
                  {task.notes && (
                    <p className="text-[10px] font-bold text-[#86868b] line-clamp-2 mb-4 leading-relaxed group-hover:text-[#424245]">
                      {task.notes}
                    </p>
                  )}

                  <div className="space-y-4">
                    {(subtasks.length > 0 || progress > 0) && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black text-[#86868b] uppercase tracking-widest">
                          <span>Progression</span>
                          <span className="text-[#0c64ef] tabular-nums">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 w-full bg-[#f5f5f7] rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-[#0c64ef] to-[#4096ee] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).slice(0, 3).map((id, index) => {
                          const emp = employees.find(e => e.id === id);
                          return (
                            <div key={`${task.id}-${id}`} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] p-[1.5px] border-2 border-white shadow-sm" style={{ zIndex: 10 - index }}>
                              <UserAvatar
                                name={emp?.name || '?'}
                                avatarUrl={emp?.avatar_url}
                                className="w-full h-full rounded-full bg-white text-[#1d1d1f]"
                                textClassName="text-[8px] font-black uppercase"
                              />
                            </div>
                          );
                        })}
                        {Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] p-[1.5px] border-2 border-white shadow-sm" style={{ zIndex: 0 }}>
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-[8px] font-black uppercase text-[#1d1d1f]">
                              +{Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).length - 3}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {totalHours > 0 && (
                          <div className="flex items-center gap-1.5 text-[#86868b]">
                            <span className="text-[10px]">⏱️</span>
                            <span className="text-[9px] font-black tabular-nums">{Math.round(totalHours * 10) / 10}h</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[#86868b]">
                          <span className="text-[10px]">💬</span>
                          <span className="text-[9px] font-black tabular-nums">{commentCounts[task.id] || 0}</span>
                        </div>
                        {(attachmentCounts[task.id] || 0) > 0 && (
                          <div className="flex items-center gap-1.5 text-[#86868b]">
                            <span className="text-[10px]">📎</span>
                            <span className="text-[9px] font-black tabular-nums">{attachmentCounts[task.id]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#f5f5f7] pt-3">
                      <div className="flex items-center gap-2">
                        {dateInfo ? (
                          <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-lg",
                            dateInfo.color === 'red' ? 'bg-[#fff2f2] text-[#ff3b30]' : 'bg-[#f5f5f7] text-[#86868b]'
                          )}>
                            <Clock size={10} strokeWidth={3} />
                            <span className="text-[8px] font-black uppercase tracking-wider">{dateInfo.label}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#f5f5f7] text-[#86868b]">
                            <Calendar size={10} strokeWidth={3} />
                            <span className="text-[8px] font-black uppercase tracking-wider">No Deadline</span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task.id, task.name);
                        }}
                        className="p-1.5 hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- MAIN EXPORT ---

interface ManagerBoardViewProps {
  userName: string;
  tasks: Task[];
  employees: Profile[];
  subtasksMap: Record<string, Subtask[]>;
  commentCounts: Record<string, number>;
  attachmentCounts: Record<string, number>;
  boardStats: { total: number, completed: number };
  heatmapData: { active: Task[], overdue: Task[] };
  searchQuery: string;
  handleTaskClick: (task: Task) => void;
  handleDeleteTask: (taskId: string, taskName: string) => void;
  formatTaskDate: (dateStr: string) => { label: string, color: string } | null;
}

export function ManagerBoardView({
  userName,
  tasks,
  employees,
  subtasksMap,
  commentCounts,
  attachmentCounts,
  boardStats,
  heatmapData,
  searchQuery,
  handleTaskClick,
  handleDeleteTask,
  formatTaskDate
}: ManagerBoardViewProps) {
  const isOverdue = (t: Task) => !!(t.status === 'Overdue' || (t.deadline && new Date(t.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && t.status !== 'Completed'));

  return (
    <div className="space-y-6">
      <MorningBriefing userName={userName} tasks={tasks} />
      
      {/* Stats Row — Now at top & wider rectangles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        <Card className="p-6 rounded-[24px] bg-white border-[#eceef0] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-[#86868b] tracking-widest uppercase">Efficiency</h3>
            <Badge variant="secondary" className="bg-[#f0f0f2] text-[#1d1d1f] font-bold text-[8px]">2026</Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-around gap-8">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="stroke-[#f0f0f2] stroke-[10] fill-none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className="stroke-[#0c64ef] stroke-[10] fill-none transition-all duration-1000 ease-out"
                  style={{ 
                    strokeDasharray: '352',
                    strokeDashoffset: 352 - (352 * (boardStats.completed / (boardStats.total || 1)))
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#1d1d1f]">{Math.round((boardStats.completed / (boardStats.total || 1)) * 100)}%</span>
                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Done</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm">
              <div className="p-4 bg-[#f5f5f7] rounded-3xl border border-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#0c64ef]"></div>
                  <span className="text-[9px] font-black text-[#86868b] tracking-wider uppercase">Total Assigned</span>
                </div>
                <p className="text-2xl font-black text-[#1d1d1f]">{boardStats.total}</p>
                <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tighter mt-1 opacity-60">Across all projects</p>
              </div>
              <div className="p-4 bg-[#f5f5f7] rounded-3xl border border-white/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#34c759]"></div>
                  <span className="text-[9px] font-black text-[#86868b] tracking-wider uppercase">Completed</span>
                </div>
                <p className="text-2xl font-black text-[#1d1d1f]">{boardStats.completed}</p>
                <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tighter mt-1 opacity-60">Verified & Finished</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-[24px] bg-white border-[#eceef0] shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-[#86868b] tracking-widest uppercase">Hotspots</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b30] animate-pulse"></div>
          </div>
          <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider mb-4 opacity-50">Critical Signals · Real-time</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-3 bg-[#fff2f2] rounded-xl border border-[#ff3b30]/10">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-[#ff3b30] uppercase tracking-widest">Overdue</span>
                  <span className="text-base font-black text-[#ff3b30]">{heatmapData.overdue.length}</span>
                </div>
                <div className="h-1 w-full bg-[#ff3b30]/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#ff3b30] rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (heatmapData.overdue.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest">High/Urgent</span>
                  <span className="text-base font-black text-[#1d1d1f]">{heatmapData.active.length}</span>
                </div>
                <div className="h-1 w-full bg-[#e5e5ea] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1d1d1f] rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (heatmapData.active.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-2 opacity-40">Immediate Attention</p>
              {heatmapData.overdue.slice(0, 2).map(t => (
                <div 
                  key={t.id} 
                  onClick={() => handleTaskClick(t)}
                  className="group cursor-pointer p-2.5 bg-[#fff2f2]/50 hover:bg-[#fff2f2] rounded-lg border border-[#ff3b30]/5 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-[#ff3b30] uppercase tracking-tight line-clamp-1 flex-1">{t.name}</span>
                    <Badge className="bg-[#ff3b30] text-white text-[7px] font-black px-1 rounded ml-2">OVERDUE</Badge>
                  </div>
                </div>
              ))}
              {heatmapData.active.slice(0, 2).map(t => (
                <div 
                  key={t.id} 
                  onClick={() => handleTaskClick(t)}
                  className="group cursor-pointer p-2.5 bg-[#f5f5f7]/50 hover:bg-[#f5f5f7] rounded-lg border border-[#e5e5ea]/50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-tight line-clamp-1 flex-1">{t.name}</span>
                    <Badge className="bg-[#1d1d1f] text-white text-[7px] font-black px-1 rounded ml-2">{t.priority}</Badge>
                  </div>
                </div>
              ))}
              {(heatmapData.overdue.length > 2 || heatmapData.active.length > 2) && (
                <p className="text-[7px] font-bold text-center text-[#86868b] mt-1 tracking-widest uppercase opacity-40">+{heatmapData.overdue.length + heatmapData.active.length - 4} More</p>
              )}
            </div>
          </div>
        </Card>
      </div>
      
      {/* Board View — horizontally scrollable */}
      <div className="overflow-x-auto pb-4 custom-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-5 min-w-max pb-2">
          <BoardColumn 
            title="OVERDUE" 
            tasks={tasks.filter(t => isOverdue(t) && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
          <BoardColumn 
            title="TO DO" 
            tasks={tasks.filter(t => t.status === 'To Do' && !isOverdue(t) && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
          <BoardColumn 
            title="IN PROGRESS" 
            tasks={tasks.filter(t => t.status === 'In Progress' && !isOverdue(t) && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
          <BoardColumn 
            title="IN REVIEW" 
            tasks={tasks.filter(t => t.status === 'In Review' && !isOverdue(t) && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
          <BoardColumn 
            title="BLOCKED" 
            tasks={tasks.filter(t => t.status === 'Blocked' && !isOverdue(t) && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
          <BoardColumn 
            title="COMPLETED" 
            tasks={tasks.filter(t => t.status === 'Completed' && (
              t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ))} 
            subtasksMap={subtasksMap} 
            commentCounts={commentCounts} 
            attachmentCounts={attachmentCounts} 
            employees={employees} 
            onTaskClick={handleTaskClick} 
            onDeleteTask={handleDeleteTask} 
            formatTaskDate={formatTaskDate}
            isOverdue={isOverdue}
          />
        </div>
      </div>
    </div>
  );
}
