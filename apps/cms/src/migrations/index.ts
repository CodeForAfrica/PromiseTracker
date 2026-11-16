import * as migration_20261116_092722_initial from './20261116_092722_initial'
import * as migration_20261116_123328_users_roles from './20261116_123328_users_roles'

export const migrations = [
  {
    up: migration_20261116_092722_initial.up,
    down: migration_20261116_092722_initial.down,
    name: '20261116_092722_initial',
  },
  {
    up: migration_20261116_123328_users_roles.up,
    down: migration_20261116_123328_users_roles.down,
    name: '20261116_123328_users_roles',
  },
]
