export type JsonLdValue =
  string | number | boolean | null | JsonLdObject | readonly JsonLdValue[];

export interface JsonLdObject {
  readonly [key: string]: JsonLdValue | undefined;
}

// CMS から取り込んだ文字列に "</script>" が混入していても直列化後の
// script 要素を閉じないよう、'<' を無害な HTML エスケープへ置換する
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface JsonLdProps {
  readonly data: JsonLdObject;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
