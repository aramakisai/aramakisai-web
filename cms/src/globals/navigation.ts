import type { Field, FieldHook, GlobalConfig, Validate } from 'payload';

const COLORS = ['primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt'] as const;

const COLOR_LABELS: Record<(typeof COLORS)[number], string> = {
  primary: '企画一覧・トピック',
  secondary: '構内マップ',
  info: 'タイムテーブル',
  warning: 'お知らせ',
  success: 'ご案内',
  accent: '協賛',
  'accent-alt': '荒牧祭について',
};

const rowLabel = { RowLabel: './components/NavigationRowLabel.tsx' };

type LinkType = 'page' | 'path' | 'group';
type Sibling = { link_type?: LinkType; page?: unknown; path?: string | null; label?: string | null; children?: unknown[] | null };

const sibling = (v: unknown) => v as Sibling;

/** 隠れた欄の値を残すと FE がそれを拾うため、表示される種別以外では保存時に消す。 */
const keepFor =
  (...types: LinkType[]): FieldHook =>
  ({ value, siblingData }) =>
    types.includes(sibling(siblingData).link_type as LinkType) ? value : null;

const requiredFor =
  (type: LinkType, message: string): Validate =>
  (value, { siblingData }) =>
    sibling(siblingData).link_type !== type || value ? true : message;

const linkFields = (parent: boolean): Field[] => {
  const labelTypes: LinkType[] = parent ? ['path', 'group'] : ['path'];
  const typeIs =
    (...types: LinkType[]) =>
    (_d: unknown, s: unknown) =>
      types.includes(sibling(s).link_type as LinkType);
  return [
    {
      name: 'link_type',
      type: 'radio',
      label: 'リンク先',
      required: true,
      defaultValue: 'page',
      options: [
        { label: '固定ページ', value: 'page' },
        { label: 'パス', value: 'path' },
        ...(parent ? [{ label: '子項目', value: 'group' }] : []),
      ],
    },
    {
      name: 'page',
      type: 'relationship',
      relationTo: 'pages',
      label: '固定ページ',
      admin: { condition: typeIs('page') },
      hooks: { beforeChange: [keepFor('page')] },
      validate: requiredFor('page', '固定ページを選択してください'),
    },
    {
      name: 'path',
      type: 'text',
      maxLength: 255,
      label: 'パス',
      admin: { condition: typeIs('path'), description: '例: /exhibitions、/#about' },
      hooks: { beforeChange: [keepFor('path')] },
      validate: requiredFor('path', 'パスを入力してください'),
    },
    {
      name: 'label',
      type: 'text',
      maxLength: 255,
      label: '項目名',
      admin: { condition: typeIs(...labelTypes) },
      hooks: { beforeChange: [keepFor(...labelTypes)] },
      validate: ((value, { siblingData }) =>
        !labelTypes.includes(sibling(siblingData).link_type as LinkType) || value ? true : '項目名を入力してください') as Validate,
    },
  ];
};

const items = (): Field => ({
  name: 'items',
  type: 'array',
  label: '項目',
  labels: { singular: '項目', plural: '項目' },
  required: true,
  minRows: 1,
  admin: { initCollapsed: true, components: rowLabel },
  fields: [
    ...linkFields(true),
    {
      name: 'color',
      type: 'select',
      defaultValue: 'primary',
      required: true,
      label: '現在地の色',
      options: COLORS.map((c) => ({ label: COLOR_LABELS[c], value: c })),
    },
    {
      name: 'footer_column',
      type: 'select',
      defaultValue: 'site',
      required: true,
      label: 'フッターの列',
      options: [
        { label: 'サイト案内', value: 'site' },
        { label: 'ご案内', value: 'guidance' },
      ],
    },
    {
      name: 'children',
      type: 'array',
      label: '子項目',
      labels: { singular: '子項目', plural: '子項目' },
      admin: {
        initCollapsed: true,
        components: rowLabel,
        condition: (_d, s) => sibling(s).link_type === 'group',
      },
      hooks: { beforeChange: [({ value, siblingData }) => (sibling(siblingData).link_type === 'group' ? value : [])] },
      validate: (value, { siblingData }) =>
        sibling(siblingData).link_type !== 'group' || (Array.isArray(value) && value.length > 0)
          ? true
          : '子項目を1件以上追加してください',
      fields: [
        ...linkFields(false),
        { name: 'hide_in_footer', type: 'checkbox', defaultValue: false, label: 'フッターに出さない' },
      ],
    },
  ],
});

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'ナビゲーション',
  fields: [
    {
      type: 'tabs',
      tabs: [
        { name: 'live', label: '開催中', fields: [items()] },
        { name: 'pre_event', label: '開催前', fields: [items()] },
      ],
    },
  ],
};
