import type { GlobalConfig } from 'payload';

import { accessFor } from '../access/payload-access';
import { isHiddenInAdmin } from '../access/policy';
import { toCmsUser } from '../access/roles';
import { NAV_GROUPS } from '../nav-groups';

import { FestivalMeta } from './festival-meta';
import { PageHome } from './page-home';
import { SignageSettings } from './signage-settings';
import { SiteSettings } from './site-settings';

/** グローバルも登録口で access を結線する。読取は公開、更新は実行委員のみ。 */
const withAccess = (global: GlobalConfig): GlobalConfig => {
  const { read, update } = accessFor(global.slug);
  return {
    ...global,
    access: { read, update },
    admin: {
      ...global.admin,
      group: NAV_GROUPS[global.slug],
      hidden: ({ user }) => global.admin?.hidden === true || isHiddenInAdmin(toCmsUser(user), global.slug),
    },
  };
};

/** グローバルの登録口。1 グローバル 1 ファイルとし、ここへ 1 行追加するだけにとどめる。 */
export const globals: GlobalConfig[] = [SiteSettings, FestivalMeta, PageHome, SignageSettings].map(withAccess);
