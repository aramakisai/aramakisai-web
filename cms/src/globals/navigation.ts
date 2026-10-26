import type { Field, GlobalConfig, Validate } from 'payload';

type Sibling = { page?: unknown; path?: string | null; children?: unknown[] | null };

const COLORS = ['primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt'] as const;

const COLOR_LABELS: Record<(typeof COLORS)[number], string> = {
  primary: '企画一覧・トピックと同じ',
  secondary: '構内マップと同じ',
  info: 'タイムテーブルと同じ',
  warning: 'お知らせと同じ',
  success: 'ご案内と同じ',
  accent: '協賛と同じ',
  'accent-alt': '荒牧祭についてと同じ',
};

const BOTH_LINKS = '固定ページかパスのどちらか一方を指定してください';

const rowLabel = { RowLabel: './components/NavigationRowLabel.tsx' };

const PATH_NOTE = '開催前は公開対象のパスでないと 404 になる。';

/** 子項目は遷移先が必須。 */
export const validateChildLink: Validate = (_v, { siblingData }) => {
  const s = siblingData as Sibling;
  return Boolean(s.page) !== Boolean(s.path) ? true : BOTH_LINKS;
};

/** 親項目はリンクか子項目のどちらか一方だけを持つ。 */
export const validateParentLink: Validate = (_v, { siblingData }) => {
  const s = siblingData as Sibling;
  if (s.page && s.path) return BOTH_LINKS;
  const hasLink = Boolean(s.page || s.path);
  const hasChildren = (s.children?.length ?? 0) > 0;
  if (hasLink === hasChildren) {
    return hasLink
      ? 'リンクと子項目は同時に指定できません'
      : 'リンク (固定ページかパス) か子項目のどちらかを指定してください';
  }
  return true;
};

const validateLabel: Validate = (value, { siblingData }) =>
  (siblingData as Sibling).page || value ? true : '項目名を入力してください';

const linkFields = (validatePage: Validate): Field[] => [
  {
    name: 'page',
    type: 'relationship',
    relationTo: 'pages',
    label: '固定ページ',
    admin: { description: `項目名はページの見出しになる。${PATH_NOTE}` },
    validate: validatePage,
  },
  {
    name: 'path',
    type: 'text',
    maxLength: 255,
    label: 'パス',
    admin: { description: `固定ページ以外のリンク先。例: /exhibitions、/#about。${PATH_NOTE}` },
  },
  {
    name: 'label',
    type: 'text',
    maxLength: 255,
    label: '項目名',
    admin: { condition: (_d, s) => !s?.page },
    validate: validateLabel,
  },
];

const items = (): Field => ({
  name: 'items',
  type: 'array',
  label: '項目',
  labels: { singular: '項目', plural: '項目' },
  required: true,
  minRows: 1,
  admin: { initCollapsed: true, components: rowLabel },
  fields: [
    ...linkFields(validateParentLink),
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
      admin: { initCollapsed: true, components: rowLabel },
      fields: [
        ...linkFields(validateChildLink),
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
