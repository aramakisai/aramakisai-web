import type { CollectionConfig } from 'payload';

export const FaqItems: CollectionConfig = {
  slug: 'faq_items',
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
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
    },
    {
      name: 'sort',
      type: 'number',
      admin: { description: '表示順' },
    },
  ],
};
