import { HeadingFeature } from '@payloadcms/richtext-lexical';
import type { FeatureProviderServer } from '@payloadcms/richtext-lexical';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 各機能が異なる props 型を持つ配列を扱うための必要な any
type Features = FeatureProviderServer<any, any, any>[];

// 表示部品側で扱えない (サブスクリプト等) か、運用上使わない機能を除外する。
const DISABLED_FEATURE_KEYS = new Set([
  'subscript',
  'superscript',
  'inlineCode',
  'checklist',
  'relationship',
  'align',
  'indent',
]);

/**
 * announcements.body / topics.body / pages.content と、buildConfig の editor が
 * 単一設定であることに伴い festival_meta / page_home の richText フィールドにも適用される。
 */
export const richTextEditorFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: Features;
}): Features =>
  defaultFeatures
    .filter((feature) => !DISABLED_FEATURE_KEYS.has(feature.key))
    .map((feature) =>
      feature.key === 'heading'
        ? // h1・h5・h6 は本文設置先の見出しと重複する/使用実績がないため許可しない
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] })
        : feature,
    );
