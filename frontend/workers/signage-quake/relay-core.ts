import type { SignageQuakePayload } from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';
import type { EewReport, ObservationReport } from './upstream';

export interface EewKey {
  readonly eventId: string;
  readonly serial: number;
  readonly cancelled: boolean;
}

export type QuakeNotice =
  | {
      readonly kind: 'eew';
      readonly op: 'post' | 'edit';
      readonly report: EewReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'observation';
      readonly report: ObservationReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'stage';
      readonly payload: SignageQuakePayload;
      readonly at: number;
    }
  | {
      readonly kind: 'dismissed';
      readonly by: string;
      readonly training: boolean;
      readonly at: number;
    }
  | {
      readonly kind: 'channel';
      readonly channel: ChannelName;
      readonly receiving: boolean;
      readonly lastReceivedAt: number | null;
      readonly at: number;
    };
