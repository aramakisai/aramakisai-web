"""背景図形の配置器。bgshape-rules.md が正。

入力 JSON (stdin または引数のファイル):
  pathname, platform ("pc"|"sp"), width, height, decorTop, decorBottom,
  text: [{x,y,w,h}, ...]        黒文字の外接矩形
  noOverlap: [{x,y,w,h}, ...]   文字リンク・白文字・ロゴ (このスクリプトが+10pxを足す)
  opaque: [{x,y,w,h}, ...]      カード・写真・地図・協賛枠・入力欄・塗りありボタン/タイル

出力 JSON (stdout): {"shapes": [...], "meta": {...}}
meta.deficit の値がいずれか > 0 なら非0終了。
"""
import sys, json, math
import numpy as np

TOKENS = ['ochre', 'olive', 'sage', 'salmon', 'rose', 'wisteria', 'aqua']
TEX = ['gradient', 'watercolor', 'grainy', 'halftone']
KINDS = ['circle', 'triangle', 'square', 'roundedSquare', 'quarterCircle', 'semicircle']
# tex5 のファイル名接頭辞と質感名の対応 (同じ質感の2枚から乱数で選ぶ)
L_TEX_FILES = {'gradient': ['L1', 'L5'], 'watercolor': ['L2', 'L6'], 'grainy': ['L3', 'L7'], 'halftone': ['L4', 'L8']}
S_TEX_FILES = {'gradient': ['S1', 'S4'], 'grainy': ['S2', 'S5'], 'halftone': ['S3', 'S6']}

RANGES = {
    'pc': {'L': (225, 400), 'S': (70, 120), 'D': (120, 175), 'gap': (520, 900)},
    'sp': {'L': (150, 250), 'S': (50, 80), 'D': (80, 115), 'gap': (420, 720)},
}

GUTTER = 24
GRID_N = 40  # 図形1つあたりのラスタ格子解像度 (面積比・重なり判定用)

# --- 決定的乱数: gencard.py の fnv1a/mulberry32 と同一実装 (JS 側の文字列ハッシュと揃える) ---
M32 = 0xffffffff


def _imul(a, b):
    return ((a & M32) * (b & M32)) & M32


def fnv1a(s):
    h = 2166136261
    for ch in s:
        b = ch.encode('utf-16-le')
        for i in range(0, len(b), 2):
            h ^= int.from_bytes(b[i:i + 2], 'little')
            h = _imul(h, 16777619)
    return h


def mulberry32(seed):
    t = [seed & M32]

    def r():
        t[0] = (t[0] + 0x6d2b79f5) & M32
        x = t[0]
        rr = _imul(x ^ (x >> 15), 1 | x)
        rr = ((rr + _imul(rr ^ (rr >> 7), 61 | rr)) & M32) ^ rr
        return ((rr ^ (rr >> 14)) & M32) / 4294967296
    return r


class Rng:
    def __init__(self, seed_str):
        self._r = mulberry32(fnv1a(seed_str))

    def f(self):
        return self._r()

    def uniform(self, lo, hi):
        return lo + self.f() * (hi - lo)

    def randint(self, n):
        return int(self.f() * n)

    def pick(self, seq):
        return seq[self.randint(len(seq))]

    def shuffle(self, seq):
        a = list(seq)
        for i in range(len(a) - 1, 0, -1):
            j = self.randint(i + 1)
            a[i], a[j] = a[j], a[i]
        return a


# --- 図形の局所形状 (中心原点、外接 s x s の窓の中に真偽で定義) ---
def local_grid(s, n=GRID_N):
    lin = (np.arange(n) + 0.5) / n * s - s / 2
    return np.meshgrid(lin, lin)


def kind_mask(kind, X, Y, s):
    if kind == 'circle':
        return X ** 2 + Y ** 2 <= (s / 2) ** 2
    if kind == 'square':
        return (np.abs(X) <= s / 2) & (np.abs(Y) <= s / 2)
    if kind == 'roundedSquare':
        r = s * 0.18  # ルールに数値指定なし。見本の角丸感に合わせた固定比率
        qx = np.abs(X) - (s / 2 - r)
        qy = np.abs(Y) - (s / 2 - r)
        d = np.hypot(np.clip(qx, 0, None), np.clip(qy, 0, None)) + np.minimum(np.maximum(qx, qy), 0) - r
        return d <= 0
    if kind == 'triangle':
        halfw = (Y + s / 2) / 2  # 頂点が上、底辺が下で外接正方形 s x s を満たす二等辺三角形
        return (np.abs(X) <= halfw) & (Y >= -s / 2) & (Y <= s / 2)
    if kind == 'quarterCircle':
        # 半径 s の扇、外接正方形の角を (-s/2,-s/2) に置くと弧が残り2辺の中点を通り s x s に収まる (ルール通り)
        return (X + s / 2) ** 2 + (Y + s / 2) ** 2 <= s ** 2
    if kind == 'semicircle':
        r = s / 2  # 直径 = 一辺。窓の下半分だけを占める (向きは回転で乱数化されるので固定でよい)
        return (X ** 2 + Y ** 2 <= r ** 2) & (Y >= 0)
    raise ValueError(kind)


def to_page(X, Y, rotation_deg, cx, cy):
    th = np.deg2rad(rotation_deg)
    ct, st = np.cos(th), np.sin(th)
    return X * ct - Y * st + cx, X * st + Y * ct + cy


def sample_shape(kind, s, rotation_deg, cx, cy):
    X, Y = local_grid(s)
    m = kind_mask(kind, X, Y, s)
    PX, PY = to_page(X, Y, rotation_deg, cx, cy)
    return PX[m], PY[m]


def bbox_radius(s):
    return s * math.sqrt(2) / 2  # 回転しても外接円は同じ (中心まわりの回転で不変)


def inf_bbox(D):
    w = 0.74 * D + D
    h = D
    return w, h


def inf_radius(D):
    w, h = inf_bbox(D)
    return 0.5 * math.hypot(w, h)


