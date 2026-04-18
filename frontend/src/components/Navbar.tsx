import { Link } from 'react-router-dom';
import { usePipelineStatus } from '../hooks/usePipelineStatus';

export default function Navbar() {
  const { data: statusData } = usePipelineStatus();

  let isHealthy = false;
  if (statusData) {
    const totalPending = Object.values(statusData.queues).reduce(
      (sum, q) => sum + (q.pending || 0) + (q.processing || 0), 0
    );
    isHealthy = totalPending === 0;
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-blue-900 tracking-tight">
                RegOS
              </Link>
            </div>
            <div className="ml-8 flex space-x-8">
              <Link to="/" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-900 transition-colors">
                Impact Feed
              </Link>
              <Link to="/policies" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-blue-900 transition-colors">
                Policy Map
              </Link>
              <Link to="/tasks" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-blue-900 transition-colors">
                Remediation Tracker
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <span className="flex items-center text-sm font-medium text-gray-600">
              Pipeline Status:
              <span className={`ml-2 h-3 w-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-400'}`}></span>
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
