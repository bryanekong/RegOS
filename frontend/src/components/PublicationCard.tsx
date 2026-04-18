import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Publication } from '../types';
import SeverityBadge from './SeverityBadge';
import UrgencyBadge from './UrgencyBadge';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  ingested: 'bg-blue-50 text-blue-600',
  classified: 'bg-indigo-50 text-indigo-600',
  actioned: 'bg-green-50 text-green-700',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  FinalRule: 'Final Rule',
  ConsultationPaper: 'Consultation Paper',
  DearCEOLetter: 'Dear CEO Letter',
  GuidanceNote: 'Guidance Note',
};

export default function PublicationCard({ pub }: { pub: Publication }) {
  const [expanded, setExpanded] = useState(false);

  const pubDate = pub.pub_date ? new Date(pub.pub_date) : null;
  const dateFormatted = pubDate ? format(pubDate, 'dd MMM yyyy') : 'Unknown date';
  const dateRelative = pubDate ? formatDistanceToNow(pubDate, { addSuffix: true }) : '';

  const { severity, urgency, framework, affected_provisions } = pub.classification || {};
  const statusStyle = STATUS_STYLES[pub.status] ?? STATUS_STYLES['pending'];

  return (
    <div
      className="bg-white shadow-sm rounded-lg hover:shadow-md cursor-pointer transition-shadow border border-gray-100 overflow-hidden"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex justify-between items-start gap-3">
          <h3 className="text-base font-semibold text-gray-800 leading-snug flex-1">
            {pub.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {severity && <SeverityBadge severity={severity} />}
            {urgency && <UrgencyBadge urgency={urgency} />}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-center flex-wrap gap-2 text-xs">
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">FCA</span>
          <span className="text-gray-600 font-medium">
            {DOC_TYPE_LABELS[pub.doc_type] ?? pub.doc_type}
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-500" title={dateFormatted}>
            {dateRelative || dateFormatted}
          </span>
          <span
            className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}
          >
            {pub.status.charAt(0).toUpperCase() + pub.status.slice(1)}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          className="border-t border-gray-100 px-4 py-4 bg-gray-50/60"
          onClick={e => e.stopPropagation()}
        >
          {pub.summary && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{pub.summary}</p>
          )}

          {framework && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Framework</span>
              <div className="mt-1">
                <span className="inline-block text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded border border-purple-200 font-medium">
                  {framework}
                </span>
              </div>
            </div>
          )}

          {affected_provisions && affected_provisions.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Affected provisions
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
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

          <Link
            to={`/tasks?publication=${pub.publication_id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View related tasks
          </Link>
        </div>
      )}
    </div>
  );
}
