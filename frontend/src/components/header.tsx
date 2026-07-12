import React from 'react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold">
          荒牧祭
        </Link>
        <nav>
          <ul className="flex gap-4 text-sm">
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
          </ul>
        </nav>
      </div>
    </header>
  );
}
