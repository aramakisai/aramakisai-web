import type { GlobalConfig } from 'payload';

import { accessFor } from '../access/payload-access';

import { FestivalMeta } from './festival-meta';
import { PageHome } from './page-home';

/** グローバルも登録口で access を結線する。読取は公開、更新は実行委員のみ。 */
const withAccess = (global: GlobalConfig): GlobalConfig => {
  const { read, update } = accessFor(global.slug);
  return { ...global, access: { read, update } };
};

/** グローバルの登録口。1 グローバル 1 ファイルとし、ここへ 1 行追加するだけにとどめる。 */
export const globals: GlobalConfig[] = [FestivalMeta, PageHome].map(withAccess);
