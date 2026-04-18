import clsx from 'clsx';

export default function UrgencyBadge({ urgency }: { urgency: string }) {
  const colors: Record<string, string> = {
    IMMEDIATE: 'bg-red-700 text-white',
    URGENT: 'bg-orange-600 text-white',
    STANDARD: 'bg-green-600 text-white',
    MONITOR: 'bg-gray-400 text-white',
  };
  
  const defaultColors = 'bg-gray-200 text-gray-800';

  return (
    <span className={clsx(
      'rounded-full px-2 py-0.5 text-xs font-semibold inline-flex items-center',
      colors[urgency?.toUpperCase()] || defaultColors
    )}>
      {urgency?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
}
