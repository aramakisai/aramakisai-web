'use client';

import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
import { RegionalSponsorError } from './regional-sponsor-error';
import { RegionalSponsorList } from './regional-sponsor-list';

export interface RegionalSponsorContentProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsor: RegionalSponsor | null;
  readonly listScrollTop: number;
  /** 地点の一覧を表示するとき、その座標の企業 */
  readonly locationSponsors: readonly RegionalSponsor[] | null;
  readonly locationListScrollTop: number;
  readonly emptyMessage?: string;
  readonly error?: boolean;
  readonly onRetry?: () => void;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onLocationScrollTopChange: (scrollTop: number) => void;
  readonly onLocationBack: () => void;
  readonly onSelect: (sponsorId: number) => void;
  readonly onBack: () => void;
}

/** PC パネルと SP シートの両方に同じ内容を出す。詳細・エラー・地点の一覧では検索欄を隠す */
export function showsSearch(props: RegionalSponsorContentProps): boolean {
  return !props.selectedSponsor && !props.error && !props.locationSponsors;
}

export function RegionalSponsorContent(
  props: RegionalSponsorContentProps & { readonly scope: 'panel' | 'sheet' },
) {
  const { scope } = props;
  if (props.selectedSponsor) {
    return (
      <RegionalSponsorDetail
        sponsor={props.selectedSponsor}
        onBack={props.onBack}
        variant={scope}
      />
    );
  }
  if (props.error) {
    return <RegionalSponsorError onRetry={props.onRetry} />;
  }
  if (props.locationSponsors) {
    return (
      <RegionalSponsorList
        key="location"
        scope={scope}
        sponsors={props.locationSponsors}
        initialScrollTop={props.locationListScrollTop}
        onScrollTopChange={props.onLocationScrollTopChange}
        onSelect={props.onSelect}
        onLocationBack={props.onLocationBack}
      />
    );
  }
  return (
    <RegionalSponsorList
      key="all"
      scope={scope}
      sponsors={props.sponsors}
      initialScrollTop={props.listScrollTop}
      onScrollTopChange={props.onScrollTopChange}
      onSelect={props.onSelect}
      emptyMessage={props.emptyMessage}
    />
  );
}
