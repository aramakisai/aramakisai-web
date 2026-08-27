import * as migration_20260827_082729_initial from './20260827_082729_initial';
import * as migration_20260827_084210_owner_unique from './20260827_084210_owner_unique';
import * as migration_20260827_084500_schema_constraints from './20260827_084500_schema_constraints';

export const migrations = [
  {
    up: migration_20260827_082729_initial.up,
    down: migration_20260827_082729_initial.down,
    name: '20260827_082729_initial',
  },
  {
    up: migration_20260827_084210_owner_unique.up,
    down: migration_20260827_084210_owner_unique.down,
    name: '20260827_084210_owner_unique'
  },
  {
    up: migration_20260827_084500_schema_constraints.up,
    down: migration_20260827_084500_schema_constraints.down,
    name: '20260827_084500_schema_constraints'
  },
];
