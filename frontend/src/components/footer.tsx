import Link from 'next/link';
/* eslint-disable @next/next/no-img-element -- ロゴは公開ディレクトリの静的画像で最適化不要 */
import { getSnsLinks } from '@/lib/sns-links';
import { getContactFormUrl } from '@/lib/festival-meta';
import type { SnsLink } from '@/lib/home-page-types';
import {
  navigationItemsByPhase,
  linkableChildren,
  type NavigationItem,
} from '@/lib/navigation';
import type { FestivalPhase } from '@/lib/phase';
import { MailIcon, OpenInNewIcon, PlaceIcon } from './icons';
import { SnsIcon } from './sns-icon';
import { MotionToggle } from './motion-toggle';

const sectionHeadingClass =
  'bg-none bg-clip-border p-0 font-sans text-xs leading-[1.4] font-medium tracking-[0.2em] text-gray-600';

function HoverLine() {
  return (
    <span
      aria-hidden="true"
      className="mansai-spectrum-line absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-70 transition-transform duration-200 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
    />
  );
}

function FooterLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group relative flex h-8 w-full items-center text-sm leading-[1.6] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {children}
        <HoverLine />
      </Link>
    </li>
  );
}

function siteGuideLinks(
  items: readonly NavigationItem[],
): readonly (NavigationItem & { href: string })[] {
  return items
    .filter((item) => item.label !== 'ご案内')
    .flatMap((item) =>
      item.href
        ? [item as NavigationItem & { href: string }]
        : linkableChildren(item),
    );
}

// お問い合わせはサポート列に既にあるため、ここでは重複させない
function guidanceLinks(
  items: readonly NavigationItem[],
): readonly (NavigationItem & { href: string })[] {
  const guidance = items.find((item) => item.label === 'ご案内');
  if (!guidance) return [];
  return linkableChildren(guidance).filter(
    (child) => child.label !== 'お問い合わせ',
  );
}

export interface FooterProps {
  readonly phase: FestivalPhase;
}

export async function Footer({ phase }: FooterProps) {
  const items = navigationItemsByPhase[phase];

  let snsLinks: SnsLink[] = [];
  try {
    snsLinks = await getSnsLinks();
  } catch {
    snsLinks = [];
  }

  let contactFormUrl: string | null = null;
  try {
    contactFormUrl = await getContactFormUrl();
  } catch {
    contactFormUrl = null;
  }

  return (
    <footer className="relative bg-background">
      {/* 新しいトークンを増やさず、既存の background に bansai-sage を重ねてフッター専用の地を表現する */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-bansai-sage/[0.18]"
      />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col px-4 pt-12 pb-8 lg:px-0 lg:pt-16">
        <div className="flex flex-col lg:flex-row lg:justify-between">
          <nav
            aria-label="フッターサイト案内"
            className="flex flex-col gap-[18px]"
          >
            <h2 className={sectionHeadingClass}>サイト案内</h2>
            <ul className="flex flex-col">
              {siteGuideLinks(items).map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </ul>
          </nav>

          <nav
            aria-label="フッターご案内"
            className="mt-9 flex flex-col gap-[18px] lg:mt-0"
          >
            <h2 className={sectionHeadingClass}>ご案内</h2>
            <ul className="flex flex-col">
              {guidanceLinks(items).map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </ul>
          </nav>

          <nav
            aria-label="フッターサポート"
            className="mt-[37px] flex flex-col gap-[18px] lg:mt-0"
          >
            <h2 className={sectionHeadingClass}>サポート</h2>
            <ul className="flex flex-col">
              {contactFormUrl && (
                <li>
                  <a
                    href={contactFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex h-8 w-full items-center gap-1 text-sm leading-[1.6] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    お問い合わせ
                    <OpenInNewIcon size={16} className="text-gray-500" />
                    <HoverLine />
                  </a>
                </li>
              )}
              <FooterLink href="/privacy">プライバシーポリシー</FooterLink>
            </ul>
          </nav>
        </div>

        <div className="mt-[38px] flex flex-col gap-[43px] lg:flex-row lg:items-start lg:justify-between lg:gap-0">
          <div className="flex flex-col gap-[27px]">
            <img
              src="/images/logo-2026.png"
              alt="荒牧祭2026"
              className="h-[22px] w-[122px] object-contain"
            />
            <address className="flex flex-col gap-3 text-sm leading-[1.6] text-text not-italic">
              <p className="font-bold leading-[1.4]">
                群馬大学荒牧祭実行委員会
              </p>
              <div className="relative pl-5">
                <PlaceIcon
                  size={16}
                  className="absolute top-1 left-0 text-gray-500"
                />
                〒371-8510
                <br />
                群馬県前橋市荒牧町4-2
                <br />
                群馬大学荒牧キャンパス内
              </div>
              <p className="relative pl-5">
                <MailIcon
                  size={16}
                  className="absolute top-1 left-0 text-gray-500"
                />
                mail_at_example.invalid
                <br />
                (_at_を@に置き換えてください)
              </p>
            </address>
          </div>

          {snsLinks.length > 0 && (
            <section
              aria-labelledby="footer-sns-heading"
              className="flex flex-col items-start gap-7 lg:items-end"
            >
              <h2
                id="footer-sns-heading"
                className={`${sectionHeadingClass} lg:-mt-0.5 lg:text-right`}
              >
                公式SNS
              </h2>
              <ul className="flex flex-wrap gap-4">
                {snsLinks.map((sns) => (
                  <li key={sns.platform}>
                    <a
                      href={sns.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`荒牧祭公式${sns.platform}`}
                      className="group relative inline-flex size-6 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      <SnsIcon platform={sns.platform} />
                      <HoverLine />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-[47px] flex flex-col gap-[21px] lg:mt-[45px]">
          <div className="h-px w-full bg-gray-200" />
          <div className="flex flex-col items-center gap-[21px] lg:h-8 lg:flex-row lg:items-center lg:gap-0">
            <div className="lg:order-3 lg:flex lg:w-[116px] lg:shrink-0 lg:justify-end">
              <MotionToggle />
            </div>
            <div
              aria-hidden="true"
              className="hidden lg:order-1 lg:block lg:w-[116px] lg:shrink-0"
            />
            <small className="text-xs leading-[1.4] font-medium text-gray-600 lg:order-2 lg:flex-1 lg:text-center">
              © 2026 群馬大学荒牧祭実行委員会
            </small>
          </div>
        </div>
      </div>
    </footer>
  );
}
