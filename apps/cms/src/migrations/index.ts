import * as migration_20261116_092722_initial from './20261116_092722_initial'
import * as migration_20261116_123328_users_roles from './20261116_123328_users_roles'
import * as migration_20261118_070121_countries_and_languages from './20261118_070121_countries_and_languages'
import * as migration_20261118_110407_areas_offices_imports from './20261118_110407_areas_offices_imports'
import * as migration_20261118_123454_actors_terms from './20261118_123454_actors_terms'
import * as migration_20261119_070155_rating_scales from './20261119_070155_rating_scales'
import * as migration_20261119_100042_claims_topics from './20261119_100042_claims_topics'

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
    up: migration_20261118_110407_areas_offices_imports.up,
    down: migration_20261118_110407_areas_offices_imports.down,
    name: '20261118_110407_areas_offices_imports',
  },
  {
    up: migration_20261118_123454_actors_terms.up,
    down: migration_20261118_123454_actors_terms.down,
    name: '20261118_123454_actors_terms',
  },
  {
    up: migration_20261119_070155_rating_scales.up,
    down: migration_20261119_070155_rating_scales.down,
    name: '20261119_070155_rating_scales',
  },
  {
    up: migration_20261119_100042_claims_topics.up,
    down: migration_20261119_100042_claims_topics.down,
    name: '20261119_100042_claims_topics',
  },
]
