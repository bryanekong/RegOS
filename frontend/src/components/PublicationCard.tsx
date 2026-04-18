import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Publication } from '../types';
import SeverityBadge from './SeverityBadge';
import UrgencyBadge from './UrgencyBadge';

export default function PublicationCard({ pub }: { pub: Publication }) {
  const [expanded, setExpanded] = useState(false);
  
  const dateStr = pub.pub_date ? format(new Date(pub.pub_date), 'dd MMM yyyy') : 'Unknown Date';
  const { severity, urgency, framework } = pub.classification || {};

  return (
    <div 
      className="bg-white shadow-sm rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-800 flex-1 pr-4">
          {pub.title}
        </h3>
        <div className="flex space-x-2 shrink-0">
          {severity && <SeverityBadge severity={severity} />}
          {urgency && <UrgencyBadge urgency={urgency} />}
        </div>
      </div>
      
      <div className="mt-2 flex items-center space-x-3 text-sm">
        <span className="bg-blue-100 text-blue-800 px-2 rounded font-medium">FCA</span>
        <span className="text-gray-600 font-medium">{pub.doc_type}</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-500">{dateStr}</span>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
          <p className="text-gray-700 text-sm mb-3">
            {pub.summary || 'No summary available.'}
          </p>
          <div className="flex justify-between items-center mt-4">
            {framework && (
              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded border border-purple-200">
                Framework: {framework}
              </span>
            )}
            <Link 
              to={`/tasks?publication=${pub.publication_id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View related tasks &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
