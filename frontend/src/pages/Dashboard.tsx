import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isAfter, subHours, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  FileText,
  ShieldCheck,
  Activity,
  ArrowRight,
  Clock,
  CheckCircle,
  Loader,
  Info,
  Trash2,
} from 'lucide-react';
import {
  fetchTasks,
  fetchPublications,
  fetchPolicies,
  fetchPipelineStatus,
  clearPipeline,
} from '../api/client';
import SeverityBadge from '../components/SeverityBadge';
import { useToast } from '../components/Toast';

const STAGE_LABELS: Record<string, string> = {
  stage1: 'Ingest',
  stage2: 'Classify',
  stage3: 'Map',
  stage4: 'Delta',
  stage5: 'Action',
};

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
  to?: string;
}) {
  const inner = (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start gap-4 h-full ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
    >
      <div className={`p-2.5 rounded-lg ${accent} shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-gray-200 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{value}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
        )}
      </div>
      {to && <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 self-center" />}
    </div>
  );

  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

function SeverityRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clearing, setClearing] = useState(false);

  const handleClearPipeline = async () => {
    if (clearing) return;
    const confirmed = window.confirm(
      'Clear all pending, active, and failed pipeline rows? Completed (done) rows are kept.'
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      const res = await clearPipeline();
      toast(`Cleared ${res.cleared} pipeline row${res.cleared === 1 ? '' : 's'}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
    } catch {
      toast('Failed to clear pipeline', 'error');
    } finally {
      setClearing(false);
    }
  };

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchTasks(),
  });

  const { data: publications = [], isLoading: pubsLoading } = useQuery({
    queryKey: ['publications', ''],
    queryFn: () => fetchPublications({ limit: 200 }),
    refetchInterval: 30000,
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: fetchPolicies,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: fetchPipelineStatus,
    refetchInterval: 15000,
  });

  const openTasks = useMemo(() => tasks.filter(t => t.status === 'open'), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter(t => t.status === 'in_progress'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);

  const tasksBySeverity = useMemo(
    () => ({
      CRITICAL: openTasks.filter(t => t.severity === 'CRITICAL').length,
      HIGH: openTasks.filter(t => t.severity === 'HIGH').length,
      MEDIUM: openTasks.filter(t => t.severity === 'MEDIUM').length,
      LOW: openTasks.filter(t => t.severity === 'LOW').length,
    }),
    [openTasks]
  );

  const overdueTasks = useMemo(
    () => openTasks.filter(t => t.deadline && new Date(t.deadline) < new Date()).length,
    [openTasks]
  );

  // Last 24 hours instead of last 7 days — more meaningful for a live demo
  const oneDayAgo = subHours(new Date(), 24);
  const last24hPubs = useMemo(
    () => publications.filter(p => p.ingested_at && isAfter(new Date(p.ingested_at), oneDayAgo)),
    [publications]
  );

  const policiesUnderReview = useMemo(
    () => policies.filter(p => p.open_task_count > 0).length,
    [policies]
  );

  const totalPending = pipelineStatus
    ? Object.values(pipelineStatus.queues).reduce(
        (s, q) => s + (q.pending || 0) + (q.processing || 0),
        0
      )
    : null;

  const lastIngestion = pipelineStatus?.last_ingestion
    ? formatDistanceToNow(new Date(pipelineStatus.last_ingestion), { addSuffix: true })
    : 'Never';

  // Deduplicate recent publications by title before displaying
  const recentFive = useMemo(() => {
    const seen = new Set<string>();
    return [...publications]
      .sort((a, b) =>
        new Date(b.ingested_at ?? 0).getTime() - new Date(a.ingested_at ?? 0).getTime()
      )
      .filter(p => {
        if (seen.has(p.title)) return false;
        seen.add(p.title);
        return true;
      })
      .slice(0, 5);
  }, [publications]);

  // Unique publication count (by title) for the stat card
  const uniquePubCount = useMemo(() => {
    const titles = new Set(publications.map(p => p.title));
    return titles.size;
  }, [publications]);

  return (
    <div className="py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Regulatory change at a glance — {format(new Date(), 'EEEE d MMMM yyyy')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Open Tasks"
          value={openTasks.length}
          sub={overdueTasks > 0 ? `${overdueTasks} overdue` : 'None overdue'}
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          accent="bg-orange-50"
          loading={tasksLoading}
          to="/tasks"
        />
        <StatCard
          label="Publications (24h)"
          value={last24hPubs.length}
          sub={`${uniquePubCount} unique total`}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-50"
          loading={pubsLoading}
          to="/feed"
        />
        <StatCard
          label="Policies Under Review"
          value={policiesUnderReview}
          sub={`of ${policies.length} total`}
          icon={<ShieldCheck className="h-5 w-5 text-purple-600" />}
          accent="bg-purple-50"
          loading={policiesLoading}
          to="/policies"
        />
        <StatCard
          label="Pipeline"
          value={totalPending === null ? '—' : totalPending === 0 ? 'Idle' : `${totalPending} active`}
          sub={`Last ingest: ${lastIngestion}`}
          icon={<Activity className="h-5 w-5 text-green-600" />}
          accent="bg-green-50"
          to="/feed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open tasks by severity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Open Tasks by Severity</h2>
            <Link to="/tasks" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all
            </Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <SeverityRow label="Critical" count={tasksBySeverity.CRITICAL} color="bg-red-500" />
                <SeverityRow label="High" count={tasksBySeverity.HIGH} color="bg-orange-500" />
                <SeverityRow label="Medium" count={tasksBySeverity.MEDIUM} color="bg-yellow-400" />
                <SeverityRow label="Low" count={tasksBySeverity.LOW} color="bg-blue-300" />
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex items-center gap-3">
                    <Loader className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                    <span className="text-sm text-gray-600 flex-1">In Progress</span>
                    <span className="text-sm font-semibold text-gray-800">{inProgressTasks.length}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <CheckCircle className="h-2.5 w-2.5 text-green-500 shrink-0" />
                    <span className="text-sm text-gray-600 flex-1">Done</span>
                    <span className="text-sm font-semibold text-gray-800">{doneTasks.length}</span>
                  </div>
                </div>
              </div>
              {/* Accumulation note */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-400">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Tasks accumulate across pipeline runs. Use the Remediation Tracker to close completed items.</span>
              </div>
            </>
          )}
        </div>

        {/* Pipeline stages */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">Pipeline Stages</h2>
              {totalPending !== null && totalPending > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <button
              onClick={handleClearPipeline}
              disabled={clearing || totalPending === 0}
              title="Clear pending, active, and failed pipeline rows"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {clearing ? 'Clearing…' : 'Clear queue'}
            </button>
          </div>
          {!pipelineStatus ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : Object.keys(pipelineStatus.queues).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No pipeline data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(pipelineStatus.queues).map(([stage, counts]) => {
                const hasPending = (counts.pending || 0) + (counts.processing || 0) > 0;
                const label = STAGE_LABELS[stage] ?? stage;
                const stageNum = stage.replace('stage', '');
                return (
                  <div key={stage} className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${hasPending ? 'bg-amber-400' : 'bg-green-400'}`}
                    />
                    <span className="text-sm text-gray-600 flex-1">
                      <span className="text-gray-400 text-xs mr-1">S{stageNum}</span>
                      {label}
                    </span>
                    <div className="flex gap-2 text-xs font-medium">
                      {counts.pending > 0 && (
                        <span className="text-amber-600">{counts.pending} pending</span>
                      )}
                      {counts.processing > 0 && (
                        <span className="text-blue-600">{counts.processing} active</span>
                      )}
                      {counts.failed > 0 && (
                        <span className="text-red-600">{counts.failed} failed</span>
                      )}
                      {counts.done > 0 && (
                        <span className="text-gray-400">{counts.done} done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent publications — deduplicated */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Recent Publications</h2>
            <Link to="/feed" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all
            </Link>
          </div>
          {pubsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-1 animate-pulse">
                  <div className="h-3.5 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentFive.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No publications yet.</p>
              <Link to="/feed" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                Trigger demo ingest →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentFive.map(pub => (
                <Link
                  key={pub.publication_id}
                  to={`/publications/${pub.publication_id}`}
                  className="block group"
                >
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                    {pub.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-gray-300 shrink-0" />
                    <span className="text-xs text-gray-400">
                      {pub.ingested_at
                        ? formatDistanceToNow(new Date(pub.ingested_at), { addSuffix: true })
                        : 'Unknown'}
                    </span>
                    {pub.classification?.severity && (
                      <SeverityBadge severity={pub.classification.severity} />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
