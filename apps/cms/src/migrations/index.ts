import * as migration_20261116_092722_initial from './20261116_092722_initial'

export const migrations = [
  {
    up: migration_20261116_092722_initial.up,
    down: migration_20261116_092722_initial.down,
    name: '20261116_092722_initial',
  },
]
