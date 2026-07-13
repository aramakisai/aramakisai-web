/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/">
          <img src="/images/nav_log.svg" alt="荒牧祭" className="h-10 w-auto" />
        </Link>
        <nav>
          <ul className="flex gap-4 text-sm">
            <li>
              <Link href="/" className="hover:underline">
                トップ
              </Link>
            </li>
            <li>
              <Link href="/topics" className="hover:underline">
                トピックス
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:underline">
                概要
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
