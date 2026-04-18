import { useQuery } from '@tanstack/react-query';
import { fetchPipelineStatus } from '../api/client';

export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline-status'],
    queryFn: fetchPipelineStatus,
    refetchInterval: 15000,
  });
}
