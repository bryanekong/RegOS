import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Zap, X } from 'lucide-react';
import { isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
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

const PAGE_SIZE = 10;

// URL param helpers so filter state survives reloads, deep links, and back/forward.
const normalizeSeverity = (v: string | null): string => {
  if (!v) return 'All';
  const upper = v.toUpperCase();
  return (SEVERITY_OPTIONS as readonly string[]).includes(upper) ? upper : 'All';
};

export default function ImpactFeed() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const severityFilter = normalizeSeverity(searchParams.get('severity'));
  const dateFrom = searchParams.get('from') ?? '';
  const dateTo = searchParams.get('to') ?? '';

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: allPublications = [], isLoading, isError } = useQuery({
    queryKey: ['publications', 'feed'],
    queryFn: () => fetchPublications({ limit: 200 }),
    refetchInterval: 30000,
  });

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value && value !== 'All') next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true }
      );
      setVisibleCount(PAGE_SIZE);
    },
    [setSearchParams]
  );

  const filteredPublications = useMemo(() => {
    let results = allPublications;

    if (severityFilter !== 'All') {
      results = results.filter(p => p.classification?.severity === severityFilter);
    }

    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      results = results.filter(p => {
        const d = p.pub_date ?? p.ingested_at;
        return d ? isAfter(parseISO(d), from) || +parseISO(d) === +from : false;
      });
    }

    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      results = results.filter(p => {
        const d = p.pub_date ?? p.ingested_at;
        return d ? isBefore(parseISO(d), to) || +parseISO(d) === +to : false;
      });
    }

    return results;
  }, [allPublications, severityFilter, dateFrom, dateTo]);

  const visiblePublications = filteredPublications.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPublications.length;
  const hasActiveFilter = severityFilter !== 'All' || !!dateFrom || !!dateTo;

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setVisibleCount(PAGE_SIZE);
  }, [setSearchParams]);

  // Esc clears filters when any are active — avoids a trip to the mouse when
  // you're scanning the feed.
  useEffect(() => {
    if (!hasActiveFilter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      clearFilters();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasActiveFilter, clearFilters]);

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      await triggerIngest();
      toast('Pipeline triggered — check the Remediation Tracker shortly', 'success');
      // Invalidate immediately; react-query will dedupe against the polling
      // cycle and show fresh rows as stages complete.
      queryClient.invalidateQueries({ queryKey: ['publications'] });
    } catch {
      toast('Failed to trigger demo ingest — check API connection', 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
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
          {isTriggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {isTriggering ? 'Ingesting…' : 'Trigger Demo Ingest'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        {/* Severity pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0">
            Severity
          </span>
          <div className="flex gap-2 flex-wrap">
            {SEVERITY_OPTIONS.map(sev => {
              const isActive = severityFilter === sev;
              const colorClass = sev !== 'All' ? SEVERITY_PILL_COLORS[sev] : '';
              return (
                <button
                  key={sev}
                  onClick={() => updateParam('severity', sev)}
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
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0">
            Date
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={dateFrom}
              onChange={e => updateParam('from', e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              placeholder="From"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => updateParam('to', e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              placeholder="To"
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              title="Clear filters (Esc)"
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
                Esc
              </kbd>
            </button>
          )}
        </div>

        {/* Result count */}
        {!isLoading && !isError && (
          <div className="text-xs text-gray-400 font-medium pt-1 border-t border-gray-100">
            {filteredPublications.length} publication{filteredPublications.length !== 1 ? 's' : ''}
            {hasActiveFilter ? ' matching filters' : ''}
            {hasMore ? ` · showing ${visibleCount}` : ''}
          </div>
        )}
      </div>

      {/* Publication list */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => (
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
          ))
        ) : isError ? (
          <div className="text-center py-12 bg-white rounded-lg border border-red-200">
            <p className="text-red-600 font-medium">Failed to load publications.</p>
            <p className="text-gray-500 text-sm mt-1">Check your API connection and try again.</p>
          </div>
        ) : visiblePublications.length > 0 ? (
          <>
            {visiblePublications.map(pub => (
              <PublicationCard key={pub.publication_id} pub={pub} />
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
              >
                Load {Math.min(PAGE_SIZE, filteredPublications.length - visibleCount)} more
                <span className="text-gray-400 ml-1">
                  ({filteredPublications.length - visibleCount} remaining)
                </span>
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-semibold text-gray-800">No publications found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {hasActiveFilter
                ? 'No publications match your filters. Try adjusting or clearing them.'
                : 'Click Trigger Demo Ingest to start the pipeline.'}
            </p>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
