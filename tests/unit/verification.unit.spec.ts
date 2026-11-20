import type { PluginManifest } from '@promisetracker/kernel'
import { applyManifest } from '@promisetracker/kernel'
import { Claims, findQuote, verdictOf } from '@promisetracker/plugin-core'
import type { Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

/** Built-in verification (sections 4.5, 5.1 and 7.5). */
describe('verification', () => {
  it('reads a claim with no verdict as unverified', () => {
    expect(verdictOf({})).toBe('unverified')
    expect(verdictOf({ verification: { verdict: 'false' } })).toBe('false')
    expect(verdictOf({ verification: { verdict: 'nonsense' } })).toBe('unverified')
  })

  it('declares the verdict, date and rationale so a plugin can take them over', () => {
    const checker: PluginManifest = {
      slug: 'checker',
      version: '0.0.0',
      order: 50,
      takesOver: [
        {
          collection: 'claims',
          fields: ['verification.verdict', 'verification.date', 'verification.rationale'],
        },
      ],
    }
    const config = { collections: [Claims] } as unknown as Config
    const taken = applyManifest(config, checker, true)
    const claims = taken.collections?.find((c) => c.slug === 'claims')
    const group = claims?.fields.find((f) => 'name' in f && f.name === 'verification')
    const inside = (fields: readonly Field[]): Field[] =>
      fields.flatMap((f) => ('name' in f ? [f] : 'fields' in f ? inside(f.fields) : []))
    const fields = group && 'fields' in group ? inside(group.fields) : []
    for (const name of ['verdict', 'date', 'rationale']) {
      expect(
        fields.find((f) => 'name' in f && f.name === name),
        name,
      ).toMatchObject({
        admin: { readOnly: true },
      })
    }
    // A field nobody takes over stays as it was.
    expect(fields.find((f) => 'name' in f && f.name === 'reportUrl')).not.toMatchObject({
      admin: { readOnly: true },
    })
  })
})

describe('the statement in its source (section 5.1)', () => {
  const text = `The manifesto says many things.\n\nWe will   build five thousand homes
in Kibra by 2027. Then it moves on to roads and water.`

  it('finds the statement whatever its spacing and case, with text either side', () => {
    expect(findQuote(text, 'we will build five thousand homes in Kibra', 12)).toEqual({
      before: '…any things. ',
      quote: 'We will build five thousand homes in Kibra',
      after: ' by 2027. Th…',
    })
  })

  it('says when the statement is not in the text', () => {
    expect(findQuote(text, 'We will build ten thousand homes')).toBeNull()
    expect(findQuote('', 'Anything')).toBeNull()
  })
})
