import * as migration_20261116_092722_initial from './20261116_092722_initial'
import * as migration_20261116_123328_users_roles from './20261116_123328_users_roles'
import * as migration_20261118_070121_countries_and_languages from './20261118_070121_countries_and_languages'
import * as migration_20261118_094425_rating_scales from './20261118_094425_rating_scales'

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
  {
    up: migration_20261118_070121_countries_and_languages.up,
    down: migration_20261118_070121_countries_and_languages.down,
    name: '20261118_070121_countries_and_languages',
  },
  {
    up: migration_20261118_094425_rating_scales.up,
    down: migration_20261118_094425_rating_scales.down,
    name: '20261118_094425_rating_scales',
  },
]
