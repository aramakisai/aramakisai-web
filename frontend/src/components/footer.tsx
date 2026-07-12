import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-12 border-t border-gray-200">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; 荒牧祭実行委員会</p>
        <ul className="flex gap-4">
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
      </div>
    </footer>
  );
}