def sample_inf(D, rotation_deg, cx, cy, n=GRID_N):
    w, h = inf_bbox(D)
    lin_x = (np.arange(n) + 0.5) / n * w - w / 2
    lin_y = (np.arange(n) + 0.5) / n * h - h / 2
    X, Y = np.meshgrid(lin_x, lin_y)
    r = D / 2
    cxa, cxb = -0.37 * D, 0.37 * D  # 中心間距離 0.74D
    m = ((X - cxa) ** 2 + Y ** 2 <= r ** 2) | ((X - cxb) ** 2 + Y ** 2 <= r ** 2)
    PX, PY = to_page(X, Y, rotation_deg, cx, cy)
    return PX[m], PY[m]


def in_rect(px, py, rect):
    return (px >= rect['x']) & (px <= rect['x'] + rect['w']) & (py >= rect['y']) & (py <= rect['y'] + rect['h'])


def in_any(px, py, rects):
    out = np.zeros_like(px, dtype=bool)
    for r in rects:
        out |= in_rect(px, py, r)
    return out


def pad(rects, m):
    return [{'x': r['x'] - m, 'y': r['y'] - m, 'w': r['w'] + 2 * m, 'h': r['h'] + 2 * m} for r in rects]


def rects_intersect(a, b):
    return not (a['x'] + a['w'] < b['x'] or b['x'] + b['w'] < a['x'] or a['y'] + a['h'] < b['y'] or b['y'] + b['h'] < a['y'])


def bbox_of(px, py):
    return {'x': float(px.min()), 'y': float(py.min()), 'w': float(px.max() - px.min()), 'h': float(py.max() - py.min())}


def bounds_ok(px, py, width, decor_top, decor_bottom, overflow_frac, s):
    if py.min() < decor_top - 1e-6 or py.max() > decor_bottom + 1e-6:
        return False
    allow = overflow_frac * s
    left_over = max(0.0, -float(px.min()))
    right_over = max(0.0, float(px.max()) - width)
    return left_over <= allow + 1e-6 and right_over <= allow + 1e-6


def collision_ok(cx, cy, r, placed, gap):
    for p in placed:
        if math.hypot(cx - p['cx'], cy - p['cy']) < r + p['r'] + gap:
            return False
    return True


def gutter_count(shape_bbox, opaque_rects):
    return sum(1 for o in opaque_rects if rects_intersect(shape_bbox, o))


# --- 候補の検証 ---
def check_common(px, py, noOverlap_pad):
    return not in_any(px, py, noOverlap_pad).any()


def valid_S(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, s, overflow_frac, opaque_mode):
    if not bounds_ok(px, py, width, decor_top, decor_bottom, overflow_frac, s):
        return False
    if not check_common(px, py, noOverlap_pad):
        return False
    if in_any(px, py, text_pad).any():
        return False
    if opaque_mode == 'hard':
        if in_any(px, py, opaque).any():
            return False
    else:
        bb = bbox_of(px, py)
        if gutter_count(bb, opaque) >= 2:
            return False
        visible = ~in_any(px, py, opaque)
        if visible.mean() < 0.7:
            return False
    return True


def valid_L(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_raw, opaque, s, min_visible=0.6):
    if not bounds_ok(px, py, width, decor_top, decor_bottom, 0.4, s):
        return False
    if not check_common(px, py, noOverlap_pad):
        return False
    if text_raw:
        ratio = in_any(px, py, text_raw).mean()
        if ratio > 0.25:
            return False
    bb = bbox_of(px, py)
    if gutter_count(bb, opaque) >= 2:
        return False
    on_page = (px >= 0) & (px <= width)
    visible = on_page & ~in_any(px, py, opaque)
    if visible.mean() < min_visible:
        return False
    return True


def valid_inf(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, D,
              opaque_mode='hard', min_visible=1.0, text_mode='hard', text_raw=None):
    """∞ の配置検証。opaque_mode='hard' は従来通り不透明面と一切重ならないことを
    要求する。'soft' は L の最終緩和 (カードの裏に回す。可視率0.6→0.25、ガター禁止は
    維持) と同じ考え方を∞にも適用したもの。text_mode='hard' は文字と一切重ならない
    (従来通り)。'ratio25' は L と同じ基準(面積比25%以下)で黒文字との重なりを許す
    最終段。opaque と text の緩和は互いに独立(組み合わせない、単独でのみ緩める)。"""
    if not bounds_ok(px, py, width, decor_top, decor_bottom, 0.0, D):
        return False
    if not check_common(px, py, noOverlap_pad):
        return False
    if text_mode == 'hard':
        if in_any(px, py, text_pad).any():
            return False
    else:
        if text_raw:
            ratio = in_any(px, py, text_raw).mean()
            if ratio > 0.25:
                return False
    if opaque_mode == 'hard':
        if in_any(px, py, opaque).any():
            return False
    else:
        bb = bbox_of(px, py)
        if gutter_count(bb, opaque) >= 2:
            return False
        visible = ~in_any(px, py, opaque)
        if visible.mean() < min_visible:
            return False
    return True


