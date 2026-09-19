export interface CampusMapConfig {
  /** 初期表示の中心。[緯度, 経度] の順 (Leaflet の LatLng に合わせる) */
  readonly center: readonly [latitude: number, longitude: number];
  readonly initialZoom: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  /** 表示範囲およびタイル要求範囲の上限。[[南, 西], [北, 東]] */
  readonly bounds: readonly [
    readonly [latitude: number, longitude: number],
    readonly [latitude: number, longitude: number],
  ];
  readonly tileUrlTemplate: string;
}

/**
 * 会場 (群馬大学荒牧キャンパス) は固定のため CMS では管理せずここに定数として持つ。
 * maxZoom は生成済みタイルの最大縮尺と一致させる。タイルが存在しない縮尺への
 * 引き伸ばし表示を避けるための制約であり、タイル生成側 (generate-map-tiles) の
 * 対象範囲・ズーム幅もこの値に合わせる。
 */
export const CAMPUS_MAP_CONFIG: CampusMapConfig = {
  center: [36.4318, 139.0464],
  initialZoom: 17,
  minZoom: 17,
  maxZoom: 19,
  bounds: [
    [36.4241, 139.034],
    [36.4395, 139.0588],
  ],
  tileUrlTemplate: '/map-tiles/{z}/{x}/{y}.png',
};

/**
 * Leaflet の attribution は HTML として解釈されるため、リンクを含む文字列をそのまま定数として持つ。
 * OpenStreetMap Tile Usage Policy / Attribution Guidelines が要求する文言とリンク先を満たす。
 */
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** デスクトップとスマートフォンの境界。Tailwind のブレークポイントと対応させる */
export const MAP_BREAKPOINT = 'md';
