import * as migration_20261116_092722_initial from './20261116_092722_initial'
import * as migration_20261116_123328_users_roles from './20261116_123328_users_roles'
import * as migration_20261118_070121_countries_and_languages from './20261118_070121_countries_and_languages'
import * as migration_20261118_110407_areas_offices_imports from './20261118_110407_areas_offices_imports'
import * as migration_20261118_123454_actors_terms from './20261118_123454_actors_terms'
import * as migration_20261119_070155_rating_scales from './20261119_070155_rating_scales'
import * as migration_20261119_100042_claims_topics from './20261119_100042_claims_topics'
import * as migration_20261120_071500_documents from './20261120_071500_documents'
import * as migration_20261120_083653_publishing_cascade from './20261120_083653_publishing_cascade'
import * as migration_20261120_102714_native_verification from './20261120_102714_native_verification'
import * as migration_20261124_173822_claim_updates from './20261124_173822_claim_updates'
import * as migration_20261125_085438_plugin_tika_settings from './20261125_085438_plugin_tika_settings'
import * as migration_20261125_133015_search from './20261125_133015_search'
import * as migration_20261125_142205_plugin_ai from './20261125_142205_plugin_ai'

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
  {
    up: migration_20261120_071500_documents.up,
    down: migration_20261120_071500_documents.down,
    name: '20261120_071500_documents',
  },
  {
    up: migration_20261120_083653_publishing_cascade.up,
    down: migration_20261120_083653_publishing_cascade.down,
    name: '20261120_083653_publishing_cascade',
  },
  {
    up: migration_20261120_102714_native_verification.up,
    down: migration_20261120_102714_native_verification.down,
    name: '20261120_102714_native_verification',
  },
  {
    up: migration_20261124_173822_claim_updates.up,
    down: migration_20261124_173822_claim_updates.down,
    name: '20261124_173822_claim_updates',
  },
  {
    up: migration_20261125_085438_plugin_tika_settings.up,
    down: migration_20261125_085438_plugin_tika_settings.down,
    name: '20261125_085438_plugin_tika_settings',
  },
  {
    up: migration_20261125_133015_search.up,
    down: migration_20261125_133015_search.down,
    name: '20261125_133015_search',
  },
  {
    up: migration_20261125_142205_plugin_ai.up,
    down: migration_20261125_142205_plugin_ai.down,
    name: '20261125_142205_plugin_ai',
  },
]