# --- 配置本体 ---
def place(inp):
    pathname = inp['pathname']
    platform = inp['platform']
    width, height = float(inp['width']), float(inp['height'])
    decor_top, decor_bottom = float(inp['decorTop']), float(inp['decorBottom'])
    text_raw = inp.get('text', [])
    noOverlap_raw = inp.get('noOverlap', [])
    opaque = inp.get('opaque', [])
    text_pad = pad(text_raw, 10)
    noOverlap_pad = pad(noOverlap_raw, 10)

    R = RANGES[platform]
    rng = Rng(pathname)
    shapes = []
    placed = []  # collision 用 {cx,cy,r}

    # ---- ∞ ----
    count_inf = max(1, 1 + math.floor((height - 2500) / 2500))
    deficit_inf = 0
    d_lo0, d_hi0 = R['D']
    for _ in range(count_inf):
        ok = False
        shrink = 0
        while not ok and shrink < 40:
            d_hi = max(d_lo0, d_hi0 * (0.8 ** shrink))
            for _try in range(600):
                D = rng.uniform(d_lo0, d_hi)
                c1 = rng.pick(TOKENS)
                c2 = rng.pick([t for t in TOKENS if t != c1])
                rot = rng.uniform(-12, 12)
                x = rng.uniform(0, width)
                y = rng.uniform(decor_top, decor_bottom)
                px, py = sample_inf(D, rot, x, y)
                r = inf_radius(D)
                if not valid_inf(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, D, 'hard'):
                    continue
                if not collision_ok(x, y, r, placed, GUTTER):
                    continue
                placed.append({'cx': x, 'cy': y, 'r': r})
                shapes.append({'tier': 'Inf', 'kind': 'ring', 'cx': x, 'cy': y, 'size': D,
                                'rotation': rot, 'colors': [c1, c2], 'texture': None})
                ok = True
                break
            shrink += 1
        if not ok:
            # 最終緩和: L で承認済みの「カードの裏に回す」手法(可視率0.6→0.25、
            # ガター禁止・はみ出し禁止は維持)を∞にも適用する最小限の追加段。
            # サイズは下限固定 (これ以上縮めない)、位置のみ広く再探索する。
            # 有効な位置の割合は多くの画面でごく僅かなため、600回では乱数の引きに
            # よって取りこぼすことがある (実測: /topics で 600 回では失敗、6000回で成功)。
            D = d_lo0
            for _try in range(6000):
                c1 = rng.pick(TOKENS)
                c2 = rng.pick([t for t in TOKENS if t != c1])
                rot = rng.uniform(-12, 12)
                x = rng.uniform(0, width)
                y = rng.uniform(decor_top, decor_bottom)
                px, py = sample_inf(D, rot, x, y)
                r = inf_radius(D)
                if not valid_inf(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, D,
                                  'soft', 0.25):
                    continue
                if not collision_ok(x, y, r, placed, GUTTER):
                    continue
                placed.append({'cx': x, 'cy': y, 'r': r})
                shapes.append({'tier': 'Inf', 'kind': 'ring', 'cx': x, 'cy': y, 'size': D,
                                'rotation': rot, 'colors': [c1, c2], 'texture': None})
                ok = True
                break
        if not ok:
            # 第3段(最終): L と同じ基準(黒文字との重なり面積比25%以下)で∞にも
            # 文字との重なりを許す。opaque の扱いは 'hard'(不透明面とは重ならない)
            # のまま据え置き、緩和は文字の軸だけを追加する(段2のカード裏緩和とは
            # 独立、組み合わせない)。重なった文字への白い光彩は emit_figma.py の
            # 既存ロジック(全 tier 共通)がそのまま付与する。
            D = d_lo0
            for _try in range(6000):
                c1 = rng.pick(TOKENS)
                c2 = rng.pick([t for t in TOKENS if t != c1])
                rot = rng.uniform(-12, 12)
                x = rng.uniform(0, width)
                y = rng.uniform(decor_top, decor_bottom)
                px, py = sample_inf(D, rot, x, y)
                r = inf_radius(D)
                if not valid_inf(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, D,
                                  opaque_mode='hard', text_mode='ratio25', text_raw=text_raw):
                    continue
                if not collision_ok(x, y, r, placed, GUTTER):
                    continue
                placed.append({'cx': x, 'cy': y, 'r': r})
                shapes.append({'tier': 'Inf', 'kind': 'ring', 'cx': x, 'cy': y, 'size': D,
                                'rotation': rot, 'colors': [c1, c2], 'texture': None})
                ok = True
                break
        if not ok:
            deficit_inf += 1

    # ---- L ----
    l_lo, l_hi = R['L']
    gap_lo, gap_hi = R['gap']
    l_slots = []  # (y_used_for_walk, placed_dict_or_None)
    y_prev = None
    deficit_l = 0
    MAX_SHRINK = 15
    while True:
        gap = rng.uniform(gap_lo, gap_hi)
        y0 = decor_top + rng.uniform(0, gap) if y_prev is None else y_prev + gap
        if y0 > decor_bottom:
            break

        def draw_and_try(y, s_range, min_visible=0.6):
            kind = rng.pick(KINDS)
            s = rng.uniform(*s_range)
            rot = rng.randint(360)
            x = rng.uniform(-0.4 * s, width + 0.4 * s)
            px, py = sample_shape(kind, s, rot, x, y)
            if (valid_L(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_raw, opaque, s, min_visible)
                    and collision_ok(x, y, bbox_radius(s), placed, GUTTER)):
                return {'kind': kind, 's': s, 'rot': rot, 'cx': x, 'cy': y}
            return None

        def search(min_visible):
            result = None
            k = 0
            while result is None and k < MAX_SHRINK:
                cur_hi = max(l_lo, l_hi * (0.85 ** k))
                s_range = (l_lo, cur_hi)
                for _try in range(200):
                    result = draw_and_try(y0, s_range, min_visible)
                    if result:
                        break
                if result is None:
                    for _try in range(200):
                        y_j = y0 + rng.uniform(-gap / 4, gap / 4)
                        y_j = min(max(y_j, decor_top), decor_bottom)
                        result = draw_and_try(y_j, s_range, min_visible)
                        if result:
                            break
                k += 1
            return result

        # 通常の縦位置ずらし・縮小 (可視率下限0.6) で置けない場合の最終手段として、
        # カード等の不透明な面が本文列を埋めて置き場がない画面向けに、可視率下限を
        # 0.25 まで緩めてカードの裏に回す配置を許す (ガター禁止・はみ出し0.4は維持)
        result = search(0.6)
        if result is None:
            result = search(0.25)

        if result:
            r = bbox_radius(result['s'])
            placed.append({'cx': result['cx'], 'cy': result['cy'], 'r': r})
            shapes.append({'tier': 'L', 'kind': result['kind'], 'cx': result['cx'], 'cy': result['cy'],
                            'size': result['s'], 'rotation': result['rot'], 'colors': None, 'texture': None})
            y_prev = result['cy']
            l_slots.append(shapes[-1])
        else:
            deficit_l += 1
            y_prev = y0

    # ---- 質感割当 (L): 配置と同じ乱数列の続き ----
    count_l = len(l_slots)
    perm = rng.shuffle(TEX)
    if count_l and 'watercolor' not in perm[:count_l]:
        perm.remove('watercolor')
        perm.insert(0, 'watercolor')
    if count_l:
        assigned = [perm[i] if i < 4 else rng.pick(TEX) for i in range(count_l)]
        for shp, texname in zip(l_slots, assigned):
            shp['texture'] = rng.pick(L_TEX_FILES[texname])

    # ---- S ----
    s_lo, s_hi = R['S']
    count_S = max(math.floor((decor_bottom - decor_top) / 400), 4 - count_l)
    s_shapes = []

    def draw_S(y_range, x_overflow, s_range):
        kind = rng.pick(KINDS)
        s = rng.uniform(*s_range)
        rot = rng.randint(360)
        x = rng.uniform(-x_overflow * s, width + x_overflow * s)
        y = rng.uniform(*y_range)
        return kind, s, rot, x, y

    def attempt_S(n_attempts, s_range, gap, x_overflow, opaque_mode):
        placed_now = 0
        for _ in range(n_attempts):
            if len(s_shapes) >= count_S:
                break
            kind, s, rot, x, y = draw_S((decor_top, decor_bottom), x_overflow, s_range)
            px, py = sample_shape(kind, s, rot, x, y)
            if not valid_S(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, s, x_overflow, opaque_mode):
                continue
            r = bbox_radius(s)
            if not collision_ok(x, y, r, placed, gap):
                continue
            placed.append({'cx': x, 'cy': y, 'r': r})
            s_shapes.append({'tier': 'S', 'kind': kind, 'cx': x, 'cy': y, 'size': s, 'rotation': rot,
                              'colors': None, 'texture': None})
            placed_now += 1
        return placed_now

    if count_S > 0:
        attempt_S(count_S * 200, (s_lo, s_hi), GUTTER, 0.0, 'hard')
        k = 1
        while len(s_shapes) < count_S and k <= MAX_SHRINK:
            cur_hi = max(s_lo, s_hi * (0.85 ** k))
            attempt_S(200, (s_lo, cur_hi), GUTTER, 0.0, 'hard')
            k += 1
        if len(s_shapes) < count_S:
            attempt_S(200, (s_lo, s_lo), 12, 0.0, 'hard')
        if len(s_shapes) < count_S:
            attempt_S(200, (s_lo, s_lo), 12, 0.5, 'soft')

    deficit_s = count_S - len(s_shapes)
    if deficit_s < 0:
        deficit_s = 0

    # ---- 質感割当 (S): Lで使われなかった質感 (水彩以外) を先頭から、残りは3質感から乱数 ----
    if s_shapes:
        l_tex_names = []
        for shp in l_slots:
            for name, files in L_TEX_FILES.items():
                if shp['texture'] in files:
                    l_tex_names.append(name)
                    break
        unused = [t for t in perm if t != 'watercolor' and t not in l_tex_names]
        s_tex_order = list(S_TEX_FILES.keys())
        for i, shp in enumerate(s_shapes):
            name = unused[i] if i < len(unused) else rng.pick(s_tex_order)
            shp['texture'] = rng.pick(S_TEX_FILES[name])

    shapes.extend(s_shapes)

    used_textures = set()
    for shp in shapes:
        if shp['texture']:
            # L と S でカテゴリ名が重なる (gradient/grainy/halftone) ため、単純に
            # マージした辞書で引くと同名キーが上書きされ、L 側のファイル名
            # (L3/L7 等) がどのカテゴリにも一致しなくなる。tier ごとの辞書を使う。
            tex_files = L_TEX_FILES if shp['tier'] == 'L' else S_TEX_FILES
            for name, files in tex_files.items():
                if shp['texture'] in files:
                    used_textures.add(name)
    texture_coverage_ok = used_textures == set(TEX) or (count_l == 0 and count_S == 0)

    meta = {
        'target': {'Inf': count_inf, 'L': count_l + deficit_l, 'S': count_S},
        'placed': {'Inf': count_inf - deficit_inf, 'L': count_l, 'S': len(s_shapes)},
        'deficit': {'Inf': deficit_inf, 'L': deficit_l, 'S': deficit_s},
        'texture_coverage_ok': texture_coverage_ok,
    }
    for shp in shapes:
        shp['cx'] = round(shp['cx'], 2)
        shp['cy'] = round(shp['cy'], 2)
        shp['size'] = round(shp['size'], 2)
        shp['rotation'] = round(shp['rotation'], 2)
    return shapes, meta


