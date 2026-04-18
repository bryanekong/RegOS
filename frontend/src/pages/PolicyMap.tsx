import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, FileText } from 'lucide-react';
import { fetchPolicies } from '../api/client';
import { Policy } from '../types';

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-8" />
      </td>
      <td className="px-6 py-4">
        <div className="h-5 bg-gray-200 rounded-full w-20" />
      </td>
    </tr>
  );
}

function PolicyPanel({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const totalTasks = policy.open_task_count;

  return (
    <>
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Panel header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 shrink-0">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-800 shrink-0" />
              <span className="text-xs font-medium text-blue-800 uppercase tracking-wide">
                {policy.doc_type}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{policy.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata strip */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {policy.frameworks.map(fw => (
              <span
                key={fw}
                className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium"
              >
                {fw}
              </span>
            ))}
          </div>
          {totalTasks > 0 && (
            <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              {totalTasks} open task{totalTasks !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {policy.sections.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No sections defined.</p>
          )}
          {policy.sections.map(section => (
            <div
              key={section.id}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden"
            >
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">{section.title}</h3>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
                {section.reg_refs && section.reg_refs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {section.reg_refs.map(ref => (
                      <span
                        key={ref}
                        className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded font-mono"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function PolicyMap() {
  const { data: policies, isLoading } = useQuery<Policy[]>({
    queryKey: ['policies'],
    queryFn: fetchPolicies,
  });

  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!policies) return [];
    const q = search.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.doc_type.toLowerCase().includes(q) ||
        p.frameworks.some(f => f.toLowerCase().includes(q))
    );
  }, [policies, search]);

  const reviewCount = filtered.filter(p => p.open_task_count > 0).length;

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Policy Library</h1>
          <p className="text-gray-500 text-sm mt-1">
            Compliance status against active regulatory frameworks.
          </p>
        </div>
        {!isLoading && filtered.length > 0 && reviewCount > 0 && (
          <span className="shrink-0 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            {reviewCount} polic{reviewCount !== 1 ? 'ies' : 'y'} need review
          </span>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search policies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Policy Name', 'Type', 'Frameworks', 'Open Tasks', 'Status'].map(col => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">
                  {search ? `No policies matching "${search}"` : 'No policies found.'}
                </td>
              </tr>
            ) : (
              filtered.map(policy => (
                <tr
                  key={policy.policy_id}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  onClick={() => setSelectedPolicy(policy)}
                >
                  <td className="px-6 py-4 text-sm font-semibold text-blue-900 group-hover:text-blue-700">
                    {policy.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{policy.doc_type}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {policy.frameworks.map(fw => (
                        <span
                          key={fw}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium"
                        >
                          {fw}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {policy.open_task_count > 0 ? (
                      <span className="text-amber-700">{policy.open_task_count}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {policy.open_task_count === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Review Required
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedPolicy && (
        <PolicyPanel policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
      )}
    </div>
  );
}
