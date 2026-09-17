import type { CollectionConfig } from 'payload';

export const FaqItems: CollectionConfig = {
  slug: 'faq_items',
  labels: { singular: 'よくある質問', plural: 'よくある質問' },
  admin: {
    useAsTitle: 'question',
  },
  defaultSort: 'sort',
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
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
