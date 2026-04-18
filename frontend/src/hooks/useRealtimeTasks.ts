import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Task } from '../types';

export function useRealtimeTasks(onNewTask: (task: Task) => void) {
  useEffect(() => {
    const channel = supabase
      .channel('remediation_tasks_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'remediation_tasks' },
        (payload) => onNewTask(payload.new as Task)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewTask]);
}
