import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPolicies } from '../api/client';
import { Policy } from '../types';

export default function PolicyMap() {
  const { data: policies, isLoading } = useQuery<Policy[]>({
    queryKey: ['policies'],
    queryFn: fetchPolicies
  });
  
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="relative">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Policy Library</h1>
        <p className="text-gray-600 mt-2">Compliance status against active regulatory frameworks.</p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Policy Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frameworks</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Tasks</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {policies?.map((policy) => (
              <tr 
                key={policy.policy_id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedPolicy(policy)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                  {policy.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {policy.doc_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {policy.frameworks.join(', ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {policy.open_task_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {policy.open_task_count === 0 ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Compliant
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                      Review Required
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPolicy && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40" onClick={() => setSelectedPolicy(null)}></div>
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto transform transition-transform border-l border-gray-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{selectedPolicy.title}</h2>
                <button onClick={() => setSelectedPolicy(null)} className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Close panel</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                {selectedPolicy.sections.map((section) => (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-600 mt-2">{section.text}</p>
                    <div className="mt-3">
                      {section.reg_refs?.map(ref => (
                        <span key={ref} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
