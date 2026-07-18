import React from 'react';
import Link from 'next/link';
import { getSnsLinks } from '../lib/sns-links';
import { SnsIcon } from './sns-icon';
import { SnsLink } from '../lib/home-page-types';

export async function Footer() {
  let snsLinks: SnsLink[] = [];
  try {
    snsLinks = await getSnsLinks();
  } catch {
    snsLinks = [];
  }

  return (
    <footer className="mt-12 border-t border-gray-200">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <p className="text-lg">群馬大学 荒牧祭実行委員会</p>
          <address className="not-italic">
            〒371-8510 群馬県前橋市荒牧町4-2 群馬大学荒牧キャンパス内
          </address>
          <p className="mt-2">
            E-mail: mail_at_example.invalid
            <br />
            (_at_を@に置き換えてください)
          </p>
        </div>
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end">
          <ul className="mt-2 gap-4">
            <li>
              <Link href="/contact" className="hover:underline">
                お問い合わせ
              </Link>
            </li>
            <li>
              <Link href="/access" className="hover:underline">
                アクセス
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:underline">
                プライバシーポリシー
              </Link>
            </li>
          </ul>
          {snsLinks.length > 0 && (
            <ul className="flex gap-4">
              {snsLinks.map((sns, index) => (
                <li key={index}>
                  <a
                    href={sns.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={sns.platform}
                    className="hover:text-gray-900"
                  >
                    <SnsIcon platform={sns.platform} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