def _count_by_tier(shapes):
    c = {'Inf': 0, 'L': 0, 'S': 0}
    for s in shapes:
        c[s['tier']] = c.get(s['tier'], 0) + 1
    return c


def reuse_place(orig, obstacles):
    """検索結果・0件・空状態など、同じ URL の状態違い画面向けの流用モード。
    元ページ (`orig`、place() の出力そのもの、または {"shapes":[...]} 形式) の
    図形をそのまま使い、この画面の除外領域 (decorTop/decorBottom)・文字・
    不透明な面 (opaque)・文字リンク等 (noOverlap) に反する図形だけを落とす。
    位置・サイズ・回転・質感は一切変えない。∞ の下限1個と4質感必須はこのモードでは
    免除する(ちらつき防止のため、条件ごとに配置し直さないのが前提のため)。
    """
    orig_shapes = orig['shapes'] if isinstance(orig, dict) and 'shapes' in orig else orig
    width = float(obstacles['width'])
    decor_top, decor_bottom = float(obstacles['decorTop']), float(obstacles['decorBottom'])
    text_raw = obstacles.get('text', [])
    noOverlap_raw = obstacles.get('noOverlap', [])
    opaque = obstacles.get('opaque', [])
    text_pad = pad(text_raw, 10)
    noOverlap_pad = pad(noOverlap_raw, 10)

    kept, dropped = [], []
    for shp in orig_shapes:
        tier = shp.get('tier')
        if tier == 'Inf':
            px, py = sample_inf(shp['size'], shp['rotation'], shp['cx'], shp['cy'])
            ok = (bounds_ok(px, py, width, decor_top, decor_bottom, 0.0, shp['size'])
                  and check_common(px, py, noOverlap_pad)
                  and not in_any(px, py, text_pad).any()
                  and not in_any(px, py, opaque).any())
        elif tier == 'L':
            px, py = sample_shape(shp['kind'], shp['size'], shp['rotation'], shp['cx'], shp['cy'])
            ok = valid_L(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_raw, opaque, shp['size'])
        elif tier == 'S':
            px, py = sample_shape(shp['kind'], shp['size'], shp['rotation'], shp['cx'], shp['cy'])
            ok = valid_S(px, py, width, decor_top, decor_bottom, noOverlap_pad, text_pad, opaque, shp['size'], 0.0, 'hard')
        else:
            ok = False
        (kept if ok else dropped).append(shp)

    meta = {
        'mode': 'reuse',
        'source': _count_by_tier(orig_shapes),
        'kept': _count_by_tier(kept),
        'dropped': _count_by_tier(dropped),
    }
    return kept, meta


