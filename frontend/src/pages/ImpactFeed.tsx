import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Zap } from 'lucide-react';
import { fetchPublications, triggerIngest } from '../api/client';
import PublicationCard from '../components/PublicationCard';
import { useToast } from '../components/Toast';

const SEVERITY_OPTIONS = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const SEVERITY_PILL_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white border-red-600',
  HIGH: 'bg-orange-500 text-white border-orange-500',
  MEDIUM: 'bg-yellow-400 text-gray-900 border-yellow-400',
  LOW: 'bg-blue-300 text-gray-900 border-blue-300',
};

export default function ImpactFeed() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: publications, isLoading, isError } = useQuery({
    queryKey: ['publications', severityFilter],
    queryFn: () => {
      const filters: Record<string, string> = {};
      if (severityFilter !== 'All') filters.severity = severityFilter;
      return fetchPublications(filters);
    },
    refetchInterval: 30000,
  });

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      await triggerIngest();
      toast('Pipeline triggered — check the Remediation Tracker shortly', 'success');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['publications'] }), 1500);
    } catch {
      toast('Failed to trigger demo ingest — check API connection', 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const count = publications?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regulatory Impact Feed</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Live monitoring of FCA publications and regulatory impacts.
          </p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={isTriggering}
          className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white px-4 py-2.5 rounded-lg shadow-sm font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0 ml-4"
        >
          {isTriggering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {isTriggering ? 'Ingesting…' : 'Trigger Demo Ingest'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Severity:</span>
        <div className="flex gap-2 flex-wrap">
          {SEVERITY_OPTIONS.map(sev => {
            const isActive = severityFilter === sev;
            const colorClass = sev !== 'All' ? SEVERITY_PILL_COLORS[sev] : '';
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                  isActive
                    ? sev === 'All'
                      ? 'bg-blue-900 text-white border-blue-900'
                      : colorClass
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {sev === 'All' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
        {!isLoading && !isError && (
          <span className="ml-auto text-xs text-gray-400 font-medium">
            {count} publication{count !== 1 ? 's' : ''}
            {severityFilter !== 'All' ? ` · ${severityFilter.toLowerCase()}` : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 animate-pulse"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="flex gap-2">
                    <div className="h-5 w-14 bg-gray-200 rounded-full" />
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="h-3 w-8 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </>
        ) : isError ? (
          <div className="text-center py-12 bg-white rounded-lg border border-red-200">
            <p className="text-red-600 font-medium">Failed to load publications.</p>
            <p className="text-gray-500 text-sm mt-1">Check your API connection and try again.</p>
          </div>
        ) : publications && publications.length > 0 ? (
          publications.map(pub => <PublicationCard key={pub.publication_id} pub={pub} />)
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-semibold text-gray-800">No publications yet</h3>
            <p className="text-gray-500 text-sm mt-1">
              {severityFilter !== 'All'
                ? `No ${severityFilter.toLowerCase()} severity publications found.`
                : 'Click Trigger Demo Ingest to start the pipeline.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
