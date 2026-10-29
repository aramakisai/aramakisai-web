import type { Field } from 'payload';

import { executiveOnlyField } from '../access/payload-access';
import { blankToNull } from '../hooks/constraints';

export const CONTENT_FIELDS: Field[] = [
  { name: 'name', type: 'text', maxLength: 255, label: '企画名' },
  { name: 'description', type: 'textarea', label: '紹介文' },
  {
    name: 'images',
    type: 'upload',
    relationTo: 'media',
    hasMany: true,
    label: '画像',
    admin: { description: '最大5枚まで。1枚目がサムネイルとして表示されます。' },
  },
];

export const PLACEMENT_FIELDS: Field[] = [
  {
    name: 'open_days',
    type: 'text',
    hasMany: true,
    // 必須チェックは学生団体ロールだけに課すため validateCategoryContents で行う
    label: '出店日',
    admin: { components: { Field: './components/EventDayCheckboxes.tsx' } },
  },
  {
    name: 'area_id',
    type: 'relationship',
    relationTo: 'map_areas',
    label: 'マップ配置エリア',
    admin: { description: '割り当てられた出店エリア' },
    access: { create: executiveOnlyField, update: executiveOnlyField },
  },
  {
    name: 'booth_number',
    type: 'text',
    maxLength: 20,
    // 重複判定 (collection の beforeValidate) より先に正規化するため field の beforeValidate に置く
    hooks: { beforeValidate: [({ value }) => blankToNull(value)] },
    label: 'ブース番号',
    admin: { description: '割り当てられた出店グループ内の番号もしくは教室番号' },
    access: { create: executiveOnlyField, update: executiveOnlyField },
  },
  {
    name: 'booth_label',
    type: 'text',
    maxLength: 50,
    label: 'マップ表示ラベル',
    admin: { description: '割り当てられた出店エリア名' },
    access: { create: executiveOnlyField, update: executiveOnlyField },
  },
];
