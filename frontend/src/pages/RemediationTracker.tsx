import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { format } from 'date-fns';
import { Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchTasks, updateTask } from '../api/client';
import { Task } from '../types';
import SeverityBadge from '../components/SeverityBadge';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';
import { useToast } from '../components/Toast';

const COLUMNS = [
  {
    id: 'open' as const,
    label: 'Open',
    emptyIcon: '📋',
    emptyText: 'No open tasks',
    headerClass: 'text-blue-700 bg-blue-50 border border-blue-200',
    columnClass: 'bg-blue-50/30',
    tabActiveClass: 'bg-blue-900 text-white border-blue-900',
  },
  {
    id: 'in_progress' as const,
    label: 'In Progress',
    emptyIcon: '⚙️',
    emptyText: 'Nothing in progress',
    headerClass: 'text-amber-700 bg-amber-50 border border-amber-200',
    columnClass: 'bg-amber-50/30',
    tabActiveClass: 'bg-amber-600 text-white border-amber-600',
  },
  {
    id: 'done' as const,
    label: 'Done',
    emptyIcon: '✅',
    emptyText: 'No completed tasks yet',
    headerClass: 'text-green-700 bg-green-50 border border-green-200',
    columnClass: 'bg-green-50/30',
    tabActiveClass: 'bg-green-700 text-white border-green-700',
  },
] as const;

const CHANGE_TYPE_LABELS: Record<string, string> = {
  NEW_REQUIREMENT: 'New Req.',
  AMENDED_REQUIREMENT: 'Amended',
  DEADLINE_CHANGE: 'Deadline',
};

export default function RemediationTracker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchTasks(),
  });

  useRealtimeTasks(newTask => {
    queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) => {
      const exists = (oldTasks || []).find(t => t.task_id === newTask.task_id);
      if (exists) {
        return (oldTasks || []).map(t => (t.task_id === newTask.task_id ? newTask : t));
      }
      toast('New remediation task received', 'info');
      return [newTask, ...(oldTasks || [])];
    });
  });

  const filteredTasks = useMemo(() => {
    if (severityFilter === 'All') return tasks;
    return tasks.filter(t => t.severity === severityFilter);
  }, [tasks, severityFilter]);

  const columns = useMemo(
    () => ({
      open: filteredTasks.filter(t => t.status === 'open'),
      in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
      done: filteredTasks.filter(t => t.status === 'done'),
    }),
    [filteredTasks]
  );

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;
    const taskId = result.draggableId;
    if (sourceCol === destCol && result.source.index === result.destination.index) return;

    queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) =>
      (oldTasks || []).map(t => (t.task_id === taskId ? { ...t, status: destCol } : t))
    );

    try {
      await updateTask(taskId, { status: destCol });
    } catch {
      toast('Failed to update task status', 'error');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const totalTasks = tasks.length;
  const activeCol = COLUMNS[activeTab];
  const activeColTasks = columns[activeCol.id];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Remediation Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">
            {totalTasks > 0
              ? `${totalTasks} task${totalTasks !== 1 ? 's' : ''} across all stages`
              : 'Manage policy updates prompted by regulatory change.'}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                severityFilter === sev
                  ? 'bg-blue-900 text-white border-blue-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {sev === 'All' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: tab switcher ── */}
      <div className="md:hidden shrink-0 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(prev => (Math.max(0, prev - 1) as 0 | 1 | 2))}
            disabled={activeTab === 0}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
            aria-label="Previous column"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 flex gap-1.5">
            {COLUMNS.map((col, i) => {
              const count = columns[col.id].length;
              const isActive = activeTab === i;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveTab(i as 0 | 1 | 2)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    isActive ? col.tabActiveClass : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {col.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setActiveTab(prev => (Math.min(2, prev + 1) as 0 | 1 | 2))}
            disabled={activeTab === 2}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
            aria-label="Next column"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile single column — no drag on mobile */}
        <div className={`mt-3 rounded-xl border border-gray-200 overflow-hidden flex-1 ${activeCol.columnClass}`}>
          <div className="p-3 space-y-2 max-h-[calc(100vh-18rem)] overflow-y-auto">
            {activeColTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <span className="text-2xl mb-2">{activeCol.emptyIcon}</span>
                <p className="text-xs text-gray-400 font-medium">{activeCol.emptyText}</p>
              </div>
            ) : (
              activeColTasks.map(task => (
                <MobileTaskCard key={task.task_id} task={task} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop: full kanban with drag-and-drop ── */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="hidden md:flex flex-1 gap-5 overflow-hidden">
          {COLUMNS.map(col => {
            const colTasks = columns[col.id];
            return (
              <div
                key={col.id}
                className={`flex-1 flex flex-col rounded-xl border border-gray-200 overflow-hidden ${col.columnClass}`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md ${col.headerClass}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {colTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <span className="text-2xl mb-2">{col.emptyIcon}</span>
                          <p className="text-xs text-gray-400 font-medium">{col.emptyText}</p>
                        </div>
                      ) : (
                        colTasks.map((task, index) => (
                          <TaskCard key={task.task_id} task={task} index={index} />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

/* ── Owner editor (shared) ── */
function OwnerEditor({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.owner || 'Compliance Team');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === task.owner) { setEditing(false); return; }
    try {
      await updateTask(task.task_id, { owner: trimmed });
      queryClient.setQueryData(['tasks'], (old: Task[] | undefined) =>
        (old || []).map(t => (t.task_id === task.task_id ? { ...t, owner: trimmed } : t))
      );
      toast('Owner updated', 'success');
    } catch {
      toast('Failed to update owner', 'error');
      setValue(task.owner || 'Compliance Team');
    }
    setEditing(false);
  };

  const cancel = () => { setValue(task.owner || 'Compliance Team'); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className="text-xs border border-blue-400 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={save} className="text-green-600 hover:text-green-800" aria-label="Save owner">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors group/owner"
      title="Click to reassign owner"
    >
      <span className="truncate max-w-[80px]">{task.owner || 'Unassigned'}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover/owner:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

/* ── Mobile task card (no drag handle) ── */
function MobileTaskCard({ task }: { task: Task }) {
  const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;
  const changeLabel = CHANGE_TYPE_LABELS[task.change_type] ?? task.change_type;

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <SeverityBadge severity={task.severity || 'LOW'} />
        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-semibold">
          {changeLabel}
        </span>
      </div>
      <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{task.action_text}</p>
      <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-gray-50">
        <OwnerEditor task={task} />
        {task.deadline && (
          <span className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
            {isOverdue && '⚠ '}
            {format(new Date(task.deadline), 'dd MMM yyyy')}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Desktop draggable task card ── */
function TaskCard({ task, index }: { task: Task; index: number }) {
  const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false;
  const changeLabel = CHANGE_TYPE_LABELS[task.change_type] ?? task.change_type;

  return (
    <Draggable draggableId={task.task_id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg mb-2.5 border transition-shadow ${
            snapshot.isDragging
              ? 'shadow-lg border-blue-300 rotate-1'
              : 'shadow-sm border-gray-100 hover:shadow-md'
          }`}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <SeverityBadge severity={task.severity || 'LOW'} />
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                {changeLabel}
              </span>
            </div>
            <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{task.action_text}</p>
            <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-gray-50">
              <OwnerEditor task={task} />
              {task.deadline && (
                <span
                  className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}
                  title={isOverdue ? 'Overdue' : undefined}
                >
                  {isOverdue && '⚠ '}
                  {format(new Date(task.deadline), 'dd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
