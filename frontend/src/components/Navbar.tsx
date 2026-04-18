import { Link, useLocation } from 'react-router-dom';
import { usePipelineStatus } from '../hooks/usePipelineStatus';

const navLinks = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/feed', label: 'Impact Feed', exact: false },
  { to: '/policies', label: 'Policy Map', exact: false },
  { to: '/tasks', label: 'Remediation Tracker', exact: false },
];

export default function Navbar() {
  const location = useLocation();
  const { data: statusData } = usePipelineStatus();

  const totalPending = statusData
    ? Object.values(statusData.queues).reduce(
        (sum, q) => sum + (q.pending || 0) + (q.processing || 0),
        0
      )
    : null;
  const isHealthy = totalPending === 0;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-blue-900 tracking-tight">
                RegOS
              </Link>
            </div>
            <div className="ml-8 flex space-x-1">
              {navLinks.map(({ to, label, exact }) => {
                const isActive = exact
                  ? location.pathname === to
                  : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`inline-flex items-center px-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-900 text-blue-900'
                        : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  statusData === undefined
                    ? 'bg-gray-300'
                    : isHealthy
                    ? 'bg-green-500'
                    : 'bg-amber-400 animate-pulse'
                }`}
                title={
                  statusData === undefined
                    ? 'Checking pipeline...'
                    : isHealthy
                    ? 'Pipeline idle'
                    : `${totalPending} item${totalPending === 1 ? '' : 's'} processing`
                }
              />
              <span className="hidden sm:inline font-medium">
                {statusData === undefined
                  ? 'Checking...'
                  : isHealthy
                  ? 'Pipeline idle'
                  : `${totalPending} processing`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
