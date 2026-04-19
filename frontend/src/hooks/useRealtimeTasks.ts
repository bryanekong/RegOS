import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Task } from '../types';

/**
 * Subscribes to INSERTs on remediation_tasks. The callback is stored in a ref
 * so changing its identity between renders does NOT tear down and resubscribe
 * the channel (which would drop messages during the reconnect window).
 */
export function useRealtimeTasks(onNewTask: (task: Task) => void) {
  const cbRef = useRef(onNewTask);
  cbRef.current = onNewTask;

  useEffect(() => {
    const channel = supabase
      .channel('remediation_tasks_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'remediation_tasks' },
        (payload) => {
          const next = payload.new as Task | undefined;
          if (next && next.task_id) cbRef.current(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
