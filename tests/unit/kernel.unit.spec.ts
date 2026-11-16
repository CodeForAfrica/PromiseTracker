import { readEnabledPlugins } from '@promisetracker/kernel'
import { describe, expect, it } from 'vitest'

describe('readEnabledPlugins', () => {
  it('defaults to core and site', () => {
    expect(readEnabledPlugins({})).toEqual(['core', 'site'])
  })

  it('reads PT_PLUGINS, trimming spaces and dropping repeats', () => {
    expect(readEnabledPlugins({ PT_PLUGINS: ' core, site ,tika,core' })).toEqual([
      'core',
      'site',
      'tika',
    ])
  })
})
