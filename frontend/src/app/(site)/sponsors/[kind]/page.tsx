import { notFound } from 'next/navigation';

// ad・local 以外の種別は 404。ad は静的ルートが優先される。
export default function SponsorsPage() {
  notFound();
}
