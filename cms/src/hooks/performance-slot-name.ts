/** フロントエンドの出演枠の名前 (団体名 → title) と同じ優先順位。 */
export function performanceSlotName(organizationName: unknown, title: unknown): string {
  for (const v of [organizationName, title]) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}
