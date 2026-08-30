import * as migration_20260827_082729_initial from './20260827_082729_initial';
import * as migration_20260827_084210_owner_unique from './20260827_084210_owner_unique';
import * as migration_20260827_084500_schema_constraints from './20260827_084500_schema_constraints';
import * as migration_20260828_134029_authentik_sub from './20260828_134029_authentik_sub';

export const migrations = [
  {
    up: migration_20260827_082729_initial.up,
    down: migration_20260827_082729_initial.down,
    name: '20260827_082729_initial',
  },
  {
    up: migration_20260827_084210_owner_unique.up,
    down: migration_20260827_084210_owner_unique.down,
    name: '20260827_084210_owner_unique',
  },
  {
    up: migration_20260827_084500_schema_constraints.up,
    down: migration_20260827_084500_schema_constraints.down,
    name: '20260827_084500_schema_constraints',
  },
  {
    up: migration_20260828_134029_authentik_sub.up,
    down: migration_20260828_134029_authentik_sub.down,
    name: '20260828_134029_authentik_sub'
  },
];
