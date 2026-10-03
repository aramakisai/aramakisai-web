import type { CollectionConfig } from 'payload';

export const ParkingLots: CollectionConfig = {
  slug: 'parking_lots',
  labels: { singular: '駐車場', plural: '駐車場' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sort'],
  },
  defaultSort: 'sort',
  hooks: {
    afterChange: [
      async ({ req, doc, operation }) => {
        // 空き状況は駐車場ごとに 1 件だけ持つ。画面からは作れないので作成に連動させる
        if (operation !== 'create') return;
        await req.payload.create({
          collection: 'parking_statuses',
          data: { lot: doc.id },
          overrideAccess: true,
          req,
        });
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        // 参照先を失った空き状況が公開 API に残らないようにする
        await req.payload.delete({
          collection: 'parking_statuses',
          where: { lot: { equals: id } },
          overrideAccess: true,
          req,
        });
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '名称',
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
