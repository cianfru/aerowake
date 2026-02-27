import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PilotAvatarProps {
  pilotName?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

export function PilotAvatar({ pilotName, size = 'sm', className }: PilotAvatarProps) {
  const initials = pilotName ? getInitials(pilotName) : null;

  const sizeClasses = size === 'md'
    ? 'h-12 w-12 text-base'
    : 'h-9 w-9 text-xs';

  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';

  if (initials) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/15 border border-primary/25 font-semibold text-primary flex-shrink-0',
          sizeClasses,
          className,
        )}
        aria-label={`Avatar for ${pilotName}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 flex-shrink-0',
        sizeClasses,
        className,
      )}
    >
      <User className={cn(iconSize, 'text-primary')} />
    </div>
  );
}
