import type { CampusMapPoint } from './campus-map';

type PreviewPoint = Omit<CampusMapPoint, 'id'>;

/** CMS の地点を優先し、プレビュー分に衝突しない一時 ID を付ける。 */
export function mergePreviewPoints(
  existing: readonly CampusMapPoint[],
  preview: readonly PreviewPoint[],
): readonly CampusMapPoint[] {
  const points = [...existing];
  const ids = new Set(existing.map((point) => point.id));
  let id = -1;
  for (const point of preview) {
    if (
      points.some(
        (item) =>
          item.kind === point.kind &&
          item.latitude === point.latitude &&
          item.longitude === point.longitude,
      )
    )
      continue;
    while (ids.has(id)) id--;
    points.push({ ...point, id });
    ids.add(id--);
  }
  return points;
}
