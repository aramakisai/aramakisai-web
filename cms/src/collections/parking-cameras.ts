import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook, CollectionConfig, Field } from 'payload';

import { denyField } from '../access/payload-access';

/** relationship の値は depth により ID かオブジェクトで来る */
export function relationId(value: unknown): number | string | null {
  if (value && typeof value === 'object') return (value as { id: number | string }).id;
  return (value as number | string | null | undefined) ?? null;
}

// 割り当てが変わる前に撮った画像は新しい割り当て先の画像として公開しない。
// 判定中のジョブもこの NULL を見て元の割り当て先への反映をやめる
export const detachSnapshotsOnLotChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc;
  if (relationId(previousDoc?.lot) === relationId(doc.lot)) return doc;
  await req.payload.update({
    collection: 'parking_snapshots' as never,
    where: { camera: { equals: doc.id }, lot: { exists: true } },
    data: { lot: null } as never,
    overrideAccess: true,
    req,
  });
  return doc;
};

export const deleteSnapshotsBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'parking_snapshots' as never,
    where: { camera: { equals: id } },
    overrideAccess: true,
    req,
  });
};

/** 受信エンドポイント・ジョブ・稼働監視が overrideAccess で書く値。人は管理画面でも API でも書けない */
const systemOwned = {
  admin: { readOnly: true },
  access: { create: denyField, update: denyField },
} as const;

const systemDate = (name: string, label: string): Field => ({
  name,
  type: 'date',
  label,
  ...systemOwned,
  admin: { ...systemOwned.admin, date: { pickerAppearance: 'dayAndTime' } },
});

export const ParkingCameras: CollectionConfig = {
  slug: 'parking_cameras',
  labels: { singular: 'カメラ', plural: 'カメラ' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'lot',
      'last_captured_at',
      'device_status.rssi',
      'device_status.failures',
      'device_status.received_at',
      'token_issued_at',
    ],
  },
  hooks: {
    afterChange: [detachSnapshotsOnLotChange],
    beforeDelete: [deleteSnapshotsBeforeDelete],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 255, label: '名前', admin: { description: '例: 4階東側' } },
    {
      name: 'lot',
      type: 'relationship',
      relationTo: 'parking_lots',
      // 未割り当て (NULL) は複数台あってよい。重複は一意制約の検証エラーとしてこの欄に出る
      unique: true,
      label: '割り当て先',
    },
    {
      name: 'token_hash',
      type: 'text',
      unique: true,
      index: true,
      access: { read: denyField, create: denyField, update: denyField },
      admin: { hidden: true },
    },
    systemDate('token_issued_at', 'トークンの発行時刻'),
    {
      name: 'exposure_basis',
      type: 'group',
      label: '露出の起点',
      admin: { description: '次の露出補正値を決めるのに使う、最後に有効に判定できた画像の情報' },
      fields: [
        {
          name: 'quality',
          type: 'select',
          label: '写り具合',
          options: [
            { label: '良好', value: 'ok' },
            { label: '暗い', value: 'too_dark' },
            { label: '明るい', value: 'too_bright' },
            { label: '色かぶり', value: 'color_cast' },
          ],
          ...systemOwned,
        },
        { name: 'exposure', type: 'number', label: '露出補正値', ...systemOwned },
        systemDate('captured_at', '撮影時刻'),
      ],
    },
    {
      name: 'last_judged_window',
      type: 'number',
      access: { create: denyField, update: denyField },
      admin: { hidden: true },
    },
    systemDate('last_captured_at', '最後の撮影時刻'),
    {
      name: 'device_status',
      type: 'group',
      label: '端末状態',
      fields: [
        { name: 'rssi', type: 'number', label: '電波強度 (dBm)', ...systemOwned },
        { name: 'uptime', type: 'number', label: '起動からの秒数', ...systemOwned },
        { name: 'reset_reason', type: 'text', label: '直前の再起動の理由', ...systemOwned },
        { name: 'failures', type: 'number', label: '送信失敗の回数', ...systemOwned },
        { name: 'firmware', type: 'text', label: 'ファームウェアの版', ...systemOwned },
        systemDate('received_at', '受信時刻'),
      ],
    },
    systemDate('outage_notified_at', '停止を通知した時刻'),
  ],
};