def main():
    if '--selftest' in sys.argv:
        selftest()
        selftest_short_page()
        selftest_card_column_relax()
        selftest_inf_card_column_relax()
        selftest_inf_text_overlap_relax()
        selftest_emit_pivot_matches_place()
        selftest_reuse_mode()
        print('selftest ok', file=sys.stderr)
        return
    if '--reuse' in sys.argv:
        args = [a for a in sys.argv[1:] if not a.startswith('--')]
        if len(args) < 2:
            print('usage: place.py --reuse <元ページのshapes.json> <この画面のobstacles.json>', file=sys.stderr)
            sys.exit(2)
        orig = json.load(open(args[0], encoding='utf-8'))
        obstacles = json.load(open(args[1], encoding='utf-8'))
        kept, meta = reuse_place(orig, obstacles)
        print(json.dumps({'shapes': kept, 'meta': meta}, ensure_ascii=False, indent=2))
        return
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    raw = open(args[0], encoding='utf-8').read() if args else sys.stdin.read()
    inp = json.loads(raw)
    shapes, meta = place(inp)
    print(json.dumps({'shapes': shapes, 'meta': meta}, ensure_ascii=False, indent=2))
    if any(meta['deficit'].values()):
        print(f"deficit: {meta['deficit']}", file=sys.stderr)
        sys.exit(1)


def selftest():
    inp = {
        'pathname': '/news/sample', 'platform': 'pc', 'width': 1440, 'height': 6200,
        'decorTop': 800, 'decorBottom': 5700,
        'text': [{'x': 200, 'y': 1000, 'w': 400, 'h': 60}, {'x': 200, 'y': 2000, 'w': 600, 'h': 200}],
        'noOverlap': [{'x': 900, 'y': 1200, 'w': 120, 'h': 40}],
        'opaque': [{'x': 300, 'y': 3000, 'w': 500, 'h': 300}, {'x': 900, 'y': 3000, 'w': 400, 'h': 300}],
    }
    shapes, meta = place(inp)
    assert meta['deficit'] == {'Inf': 0, 'L': 0, 'S': 0}, meta
    assert meta['texture_coverage_ok'], meta
    assert meta['placed']['Inf'] == max(1, 1 + math.floor((6200 - 2500) / 2500))
    assert meta['placed']['S'] == max(math.floor((5700 - 800) / 400), 4 - meta['placed']['L'])

    noOverlap_pad = pad(inp['noOverlap'], 10)
    for i, a in enumerate(shapes):
        ra = a['size'] * math.sqrt(2) / 2 if a['tier'] != 'Inf' else inf_radius(a['size'])
        for b in shapes[i + 1:]:
            rb = b['size'] * math.sqrt(2) / 2 if b['tier'] != 'Inf' else inf_radius(b['size'])
            d = math.hypot(a['cx'] - b['cx'], a['cy'] - b['cy'])
            assert d >= ra + rb + GUTTER - 1e-6, (a, b, d, ra + rb + GUTTER)

    for shp in shapes:
        if shp['tier'] == 'Inf':
            px, py = sample_inf(shp['size'], shp['rotation'], shp['cx'], shp['cy'])
        else:
            px, py = sample_shape(shp['kind'], shp['size'], shp['rotation'], shp['cx'], shp['cy'])
        assert py.min() >= 800 - 1e-6 and py.max() <= 5700 + 1e-6, shp
        assert not in_any(px, py, noOverlap_pad).any(), shp

    used = set()
    for shp in shapes:
        if shp['texture']:
            tex_files = L_TEX_FILES if shp['tier'] == 'L' else S_TEX_FILES
            for name, files in tex_files.items():
                if shp['texture'] in files:
                    used.add(name)
    assert used == set(TEX), used


def selftest_short_page():
    """装飾可能高が短いページ (ヘッダー直下からフッター直前までが ~800px) でも
    4質感を必ず網羅できることを確認する (S = max(floor(高/400), 4-L) の回帰)。"""
    inp = {
        'pathname': '/news', 'platform': 'pc', 'width': 1440, 'height': 1478,
        'decorTop': 80, 'decorBottom': 880,
        'text': [], 'noOverlap': [], 'opaque': [],
    }
    shapes, meta = place(inp)
    assert meta['deficit'] == {'Inf': 0, 'L': 0, 'S': 0}, meta
    assert meta['texture_coverage_ok'], meta
    assert meta['placed']['L'] + meta['placed']['S'] >= 4, meta
    assert meta['target']['S'] == max(math.floor((880 - 80) / 400), 4 - meta['placed']['L']), meta

    # 狭い帯では L と先に置いた ∞ がぶつかりやすいので、複数の種で全ペアの間隔を検査する
    for pn in ['/', '/faq', '/news', '/topics', '/exhibitions', '/news/sample']:
        for pf, w in [('pc', 1440), ('sp', 390)]:
            shapes, _ = place({**inp, 'pathname': pn, 'platform': pf, 'width': w})
            for i, a in enumerate(shapes):
                ra = inf_radius(a['size']) if a['tier'] == 'Inf' else bbox_radius(a['size'])
                for b in shapes[i + 1:]:
                    rb = inf_radius(b['size']) if b['tier'] == 'Inf' else bbox_radius(b['size'])
                    d = math.hypot(a['cx'] - b['cx'], a['cy'] - b['cy'])
                    assert d >= ra + rb + GUTTER - 1e-6, (pn, pf, a['tier'], b['tier'], d)


