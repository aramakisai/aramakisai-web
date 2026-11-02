import type { GlobalBeforeChangeHook, GlobalConfig } from 'payload';
import { ValidationError } from 'payload';


import { signageNotifyGlobalHook } from '../lib/signage-notify';
import { decideTrialAnchor, validateTrialStart, type TrialRunValue } from '../lib/signage-trial';
import { visibleFilter } from '../lib/signage-visibility';

// beforeChange の data.trial_run は未送信でも保存済みの値で補完されて届くため、送信有無は
// 補完前に動く group の beforeValidate が残した値で判定する(undefined = 保持、null = 終了)
const recordTrialAnchor: GlobalBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const sent = req.context.trialStartSent as string | null | undefined;
  if (typeof sent === 'string') {
    const site = await req.payload.findGlobal({ slug: 'site_settings', depth: 0, req });
    const result = validateTrialStart(
      sent,
      (site.event_days ?? []).map((d: { start_at: string }) => d.start_at),
    );
    if (!result.ok) {
      throw new ValidationError({
        global: 'signage_settings',
        errors: [
          {
            path: 'trial_run.start_at',
            message: result.reason === 'no_event_days' ? '開催日程が未登録です' : '開催日の日付を指定してください',
          },
        ],
      });
    }
  }
  data.trial_run = decideTrialAnchor((originalDoc?.trial_run as TrialRunValue | undefined) ?? null, sent, new Date().toISOString());
  return data;
};

export const SignageSettings: GlobalConfig = {
  slug: 'signage_settings',
  label: 'サイネージ設定',
  // 固定の操作はサイネージ スライドの画面で行う。保存先としてだけ残す
  admin: { hidden: true },
  hooks: { beforeChange: [recordTrialAnchor], afterChange: [signageNotifyGlobalHook(['pin', 'snapshot'])] },
  fields: [
    {
      name: 'pinned_slide',
      type: 'relationship',
      relationTo: 'signage_slides',
      label: '固定表示するスライド',
      filterOptions: ({ req }) => visibleFilter(req.payload, 'signage_slides', req),
      admin: { description: '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。' },
    },
    {
      name: 'trial_run',
      type: 'group',
      label: '試験運転',
      hooks: {
        beforeValidate: [
          ({ siblingData, req }) => {
            req.context.trialStartSent = (siblingData.trial_run as { start_at?: string | null } | undefined)?.start_at;
          },
        ],
      },
      fields: [
        { name: 'start_at', type: 'date', label: '試験内の開始日時', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'anchored_at', type: 'date', label: '開始操作の日時', admin: { hidden: true, readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
};
