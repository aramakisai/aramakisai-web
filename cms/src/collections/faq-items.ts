import type { CollectionConfig } from 'payload';

export const FaqItems: CollectionConfig = {
  slug: 'faq_items',
  labels: { singular: 'よくある質問', plural: 'よくある質問' },
  admin: {
    useAsTitle: 'question',
  },
  orderable: true,
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
      maxLength: 500,
      label: '質問',
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
      label: '回答',
    },
  ],
};
