import React from 'react';

export interface SnsIconProps {
  platform: string;
}

const XIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-x"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const InstagramIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-instagram"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const FacebookIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-facebook"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const YoutubeIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-youtube"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
    <polygon
      points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"
      fill="white"
    ></polygon>
  </svg>
);

const TiktokIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-tiktok"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0Z" />
  </svg>
);

const LineIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-line"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M24 10.3c0-4.4-4.8-8-10.7-8S2.6 5.9 2.6 10.3c0 3.9 3.8 7.3 8.8 7.9.3.1.8.3 1 .8.1.3.1.9 0 1.3-.1.4-.4 2-.5 2.4-.1.3-.2.8.5.5s3.5-2.1 4.7-3.2c1.4-1.2 4.3-3.9 4.3-6.9z" />
  </svg>
);

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    data-testid="icon-link"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const iconMap: Record<string, React.FC> = {
  x: XIcon,
  twitter: XIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  line: LineIcon,
};

export function SnsIcon({ platform }: SnsIconProps) {
  const normalized = platform.toLowerCase();
  const IconComponent = iconMap[normalized];

  if (IconComponent) {
    return <IconComponent />;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <LinkIcon />
      <span>{platform}</span>
    </span>
  );
}
