import { QrScanner } from '@/components/staff/qr-scanner';
import { StaffTitle } from '@/components/staff/staff-heading';
import { StaffNav } from '@/components/staff/staff-nav';
import { StaffForbidden } from '@/components/staff/staff-notice';
import { authorizeStaffPage } from '@/lib/staff-page';

export const dynamic = 'force-dynamic';

export default async function StaffScanPage() {
  const auth = await authorizeStaffPage('/staff/scan');
  if (auth.kind === 'forbidden') return <StaffForbidden />;
  if (auth.kind === 'unavailable') throw new Error('stamp env unavailable');

  return (
    <>
      <StaffTitle>読み取り</StaffTitle>
      <StaffNav selected="scan" />
      <QrScanner />
    </>
  );
}
