import type { Payload, PayloadRequest } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

import { SKIP_REFRESH } from './cache'

/**
 * The Delivery scale and the Promise claim type that a new installation starts
 * with (section 7.4, D22). `ensureDefaultRatings` adds them once. After that
 * they are editors' data like any other.
 *
 * Colours are the redesign's. Each text colour meets WCAG AA on its colour.
 * Values run from Stalled, 1, to Completed, 5, for ClaimReview data (section
 * 10.7). Unstarted and Inconclusive share the middle: neither says the
 * promise is closer to kept.
 */

type Text = { en: string; fr: string }

type DefaultRating = {
  slug: string
  tier: string
  label: Text
  definition: Text
  colour: string
  textColour: string
  value: number
  needsDeadline: boolean
  isStarting: boolean
}

export const DELIVERY_SCALE = {
  name: { en: 'Delivery', fr: 'Réalisation' } satisfies Text,
  bestValue: 5,
  worstValue: 1,
  tiers: [
    { slug: 'kept', label: { en: 'Promise kept', fr: 'Promesse tenue' }, colour: '#1b4fd8' },
    { slug: 'uncertain', label: { en: 'Uncertain', fr: 'Incertain' }, colour: '#80868f' },
    {
      slug: 'not-kept',
      label: { en: 'Promise not kept', fr: 'Promesse non tenue' },
      colour: '#c93b2c',
    },
  ],
  ratings: [
    {
      slug: 'completed',
      tier: 'kept',
      label: { en: 'Completed', fr: 'Réalisée' },
      definition: {
        en: 'The promise is mostly or completely fulfilled.',
        fr: 'La promesse est tenue en grande partie ou en totalité.',
      },
      colour: '#1b4fd8',
      textColour: '#ffffff',
      value: 5,
      needsDeadline: false,
      isStarting: false,
    },
    {
      slug: 'in-progress',
      tier: 'kept',
      label: { en: 'In Progress', fr: 'En cours' },
      definition: {
        en: 'The promise is in the works or being considered.',
        fr: "La promesse est en chantier ou à l'étude.",
      },
      colour: '#7fc4e8',
      textColour: '#122031',
      value: 4,
      needsDeadline: false,
      isStarting: false,
    },
    {
      slug: 'unstarted',
      tier: 'uncertain',
      label: { en: 'Unstarted', fr: 'Non commencé' },
      definition: {
        en: 'Every promise begins here and stays here until there is evidence of progress or proof it has been shelved.',
        fr: "Chaque promesse commence ici et y reste jusqu'à ce qu'une preuve de progrès ou d'abandon apparaisse.",
      },
      colour: '#e4e5e8',
      textColour: '#2a2c26',
      value: 3,
      needsDeadline: false,
      isStarting: true,
    },
    {
      slug: 'inconclusive',
      tier: 'uncertain',
      label: { en: 'Inconclusive', fr: 'Non concluant' },
      definition: {
        en: 'There is not yet enough evidence to tell whether the promise is being kept.',
        fr: "Il n'y a pas encore assez d'éléments pour dire si la promesse est tenue.",
      },
      colour: '#6b5b95',
      textColour: '#ffffff',
      value: 3,
      needsDeadline: false,
      isStarting: false,
    },
    {
      slug: 'behind-schedule',
      tier: 'not-kept',
      label: { en: 'Behind Schedule', fr: 'Retard sur le calendrier' },
      definition: {
        en: 'No progress, perhaps due to financial limits, opposition from lawmakers or a change in priorities.',
        fr: "Aucun progrès, peut-être faute de moyens, à cause de l'opposition des élus ou d'un changement de priorités.",
      },
      colour: '#f5d33a',
      textColour: '#241f00',
      value: 2,
      needsDeadline: true,
      isStarting: false,
    },
    {
      slug: 'stalled',
      tier: 'not-kept',
      label: { en: 'Stalled', fr: 'Bloquée' },
      definition: {
        en: 'Inaction by the administration, or lack of support from the legislature.',
        fr: "Inaction de l'administration, ou absence de soutien du corps législatif.",
      },
      colour: '#c93b2c',
      textColour: '#ffffff',
      value: 1,
      needsDeadline: true,
      isStarting: false,
    },
  ] satisfies DefaultRating[],
} as const

export const PROMISE_TYPE = {
  slug: 'promise',
  name: { en: 'Promise', fr: 'Promesse' } satisfies Text,
  // Promises are made for a term, so most have a deadline, if only "end of term".
  hasDeadline: true,
} as const

type Lang = keyof Text

const scaleIn = (lang: Lang) => ({
  name: DELIVERY_SCALE.name[lang],
  bestValue: DELIVERY_SCALE.bestValue,
  worstValue: DELIVERY_SCALE.worstValue,
  tiers: DELIVERY_SCALE.tiers.map((t) => ({ ...t, label: t.label[lang] })),
  ratings: DELIVERY_SCALE.ratings.map((r) => ({
    ...r,
    label: r.label[lang],
    definition: r.definition[lang],
  })),
})

/**
 * Adds the Delivery scale and the Promise claim type, in English and French,
 * while no rating scale exists. Runs at start-up, as the first super-admin is
 * created, rather than in a migration: a migration would save through whatever
 * the collections look like when it runs, which later issues change.
 *
 * Everything saves in one transaction. The web process and the worker start
 * together, and the Promise type's unique slug lets only one of them finish.
 */
export async function ensureDefaultRatings(payload: Payload): Promise<void> {
  // Start-up writes the installation's own data. There is no user to act as.
  const { totalDocs } = await payload.count({ collection: 'rating-scales', overrideAccess: true })
  if (totalDocs > 0) return

  const req: Partial<PayloadRequest> & { payload: Payload } = { payload }
  // Nothing is cached before the installation's first start.
  const system = {
    overrideAccess: true,
    req,
    depth: 0,
    context: { [SKIP_REFRESH]: true },
  } as const
  await initTransaction(req)
  try {
    const scale = await payload.create({
      collection: 'rating-scales',
      locale: 'en',
      data: scaleIn('en'),
      ...system,
    })
    // A second language is saved over the same rows, by their ids, so French
    // adds labels to the English rows rather than new rows.
    const fr = scaleIn('fr')
    await payload.update({
      collection: 'rating-scales',
      id: scale.id,
      locale: 'fr',
      data: {
        ...fr,
        tiers: fr.tiers.map((t, i) => ({ ...t, id: scale.tiers?.[i]?.id ?? null })),
        ratings: fr.ratings.map((r, i) => ({ ...r, id: scale.ratings?.[i]?.id ?? null })),
      },
      ...system,
    })
    const type = await payload.create({
      collection: 'claim-types',
      locale: 'en',
      data: {
        name: PROMISE_TYPE.name.en,
        slug: PROMISE_TYPE.slug,
        ratingScale: scale.id,
        hasDeadline: PROMISE_TYPE.hasDeadline,
      },
      ...system,
    })
    await payload.update({
      collection: 'claim-types',
      id: type.id,
      locale: 'fr',
      data: { name: PROMISE_TYPE.name.fr },
      ...system,
    })
    await commitTransaction(req)
  } catch (error) {
    await killTransaction(req).catch(() => undefined)
    // The other process added them first.
    const again = await payload.count({ collection: 'rating-scales', overrideAccess: true })
    if (again.totalDocs > 0) return
    throw error
  }
  payload.logger.info('Added the default Delivery scale and Promise claim type.')
}