def selftest_card_column_relax():
    """SP のカード一覧 (幅390、カード358幅が16px間隔で縦に並ぶ) のように、不透明な
    カードが本文列をほぼ埋めて通常の可視率 (0.6) では L を置けない画面でも、可視率
    緩和 (→0.25) で L が目標数まで置けることを確認する回帰。緩和後もガター (面と
    面の隙間に見える配置) 禁止・はみ出し0.4上限は維持されることも検査する。"""
    W = 390
    card_w, gap_h, card_h, n_cards = 358, 16, 200, 10
    cards = []
    y = 100
    for _ in range(n_cards):
        cards.append({'x': 16, 'y': y, 'w': card_w, 'h': card_h})
        y += card_h + gap_h
    decor_top, decor_bottom = 80, y + 40

    inp = {
        'pathname': '/topics', 'platform': 'sp', 'width': W, 'height': decor_bottom + 100,
        'decorTop': decor_top, 'decorBottom': decor_bottom,
        'text': [], 'noOverlap': [], 'opaque': cards,
    }
    shapes, meta = place(inp)
    assert meta['placed']['L'] == meta['target']['L'] and meta['deficit']['L'] == 0, meta

    l_shapes = [s for s in shapes if s['tier'] == 'L']
    assert len(l_shapes) >= 1, meta
    for s in l_shapes:
        px, py = sample_shape(s['kind'], s['size'], s['rotation'], s['cx'], s['cy'])
        bb = bbox_of(px, py)
        assert gutter_count(bb, cards) < 2, s  # ガター禁止は緩和後も維持
        allow = 0.4 * s['size']  # はみ出し上限0.4は変えない
        assert px.min() >= -allow - 1e-6 and px.max() <= W + allow + 1e-6, s


def selftest_inf_card_column_relax():
    """トピック一覧/SP (382:834) 実測相当: ほぼ全幅の不透明カード3枚が並び、通常の
    ∞配置 (不透明面と一切重ならない) では最小サイズ (D下限) でも置き場がない画面で、
    L と同じ最終緩和 (可視率0.6→0.25、ガター禁止・はみ出し禁止は維持) を∞にも
    適用すると目標の1個が置けることを確認する回帰 (実際の抽出値をそのまま使う)。"""
    inp = {
        'pathname': '/topics', 'platform': 'sp', 'width': 390, 'height': 2162.5,
        'decorTop': 64, 'decorBottom': 1050.5,
        'text': [
            {'x': 106.5, 'y': 80, 'w': 177, 'h': 53},
            {'x': 175, 'y': 263.5, 'w': 24, 'h': 24},
            {'x': 175, 'y': 556, 'w': 24, 'h': 24},
            {'x': 175, 'y': 848.5, 'w': 24, 'h': 24},
        ],
        'noOverlap': [
            {'x': 32, 'y': 373.5, 'w': 220, 'h': 28},
            {'x': 32, 'y': 666, 'w': 237, 'h': 28},
            {'x': 32, 'y': 958.5, 'w': 213, 'h': 28},
        ],
        'opaque': [
            {'x': 16, 'y': 149, 'w': 358, 'h': 269},
            {'x': 16, 'y': 441.5, 'w': 358, 'h': 269},
            {'x': 16, 'y': 734, 'w': 358, 'h': 269},
        ],
    }
    shapes, meta = place(inp)
    assert meta['target']['Inf'] == 1, meta
    assert meta['placed']['Inf'] == 1 and meta['deficit']['Inf'] == 0, meta

    inf_shapes = [s for s in shapes if s['tier'] == 'Inf']
    assert len(inf_shapes) == 1, shapes
    s = inf_shapes[0]
    assert s['size'] == RANGES['sp']['D'][0], s  # 最終緩和はサイズ下限固定
    px, py = sample_inf(s['size'], s['rotation'], s['cx'], s['cy'])
    bb = bbox_of(px, py)
    assert gutter_count(bb, inp['opaque']) < 2, s  # ガター禁止は緩和後も維持
    assert px.min() >= -1e-6 and px.max() <= inp['width'] + 1e-6, s  # ∞ ははみ出し不可 (0%)
    assert py.min() >= inp['decorTop'] - 1e-6 and py.max() <= inp['decorBottom'] + 1e-6, s
    text_pad = pad(inp['text'], 10)
    noOverlap_pad = pad(inp['noOverlap'], 10)
    assert not in_any(px, py, text_pad).any(), s  # 文字とは重ならない (緩和対象外)
    assert not in_any(px, py, noOverlap_pad).any(), s


