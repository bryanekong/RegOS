import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublications, triggerIngest } from '../api/client';
import PublicationCard from '../components/PublicationCard';

export default function ImpactFeed() {
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: publications, isLoading, refetch } = useQuery({
    queryKey: ['publications', severityFilter],
    queryFn: () => {
      const filters: Record<string, string> = {};
      if (severityFilter) filters.severity = severityFilter;
      return fetchPublications(filters);
    },
    refetchInterval: 30000
  });

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      await triggerIngest();
      // Wait a moment and then refetch to see the new item
      setTimeout(() => refetch(), 1000);
    } catch (e) {
      console.error(e);
      alert('Failed to trigger demo ingest');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regulatory Impact Feed</h1>
          <p className="text-gray-600 mt-2">Live monitoring of FCA publications and impacts.</p>
        </div>
        <button 
          onClick={handleTrigger}
          disabled={isTriggering}
          className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded shadow flex items-center font-medium disabled:opacity-50"
        >
          {isTriggering ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Ingesting...
            </span>
          ) : 'Trigger Demo Ingest'}
        </button>
      </div>

      <div className="mb-6 flex space-x-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Severity:</label>
          <select 
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 rounded p-1"
          >
            <option value="">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg p-4 h-24 animate-pulse shadow-sm border border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </>
        ) : publications && publications.length > 0 ? (
          publications.map(pub => (
            <PublicationCard key={pub.publication_id} pub={pub} />
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <h3 className="text-lg font-medium text-gray-900">No publications yet</h3>
            <p className="mt-1 text-gray-500">Click Trigger Demo Ingest to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
