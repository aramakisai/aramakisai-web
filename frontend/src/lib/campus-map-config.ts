export interface CampusMapConfig {
  /** 操作で到達できる表示倍率の範囲。タイルの有無とは独立 */
  readonly minZoom: number;
  readonly maxZoom: number;
  /** 生成済みタイルが実在する倍率の範囲。範囲外は最寄りの倍率のタイルを拡縮して表示する */
  readonly minNativeZoom: number;
  readonly maxNativeZoom: number;
  /** 初期表示で画面に収めるキャンパス敷地の外接矩形。[[南, 西], [北, 東]] */
  readonly campusBounds: readonly [
    readonly [latitude: number, longitude: number],
    readonly [latitude: number, longitude: number],
  ];
  /** 表示範囲およびタイル要求範囲の上限。[[南, 西], [北, 東]] */
  readonly bounds: readonly [
    readonly [latitude: number, longitude: number],
    readonly [latitude: number, longitude: number],
  ];
  readonly tileUrlTemplate: string;
}

/**
 * 会場 (群馬大学荒牧キャンパス) は固定のため CMS では管理せずここに定数として持つ。
 * minNativeZoom / maxNativeZoom は生成済みタイルの縮尺範囲と一致させる (タイル生成側
 * generate-map-tiles の対象範囲・ズーム幅もこの値に合わせる)。maxZoom はそれを超えた
 * 電子ズーム (タイルの引き伸ばし) を許す表示上限、minZoom は SP 幅でもキャンパス全体が
 * 収まるよう minNativeZoom より低く取った縮小下限。
 */
export const CAMPUS_MAP_CONFIG: CampusMapConfig = {
  minZoom: 15.5,
  maxZoom: 21,
  minNativeZoom: 16,
  maxNativeZoom: 19,
  // OSM の群馬大学荒牧キャンパス敷地 (way 318677894) の外接矩形
  campusBounds: [
    [36.42745, 139.04137],
    [36.43391, 139.04822],
  ],
  bounds: [
    [36.4241, 139.034],
    [36.4395, 139.0588],
  ],
  tileUrlTemplate: '/map-tiles/{z}/{x}/{y}.webp',
};

/**
 * Leaflet の attribution は HTML として解釈されるため、リンクを含む文字列をそのまま定数として持つ。
 * OpenStreetMap Tile Usage Policy / Attribution Guidelines が要求する文言とリンク先を満たす。
 */
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** デスクトップとスマートフォンの境界。Tailwind のブレークポイントと対応させる */
export const MAP_BREAKPOINT = 'md';