def selftest_inf_text_overlap_relax():
    """お知らせ一覧/SP (400:954) 実測相当: 不透明面が1つも無く、日付・タイトルの
    黒文字が装飾可能帯のほぼ全域を占める画面では、段2(カードの裏に回す緩和)は
    無力なため通常段・段2とも置けない。段3(L と同じ基準: 黒文字との重なり面積比
    25%以下まで許す。opaque は従来通り重ならない)を適用すると目標の1個が置ける
    ことを確認する回帰(実際の抽出値をそのまま使う)。"""
    inp = {
        'pathname': '/news', 'platform': 'sp', 'width': 390, 'height': 2128,
        'decorTop': 64, 'decorBottom': 1016,
        'text': [
            {'x': 106, 'y': 80, 'w': 178, 'h': 53},
            {'x': 16, 'y': 177, 'w': 108, 'h': 22}, {'x': 152, 'y': 161, 'w': 222, 'h': 54},
            {'x': 16, 'y': 256, 'w': 109, 'h': 22}, {'x': 152, 'y': 240, 'w': 222, 'h': 54},
            {'x': 16, 'y': 335, 'w': 106, 'h': 22}, {'x': 152, 'y': 319, 'w': 222, 'h': 54},
            {'x': 16, 'y': 414, 'w': 100, 'h': 22}, {'x': 152, 'y': 398, 'w': 222, 'h': 54},
            {'x': 16, 'y': 493, 'w': 110, 'h': 22}, {'x': 152, 'y': 477, 'w': 222, 'h': 54},
            {'x': 16, 'y': 572, 'w': 109, 'h': 22}, {'x': 152, 'y': 556, 'w': 222, 'h': 54},
            {'x': 16, 'y': 651, 'w': 107, 'h': 22}, {'x': 152, 'y': 635, 'w': 222, 'h': 54},
            {'x': 16, 'y': 730, 'w': 108, 'h': 22}, {'x': 152, 'y': 714, 'w': 222, 'h': 54},
            {'x': 16, 'y': 795.5, 'w': 105, 'h': 22}, {'x': 152, 'y': 793, 'w': 208, 'h': 27},
            {'x': 16, 'y': 861, 'w': 96, 'h': 22}, {'x': 152, 'y': 845, 'w': 222, 'h': 54},
            {'x': 89, 'y': 938, 'w': 24, 'h': 24}, {'x': 190, 'y': 938, 'w': 10, 'h': 20},
            {'x': 238, 'y': 938, 'w': 10, 'h': 20}, {'x': 281, 'y': 938, 'w': 24, 'h': 24},
        ],
        'noOverlap': [{'x': 143.5, 'y': 938, 'w': 7, 'h': 20}],
        'opaque': [],
    }
    shapes, meta = place(inp)
    assert meta['target']['Inf'] == 1, meta
    assert meta['placed']['Inf'] == 1 and meta['deficit']['Inf'] == 0, meta

    inf_shapes = [s for s in shapes if s['tier'] == 'Inf']
    assert len(inf_shapes) == 1, shapes
    s = inf_shapes[0]
    assert s['size'] == RANGES['sp']['D'][0], s  # 最終緩和はサイズ下限固定
    px, py = sample_inf(s['size'], s['rotation'], s['cx'], s['cy'])
    assert px.min() >= -1e-6 and px.max() <= inp['width'] + 1e-6, s  # ∞ ははみ出し不可 (0%)
    assert py.min() >= inp['decorTop'] - 1e-6 and py.max() <= inp['decorBottom'] + 1e-6, s
    noOverlap_pad = pad(inp['noOverlap'], 10)
    assert not in_any(px, py, noOverlap_pad).any(), s
    # opaque が無いためガター判定は対象外。文字との重なりは面積比25%以下 (L と同じ基準)
    ratio = in_any(px, py, inp['text']).mean()
    assert ratio <= 0.25 + 1e-9, (ratio, s)


def selftest_reuse_mode():
    """検索結果・0件等の状態違い画面向け流用モード: 元の配置から、新しい画面の
    制約に反する図形だけが落ちて、残りは位置・サイズ・質感が変わらないことを確認する。
    ∞ の下限1個・4質感必須はこのモードでは検査しない(免除)。"""
    orig_inp = {
        'pathname': '/news/sample', 'platform': 'pc', 'width': 1440, 'height': 6200,
        'decorTop': 800, 'decorBottom': 5700,
        'text': [], 'noOverlap': [], 'opaque': [],
    }
    orig_shapes, orig_meta = place(orig_inp)
    assert len(orig_shapes) > 0

    # 新しい画面 (例: 0件状態): 元より装飾可能高が狭く(フッターが高い等)、
    # 上部に大きな空状態イラスト (opaque) が追加されている想定
    new_obstacles = {
        'pathname': '/news/sample', 'platform': 'pc', 'width': 1440, 'height': 6200,
        'decorTop': 800, 'decorBottom': 5000,
        'text': [{'x': 500, 'y': 2000, 'w': 400, 'h': 300}],
        'noOverlap': [],
        'opaque': [{'x': 400, 'y': 900, 'w': 600, 'h': 600}],
    }
    kept, meta = reuse_place({'shapes': orig_shapes, 'meta': orig_meta}, new_obstacles)
    assert meta['mode'] == 'reuse'
    assert 0 < len(kept) <= len(orig_shapes), meta

    kept_keys = {(s['cx'], s['cy']) for s in kept}
    # 残った図形は元と完全に一致する (位置・サイズ・回転・質感を変えない)
    for s in orig_shapes:
        if (s['cx'], s['cy']) in kept_keys:
            match = next(k for k in kept if k['cx'] == s['cx'] and k['cy'] == s['cy'])
            assert match == s, (match, s)

    # 落ちた図形は新しい制約 (装飾可能高・opaque・text) のいずれかに違反しているはず
    dropped = [s for s in orig_shapes if (s['cx'], s['cy']) not in kept_keys]
    assert len(dropped) > 0, 'このテストケースでは少なくとも1個は落ちる設計のはず'
    new_text_pad = pad(new_obstacles['text'], 10)
    for s in dropped:
        if s['tier'] == 'Inf':
            px, py = sample_inf(s['size'], s['rotation'], s['cx'], s['cy'])
        else:
            px, py = sample_shape(s['kind'], s['size'], s['rotation'], s['cx'], s['cy'])
        violates_bounds = py.max() > new_obstacles['decorBottom'] + 1e-6 or py.min() < new_obstacles['decorTop'] - 1e-6
        violates_opaque = in_any(px, py, new_obstacles['opaque']).any()
        violates_text = in_any(px, py, new_text_pad).any()
        assert violates_bounds or violates_opaque or violates_text, s


