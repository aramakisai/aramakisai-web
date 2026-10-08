import { lexicalHTMLField } from '@payloadcms/richtext-lexical';
import type { CollectionConfig, Validate } from 'payload';

import { richTextHTMLConverters } from '../lib/rich-text-html-converters';

const kindIs =
  (...kinds: string[]) =>
  (data: Record<string, unknown>) =>
    kinds.includes(String(data?.kind));

/** 種別に依存する必須は全種別に required を掛けられないため、種別を見て判定する */
const requiredWhen =
  (kinds: string[], message: string): Validate =>
  (value, { siblingData }) => {
    if (!kindIs(...kinds)(siblingData as Record<string, unknown>)) return true;
    const empty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    return empty ? message : true;
  };

const layoutOnly = { condition: kindIs('layout') };

const layoutIs =
  (...layouts: string[]) =>
  (data: Record<string, unknown>) =>
    kindIs('layout')(data) && layouts.includes(String(data?.layout));

export const SignageSlides: CollectionConfig = {
  slug: 'signage_slides',
  labels: { singular: 'サイネージ スライド', plural: 'サイネージ スライド' },
  orderable: true,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'enabled', 'pin'],
    components: { beforeListTable: ['./components/SignagePinBanner.tsx'] },
    // ドラッグ並べ替えはページをまたげないため、全件を1ページに収める
    pagination: { defaultLimit: 100 },
  },
  fields: [
    {
      name: 'pin',
      type: 'ui',
      label: '固定',
      admin: {
        position: 'sidebar',
        components: { Cell: './components/SignagePinCell.tsx', Field: './components/SignagePinButton.tsx' },
      },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      label: '種別',
      options: [
        { label: '協賛', value: 'sponsors' },
        { label: '落とし物', value: 'lost_items' },
        { label: '構内マップ', value: 'campus_map' },
        { label: '登録画像', value: 'image' },
        { label: '駐車場', value: 'parking' },
        { label: 'タイムテーブル', value: 'timetable' },
        { label: 'レイアウト', value: 'layout' },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 100,
      label: 'タイトル',
      admin: { description: 'レイアウトでは画面に表示される。それ以外は管理用の名前' },
    },
    {
      name: 'layout',
      type: 'select',
      label: 'レイアウト',
      options: [
        { label: 'タイトル スライド', value: 'title' },
        { label: 'タイトルとコンテンツ', value: 'title-content' },
        { label: 'セクション見出し', value: 'section' },
        { label: '2つのコンテンツ', value: 'two-content' },
      ],
      admin: layoutOnly,
      validate: requiredWhen(['layout'], 'レイアウトを選んでください'),
    },
    {
      name: 'tone',
      type: 'select',
      defaultValue: 'normal',
      label: '配色',
      options: [
        { label: '通常', value: 'normal' },
        { label: '注意喚起', value: 'alert' },
      ],
      admin: layoutOnly,
    },
    {
      name: 'subtext',
      type: 'textarea',
      maxLength: 200,
      label: 'サブテキスト',
      admin: { condition: layoutIs('title', 'section') },
    },
    {
      name: 'content1',
      type: 'richText',
      label: '本文枠 1',
      admin: { condition: layoutIs('title-content', 'two-content') },
    },
    lexicalHTMLField({
      htmlFieldName: 'content1_html',
      lexicalFieldName: 'content1',
      storeInDB: true,
      converters: richTextHTMLConverters,
    }),
    { name: 'content2', type: 'richText', label: '本文枠 2', admin: { condition: layoutIs('two-content') } },
    lexicalHTMLField({
      htmlFieldName: 'content2_html',
      lexicalFieldName: 'content2',
      storeInDB: true,
      converters: richTextHTMLConverters,
    }),
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: '画像',
      admin: { condition: kindIs('image', 'campus_map') },
      validate: requiredWhen(['image', 'campus_map'], '画像を選んでください'),
    },
    {
      name: 'duration_seconds',
      type: 'number',
      required: true,
      defaultValue: 10,
      min: 5,
      max: 120,
      label: '表示秒数',
      admin: { description: 'QR・表・タイムテーブル・落とし物は15秒を推奨' },
    },
    { name: 'enabled', type: 'checkbox', defaultValue: true, label: '有効' },
  ],
};
