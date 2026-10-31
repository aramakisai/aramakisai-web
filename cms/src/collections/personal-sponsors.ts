import type { CollectionConfig } from 'payload';

export const PersonalSponsors: CollectionConfig = {
  slug: 'personal_sponsors',
  labels: { singular: '個人協賛', plural: '個人協賛' },
  admin: { useAsTitle: 'name' },
  orderable: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: '公開用表示名',
      required: true,
      maxLength: 255,
    },
  ],
};