# --- emit_figma.py の centerAt (Figma 側での回転・配置) を Python で再現し、
#     place.py が検証した中心・外接範囲と一致するかを検算する。
#     Figma 実機を使わずに座標変換のリグレッションを取れるようにするためのもの。
def _emit_local_boundary(kind, s, n=400):
    if kind == 'circle':
        return [(s / 2 + s / 2 * math.cos(2 * math.pi * i / n), s / 2 + s / 2 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    if kind in ('square', 'roundedSquare'):
        return [(0, 0), (s, 0), (s, s), (0, s)]
    if kind == 'triangle':
        return [(s / 2, 0), (0, s), (s, s)]
    if kind == 'quarterCircle':
        pts = [(0, 0), (s, 0), (0, s)]
        for i in range(n + 1):
            th = math.pi / 2 * i / n
            pts.append((s * math.cos(th), s * math.sin(th)))
        return pts
    if kind == 'semicircle':
        r = s / 2
        pts = [(0, 0), (s, 0)]
        for i in range(n + 1):
            th = math.pi * i / n
            pts.append((r + r * math.cos(th), r * math.sin(th)))
        return pts
    raise ValueError(kind)


def _emit_local_wh(kind, s):
    return (s, s / 2) if kind == 'semicircle' else (s, s)


def _emit_pivot_frac(kind):
    # emit_figma.py の PIVOT_FRAC と同じ値。semicircle だけローカル座標の
    # bbox 高さが窓の半分しかないため、窓の中心 (place.py の回転原点) は
    # ローカル bbox の上端 (y比率0) に来る。他の kind は窓=ローカルbboxなので中心 (0.5,0.5)。
    return (0.5, 0.0) if kind == 'semicircle' else (0.5, 0.5)


def _figma_rotate(dx, dy, deg):
    """Figma の rotation プロパティが実機で示す実際の回転式 (2 種類のノード種別
    (VECTOR・RECTANGLE) の absoluteTransform を実測して確認済み)。place.py の
    to_page とは符号が逆になる: node.rotation=θ の absoluteTransform は
    to_page(-θ) と同じ行列になる。emit_figma.py はこれを見越して角度を反転させて
    node.rotation に渡す (centerAt 内の `-(rotationDeg || 0)`) ので、ここでも
    同じ式で検算する。"""
    th = math.radians(deg)
    ct, st = math.cos(th), math.sin(th)
    return dx * ct + dy * st, -dx * st + dy * ct


def _emit_corrected_points(kind, s, rotation_deg, cx, cy, pivot_q):
    """centerAt (修正後) の再現: emit_figma.py が実際に node.rotation へ渡す値
    (-rotation_deg) で Figma の実回転式 (_figma_rotate) を適用したあと、回転後の
    基準点 (pivot_frac) が (cx,cy) に来るよう平行移動だけで補正する。Figma の実際の
    回転軸 (pivot_q) がどこであっても結果が一致するはず。"""
    pts = _emit_local_boundary(kind, s)
    w, h = _emit_local_wh(kind, s)
    fx, fy = _emit_pivot_frac(kind)
    plocal = (fx * w, fy * h)
    node_rotation = -rotation_deg

    def rot(px, py):
        dx, dy = px - pivot_q[0], py - pivot_q[1]
        rx, ry = _figma_rotate(dx, dy, node_rotation)
        return pivot_q[0] + rx, pivot_q[1] + ry

    rotated = [rot(x, y) for x, y in pts]
    rp = rot(*plocal)
    dx, dy = cx - rp[0], cy - rp[1]
    return [(x + dx, y + dy) for x, y in rotated]


def selftest_emit_pivot_matches_place():
    """place.py が検証した中心・外接範囲と、emit_figma.py (修正後の centerAt) が
    実際に Figma へ置く図形の外接範囲が一致することを検算する。特に quarterCircle・
    semicircle のような非対称図形 (回転中心まわりの180度対称性が無い図形) は、
    「回転後の外接矩形の中心を目標座標に合わせる」旧ロジックだと位置がずれるため、
    2種類の異なる回転軸 (Figma の実際の軸を知らなくても良いことの確認) で検算する。"""
    cases = [
        ('quarterCircle', 277.48, 14, 1339.62, 380.33),  # FAQ PC repro相当 (∞と重なって見えた個体)
        ('quarterCircle', 100.84, 29, 968.22, 825.87),   # 399:1003 相当
        ('semicircle', 150.0, 200, 500.0, 900.0),
        ('triangle', 90.0, 333, 300.0, 400.0),
        ('circle', 120.0, 45, 200.0, 300.0),
        ('square', 90.0, 10, 600.0, 700.0),
    ]
    for kind, s, rot, cx, cy in cases:
        ref_px, ref_py = sample_shape(kind, s, rot, cx, cy)
        ref_bbox = (ref_px.min(), ref_px.max(), ref_py.min(), ref_py.max())
        tol = max(2.0, s * 0.03)  # place.py 側はグリッド離散化 (GRID_N=40) の誤差を含む
        for pivot_q in [(0.0, 0.0), (s * 0.2, s * 0.9)]:
            pts = _emit_corrected_points(kind, s, rot, cx, cy, pivot_q)
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            got_bbox = (min(xs), max(xs), min(ys), max(ys))
            for ref_v, got_v, label in zip(ref_bbox, got_bbox, ['xmin', 'xmax', 'ymin', 'ymax']):
                assert abs(ref_v - got_v) <= tol, (kind, rot, pivot_q, label, ref_v, got_v)

    # ∞ の外接円 (glow ヒットボックス・衝突判定の両方が使う inf_radius) が
    # 実際に両方の輪を覆っているかどうかも検算する
    for D, rot in [(163.1, -5.74), (120.0, 0.0), (175.0, 33.0)]:
        cx, cy = 500.0, 500.0
        px, py = sample_inf(D, rot, cx, cy)
        r = inf_radius(D)
        dist = np.hypot(px - cx, py - cy)
        assert dist.max() <= r + 1e-6, (D, rot, dist.max(), r)


if __name__ == '__main__':
    main()
