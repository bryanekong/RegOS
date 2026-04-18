import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink, FileText, AlertTriangle, Clock } from 'lucide-react';
import { fetchPublication } from '../api/client';
import SeverityBadge from '../components/SeverityBadge';
import UrgencyBadge from '../components/UrgencyBadge';

const DOC_TYPE_LABELS: Record<string, string> = {
  FinalRule: 'Final Rule',
  ConsultationPaper: 'Consultation Paper',
  DearCEOLetter: 'Dear CEO Letter',
  GuidanceNote: 'Guidance Note',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  ingested: 'bg-blue-50 text-blue-600',
  classified: 'bg-indigo-50 text-indigo-600',
  actioned: 'bg-green-50 text-green-700',
  skipped: 'bg-gray-50 text-gray-400',
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  NEW_REQUIREMENT: 'New Requirement',
  AMENDED_REQUIREMENT: 'Amended Requirement',
  DEADLINE_CHANGE: 'Deadline Change',
};

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

export default function PublicationDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publication', id],
    queryFn: () => fetchPublication(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="py-8 max-w-4xl mx-auto">
        <SkeletonBlock className="h-4 w-24 mb-6" />
        <SkeletonBlock className="h-8 w-3/4 mb-3" />
        <SkeletonBlock className="h-4 w-1/2 mb-8" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
        <SkeletonBlock className="h-40 mb-4" />
        <SkeletonBlock className="h-24" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-8 max-w-4xl mx-auto text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Publication not found.</p>
        <Link to="/feed" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to feed
        </Link>
      </div>
    );
  }

  const pub = data;
  const tasks = data.tasks ?? [];
  const { severity, urgency, framework, confidence, affected_provisions } =
    pub.classification ?? {};
  const pubDate = pub.pub_date ? new Date(pub.pub_date) : null;
  const ingestedDate = pub.ingested_at ? new Date(pub.ingested_at) : null;
  const statusStyle = STATUS_STYLES[pub.status] ?? STATUS_STYLES['pending'];

  const openTasks = tasks.filter(t => t.status === 'open');
  const isOverallOverdue = openTasks.some(t => t.deadline && new Date(t.deadline) < new Date());

  return (
    <div className="py-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Impact Feed
      </Link>

      {/* Title block */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 leading-snug flex-1">{pub.title}</h1>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle}`}>
            {pub.status.charAt(0).toUpperCase() + pub.status.slice(1)}
          </span>
        </div>
        <div className="flex items-center flex-wrap gap-3 mt-3">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
            FCA
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <FileText className="h-3.5 w-3.5" />
            {DOC_TYPE_LABELS[pub.doc_type] ?? pub.doc_type}
          </span>
          {pubDate && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500" title={format(pubDate, 'dd MMM yyyy')}>
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(pubDate, { addSuffix: true })}
            </span>
          )}
          {ingestedDate && (
            <span className="text-xs text-gray-400">
              Ingested {format(ingestedDate, 'dd MMM yyyy HH:mm')}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Classification card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Classification
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Severity</span>
              {severity ? <SeverityBadge severity={severity} /> : <span className="text-sm text-gray-400">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Urgency</span>
              {urgency ? <UrgencyBadge urgency={urgency} /> : <span className="text-sm text-gray-400">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Framework</span>
              {framework ? (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                  {framework}
                </span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Confidence</span>
              <span className="text-sm font-medium text-gray-700">{confidence ?? '—'}</span>
            </div>
          </div>
          {affected_provisions && affected_provisions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Affected Provisions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {affected_provisions.map(p => (
                  <span
                    key={p}
                    className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasks summary card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Remediation Tasks
            </h2>
            <Link to="/tasks" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View tracker →
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-gray-400">No tasks generated yet.</p>
              <p className="text-xs text-gray-300 mt-1">Pipeline may still be processing.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(['open', 'in_progress', 'done'] as const).map(status => {
                const count = tasks.filter(t => t.status === status).length;
                const labels = { open: 'Open', in_progress: 'In Progress', done: 'Done' };
                const colors = {
                  open: 'text-blue-700 bg-blue-50',
                  in_progress: 'text-amber-700 bg-amber-50',
                  done: 'text-green-700 bg-green-50',
                };
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{labels[status]}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[status]}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
              {isOverallOverdue && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Some tasks are overdue</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {pub.summary && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Summary
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{pub.summary}</p>
        </div>
      )}

      {/* Sections */}
      {pub.sections && pub.sections.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Document Sections
          </h2>
          <div className="space-y-4">
            {pub.sections.map(section => (
              <div key={section.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-mono text-gray-400 mr-2">{section.id}</span>
                  <span className="text-sm font-semibold text-gray-800">{section.title}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked tasks */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Linked Remediation Tasks ({tasks.length})
          </h2>
          <div className="space-y-3">
            {tasks.map(task => {
              const isOverdue = task.deadline && new Date(task.deadline) < new Date();
              return (
                <div
                  key={task.task_id}
                  className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={task.severity || 'LOW'} />
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                        {CHANGE_TYPE_LABELS[task.change_type] ?? task.change_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        task.status === 'open'
                          ? 'bg-blue-50 text-blue-700'
                          : task.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </span>
                    </div>
                    {task.deadline && (
                      <span className={`text-xs font-semibold shrink-0 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {isOverdue && '⚠ '}
                        {format(new Date(task.deadline), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{task.action_text}</p>
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-50 text-xs text-gray-400">
                    {task.section_title && <span>§ {task.section_title}</span>}
                    {task.owner && <span>Owner: {task.owner}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage in Remediation Tracker
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
