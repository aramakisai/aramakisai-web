import { LocationPinIcon } from '@/components/icons';

interface SignageCurrentLocationProps {
  readonly name: string;
  readonly className?: string;
}

export function SignageCurrentLocation({
  name,
  className,
}: SignageCurrentLocationProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.92] px-4 py-2 text-signage-meta text-text${className ? ` ${className}` : ''}`}
    >
      <span className="flex items-center gap-1">
        <LocationPinIcon size={24} className="text-primary" />
        <span className="font-bold">現在地</span>
      </span>
      <span>{name}</span>
    </div>
  );
}
