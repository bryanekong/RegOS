import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { format } from 'date-fns';
import { fetchTasks, updateTask } from '../api/client';
import { Task } from '../types';
import SeverityBadge from '../components/SeverityBadge';
import { useRealtimeTasks } from '../hooks/useRealtimeTasks';

export default function RemediationTracker() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('All');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchTasks()
  });

  useRealtimeTasks((newTask) => {
    queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) => {
      const isExisting = (oldTasks || []).find(t => t.task_id === newTask.task_id);
      if (isExisting) {
        return (oldTasks || []).map(t => t.task_id === newTask.task_id ? newTask : t);
      }
      return [newTask, ...(oldTasks || [])];
    });
  });

  const filteredTasks = useMemo(() => {
    if (severityFilter === 'All') return tasks;
    return tasks.filter(t => t.severity === severityFilter);
  }, [tasks, severityFilter]);

  const columns = {
    open: filteredTasks.filter(t => t.status === 'open'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    done: filteredTasks.filter(t => t.status === 'done')
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;
    const taskId = result.draggableId;
    
    if (sourceCol === destCol && result.source.index === result.destination.index) return;
    
    queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) => {
      return (oldTasks || []).map(t => {
        if (t.task_id === taskId) {
          return { ...t, status: destCol };
        }
        return t;
      });
    });

    try {
      await updateTask(taskId, { status: destCol });
    } catch (e) {
      console.error('Failed to update task status', e);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Remediation Tracker</h1>
          <p className="text-gray-600 mt-2">Manage policy updates prompted by regulatory change.</p>
        </div>
        <div className="flex space-x-2">
          {['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 text-sm rounded ${severityFilter === sev ? 'bg-blue-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-1 space-x-6 overflow-hidden">
          {(['open', 'in_progress', 'done'] as const).map(colId => (
            <div key={colId} className="flex-1 flex flex-col bg-gray-100/50 rounded-lg p-4 max-h-full">
              <h2 className="font-semibold text-gray-700 mb-4 uppercase text-sm px-2">
                {colId.replace('_', ' ')} <span className="text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 text-xs ml-2">{columns[colId].length}</span>
              </h2>
              <Droppable droppableId={colId}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 overflow-y-auto min-h-[150px]"
                  >
                    {columns[colId].map((task, index) => (
                      <Draggable key={task.task_id} draggableId={task.task_id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-white shadow-sm hover:shadow rounded-lg p-3 mb-3 border border-gray-100"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <SeverityBadge severity={task.severity || 'LOW'} />
                              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-medium">
                                {(task.change_type || '').replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 line-clamp-2 mt-2 leading-snug">
                              {task.action_text}
                            </p>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                              <span className="text-xs text-gray-500 font-medium">
                                {task.section_title}
                              </span>
                              <span className={`text-xs font-semibold ${new Date(task.deadline || '') < new Date() ? 'text-red-600' : 'text-gray-500'}`}>
                                {task.deadline ? format(new Date(task.deadline), 'dd MMM yyyy') : ''}
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
