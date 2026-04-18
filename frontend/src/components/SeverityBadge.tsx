import clsx from 'clsx';

export default function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-yellow-400 text-gray-900',
    LOW: 'bg-blue-300 text-gray-900',
  };
  
  const defaultColors = 'bg-gray-200 text-gray-800';

  return (
    <span className={clsx(
      'rounded-full px-2 py-0.5 text-xs font-semibold inline-flex items-center',
      colors[severity?.toUpperCase()] || defaultColors
    )}>
      {severity?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
}
