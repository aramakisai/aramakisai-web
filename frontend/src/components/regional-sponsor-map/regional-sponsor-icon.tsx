import type { SVGProps } from 'react';

type RegionalSponsorIconName =
  'arrow-back' | 'hide-image' | 'open-in-new' | 'search';

interface RegionalSponsorIconProps extends SVGProps<SVGSVGElement> {
  readonly name: RegionalSponsorIconName;
  readonly size?: number;
}

const PATHS: Record<RegionalSponsorIconName, readonly string[]> = {
  'arrow-back': ['M20 12H5', 'm11 6-6 6 6 6'],
  'hide-image': [
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'm3 16 4.5-4.5 4 4 2.5-2.5 7 7',
    'M4 3 21 20',
  ],
  'open-in-new': [
    'M14 5h5v5',
    'm19 5-8 8',
    'M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  ],
  search: ['M16 16 21 21'],
};

export function RegionalSponsorIcon({
  name,
  size = 24,
  ...props
}: RegionalSponsorIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      data-testid={`regional-icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      focusable="false"
    >
      {name === 'search' && <circle cx="11" cy="11" r="6" />}
      {PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
