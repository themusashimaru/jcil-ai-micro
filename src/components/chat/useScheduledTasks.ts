import { useState, useCallback, useEffect } from 'react';
import type { ScheduledTask } from './ChatSidebarScheduledTasks';

export function useScheduledTasks() {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);

  const fetchScheduledTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/scheduled-tasks');
      if (response.ok) {
        const data = await response.json();
        setScheduledTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('[useScheduledTasks] Error fetching:', error);
    }
  }, []);

  const handlePauseTask = useCallback(
    async (taskId: string) => {
      try {
        await fetch('/api/scheduled-tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, status: 'paused' }),
        });
        fetchScheduledTasks();
      } catch (error) {
        console.error('[useScheduledTasks] Error pausing:', error);
      }
    },
    [fetchScheduledTasks]
  );

  const handleResumeTask = useCallback(
    async (taskId: string) => {
      try {
        await fetch('/api/scheduled-tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, status: 'pending' }),
        });
        fetchScheduledTasks();
      } catch (error) {
        console.error('[useScheduledTasks] Error resuming:', error);
      }
    },
    [fetchScheduledTasks]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await fetch(`/api/scheduled-tasks?id=${taskId}`, { method: 'DELETE' });
        fetchScheduledTasks();
      } catch (error) {
        console.error('[useScheduledTasks] Error deleting:', error);
      }
    },
    [fetchScheduledTasks]
  );

  useEffect(() => {
    fetchScheduledTasks();
  }, [fetchScheduledTasks]);

  return {
    scheduledTasks,
    fetchScheduledTasks,
    handlePauseTask,
    handleResumeTask,
    handleDeleteTask,
  };
}
