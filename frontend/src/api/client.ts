import axios from 'axios';
import { Publication, Policy, Task, PipelineStatus } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'X-API-Key': 'regos-proto-2026'
  }
});

export interface PublicationFilters {
  severity?: string;
  framework?: string;
  limit?: number;
  offset?: number;
}

export const fetchPublications = async (params?: PublicationFilters): Promise<Publication[]> => {
  const { data } = await api.get('/api/publications', { params });
  return data;
};

export const fetchPublication = async (id: string): Promise<Publication & { tasks: Task[] }> => {
  const { data } = await api.get(`/api/publications/${id}`);
  return data;
};

export const fetchPolicies = async (): Promise<Policy[]> => {
  const { data } = await api.get('/api/policies');
  return data;
};

export const fetchPolicy = async (id: string): Promise<Policy> => {
  const { data } = await api.get(`/api/policies/${id}`);
  return data;
};

export const fetchTasks = async (params?: Record<string, string>): Promise<Task[]> => {
  const { data } = await api.get('/api/tasks', { params });
  return data;
};

export const updateTask = async (id: string, body: Partial<Task>): Promise<Task> => {
  const { data } = await api.patch(`/api/tasks/${id}`, body);
  return data;
};

export const fetchPipelineStatus = async (): Promise<PipelineStatus> => {
  const { data } = await api.get('/api/pipeline/status');
  return data;
};

export const triggerIngest = async (): Promise<{ triggered: boolean; publication_id: string }> => {
  const { data } = await api.post('/api/ingest/trigger');
  return data;
};

export const clearPipeline = async (
  statuses: string = 'pending,processing,failed'
): Promise<{ cleared: number; statuses: string[] }> => {
  const { data } = await api.post('/api/pipeline/clear', null, { params: { statuses } });
  return data;
};
