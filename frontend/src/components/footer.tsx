import Link from 'next/link';
import { SnsIcon } from './sns-icon';

const footerNavigation = [
  { href: '/', label: 'TOP' },
  { href: '/#about', label: '荒牧祭について' },
  { href: '/events', label: '企画を探す' },
  { href: '/guide', label: '会場案内' },
  { href: '/sponsors', label: '協賛企業' },
  { href: '/news', label: 'お知らせ' },
] as const;

const socialLinks = [
  {
    href: 'https://x.com/aramakisai_',
    label: '荒牧祭公式X',
    platform: 'x',
  },
  {
    href: 'https://www.instagram.com/aramakisai_/',
    label: '荒牧祭公式Instagram',
    platform: 'instagram',
  },
  {
    href: 'https://www.youtube.com/@aramakisai',
    label: '荒牧祭公式YouTube',
    platform: 'youtube',
  },
] as const;

const contactFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSdfNRBPktNU8u_YTWarZUiIW-rhusE9hG_7dqyQHKEq4Vxlpg/viewform?usp=sharing&ouid=103248927242052693439';

const sectionHeadingClass =
  'bg-none bg-clip-border p-0 font-sans text-xs font-semibold tracking-[0.2em] text-slate-500';

function HoverLine() {
  return (
    <span
      aria-hidden="true"
      className="mansai-spectrum-line absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-70 transition-transform duration-200 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
    />
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200/80 bg-slate-50/70 text-slate-700 sm:mt-32">
      <div
        data-testid="footer-layout"
        className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-24 lg:px-8 lg:py-20"
      >
        <div
          data-testid="footer-columns"
          className="grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-16"
        >
          <nav aria-label="フッターサイト案内">
            <h2 className={sectionHeadingClass}>サイト案内</h2>
            <ul className="mt-7 space-y-2">
              {footerNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group relative inline-flex min-h-11 w-fit items-center text-sm font-medium tracking-wide text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700 motion-reduce:transition-none"
                  >
                    {item.label}
                    <HoverLine />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="フッターサポート">
            <h2 id="footer-support-heading" className={sectionHeadingClass}>
              SUPPORT
            </h2>
            <ul className="mt-7 space-y-2">
              <li>
                <a
                  href={contactFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex min-h-11 w-fit items-center text-sm font-medium tracking-wide text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700 motion-reduce:transition-none"
                >
                  お問い合わせ
                  <HoverLine />
                </a>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="group relative inline-flex min-h-11 w-fit items-center text-sm font-medium tracking-wide text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700 motion-reduce:transition-none"
                >
                  プライバシーポリシー
                  <HoverLine />
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <section
          aria-labelledby="footer-sns-heading"
          className="lg:justify-self-end"
        >
          <h2 id="footer-sns-heading" className={sectionHeadingClass}>
            OFFICIAL SNS
          </h2>
          <ul className="mt-7 flex flex-wrap gap-3">
            {socialLinks.map((social) => (
              <li key={social.platform}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="group relative inline-flex min-h-11 min-w-11 items-center justify-center text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700 motion-reduce:transition-none"
                >
                  <SnsIcon platform={social.platform} />
                  <HoverLine />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="border-t border-slate-200/80 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center">
          <small className="text-xs tracking-wide text-slate-500">
            © 2026 群馬大学荒牧祭実行委員会
          </small>
        </div>
      </div>
    </footer>
  );
}
