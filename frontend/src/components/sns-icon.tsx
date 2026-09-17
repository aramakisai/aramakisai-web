import React from 'react';
import { LinkIcon } from './icons';

export interface SnsIconProps {
  platform: string;
}

// 各サービスの公式ロゴを公式配色のまま用いるため、currentColor ではなくブランド色を直接指定する。
const logoProps = (testId: string) => ({
  'aria-hidden': true as const,
  'data-testid': testId,
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
});

const XIcon = () => (
  <svg {...logoProps('icon-x')} fill="none">
    <path
      fill="#000000"
      d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
    />
  </svg>
);

const InstagramIcon = () => (
  <svg {...logoProps('icon-instagram')} fill="none">
    <defs>
      <linearGradient
        id="sns-instagram-gradient"
        x1="2"
        y1="22"
        x2="22"
        y2="2"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#FEDA75" />
        <stop offset="0.25" stopColor="#FA7E1E" />
        <stop offset="0.5" stopColor="#D62976" />
        <stop offset="0.75" stopColor="#962FBF" />
        <stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#sns-instagram-gradient)" />
    <rect
      x="4.6"
      y="4.6"
      width="14.8"
      height="14.8"
      rx="4.6"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.7"
    />
    <circle
      cx="12"
      cy="12"
      r="3.6"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.7"
    />
    <circle cx="16.7" cy="7.3" r="1.1" fill="#ffffff" />
  </svg>
);

const FacebookIcon = () => (
  <svg {...logoProps('icon-facebook')} fill="none">
    <path
      fill="#1877F2"
      d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073"
    />
    <path
      fill="#ffffff"
      d="M16.671 15.563 17.203 12.073h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.996s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.643H7.078v3.49h3.047V24a12.14 12.14 0 0 0 3.75 0v-8.437h2.796Z"
    />
  </svg>
);

const YoutubeIcon = () => (
  <svg {...logoProps('icon-youtube')} fill="none">
    <path
      fill="#FF0000"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814"
    />
    <path fill="#ffffff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
  </svg>
);

const TIKTOK_GLYPH =
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07';

const TiktokIcon = () => (
  <svg {...logoProps('icon-tiktok')} fill="none">
    <path fill="#25F4EE" transform="translate(-0.9 0.9)" d={TIKTOK_GLYPH} />
    <path fill="#FE2C55" transform="translate(0.9 -0.9)" d={TIKTOK_GLYPH} />
    <path fill="#000000" d={TIKTOK_GLYPH} />
  </svg>
);

const LineIcon = () => (
  <svg {...logoProps('icon-line')} fill="none">
    <rect width="24" height="24" rx="5.5" fill="#06C755" />
    <path
      fill="#ffffff"
      d="M20.5 10.93c0-3.8-3.81-6.9-8.5-6.9s-8.5 3.1-8.5 6.9c0 3.41 3.02 6.26 7.11 6.8.28.06.65.19.75.43.09.21.06.55.03.77l-.12.73c-.04.21-.17.84.74.46s4.86-2.86 6.63-4.9c1.22-1.34 1.86-2.7 1.86-4.29Zm-11.5 2.2H7.3a.45.45 0 0 1-.45-.45V9.45a.45.45 0 0 1 .9 0v2.78H9a.45.45 0 0 1 0 .9Zm1.76-.45a.45.45 0 0 1-.9 0V9.45a.45.45 0 0 1 .9 0v3.23Zm3.89 0a.45.45 0 0 1-.81.27l-1.74-2.37v2.1a.45.45 0 0 1-.9 0V9.45a.45.45 0 0 1 .81-.27l1.74 2.37v-2.1a.45.45 0 0 1 .9 0v3.23Zm2.61-2.07a.45.45 0 0 1 0 .9h-1.25v.72h1.25a.45.45 0 0 1 0 .9h-1.7a.45.45 0 0 1-.45-.45V9.45a.45.45 0 0 1 .45-.45h1.7a.45.45 0 0 1 0 .9h-1.25v.71h1.25Z"
    />
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
